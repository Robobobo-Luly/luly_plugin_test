import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { LexoRank } from 'lexorank';
import { PRESETS } from './presets';
import { applyControls, lessonScreenControls } from './controls-presets';
import { markdownToTipTapString } from './markdown-to-tiptap';
import { parseIntake, parsePlan, parseTheme, parseContent, parseMeta, MetaArtifact } from './parsers';
import { isContainerBlock } from './types';
import type {
  BlockExport,
  Brief,
  Control,
  FormatProfile,
  Lesson,
  LessonScreen,
  NodeExport,
  OnboardingArtifact,
  OverridesArtifact,
  Plan,
  ProductType,
  ScreenBlock,
  ThemeArtifact,
} from './types';

function red(s: string): string { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }

function fail(msg: string): never {
  console.error(red(`✖ assemble failed:`) + ` ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(green(`✓ assemble:`) + ` ${msg}`);
}

// ----------------------------------------------------------------------------
// LexoRank helpers — coarse spacing per sibling group
// ----------------------------------------------------------------------------

function ranksFor(count: number): string[] {
  const out: string[] = [];
  let r = LexoRank.middle();
  // generate (count) ascending ranks
  // first one is "middle"; subsequent move to higher-rank gaps
  out.push(r.toString());
  for (let i = 1; i < count; i++) {
    r = r.genNext();
    out.push(r.toString());
  }
  return out;
}

// ----------------------------------------------------------------------------
// Block defaults per format — mirrors luly-app getSampleContentForFormat
// (src/services/content/edit/sampleContentCreatorService.ts) so generated blocks
// carry the same body the CMS editor would mint for that format.
// ----------------------------------------------------------------------------

// Stored as a string on form bodies (the renderer parses it as TipTap JSON).
const DEFAULT_FORM_SUCCESS_CONTENT =
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Thank you!"}]},{"type":"paragraph","content":[{"type":"text","text":"Your submission has been received."}]}]}';

function defaultBlockBody(format: string): Record<string, unknown> {
  switch (format) {
    case 'image':
      return { url: '', alt: 'Image', aspectRatio: '1/1', objectFit: 'cover', objectPosition: 'center', borderRadius: '8px', width: '100%', loadingStyle: 'none' };
    case 'video':
      return { mediaType: 'video', url: '', autoplay: false, loop: false, muted: true, controls: true, aspectRatio: '1/1', objectFit: 'cover', objectPosition: 'center', borderRadius: '8px', width: '100%', loadingStyle: 'none' };
    case 'animation':
      return { mediaType: 'animation', url: '', autoplay: true, loop: true, speed: 1, aspectRatio: '1/1', objectFit: 'cover', objectPosition: 'center', borderRadius: '8px', width: '100%', loadingStyle: 'none' };
    case 'question':
      return { showCorrectAnswer: true, autoSubmit: false, shuffleChoices: false };
    case 'form':
    case 'email-form':
      return {
        submitLabel: 'Submit',
        submitConfig: { endpoint: '/api/forms/submit', method: 'POST', includeLocale: true, storeResponse: false },
        successMessage: 'Thank you!',
        successContent: DEFAULT_FORM_SUCCESS_CONTENT,
        postSubmitAction: 'message',
      };
    case 'container':
      return { layout: { desktop: { direction: 'row', gap: 32, justify: 'start', align: 'stretch' }, mobile: { direction: 'column', gap: 16, justify: 'start', align: 'stretch' } } };
    case 'slider':
      return { slider: { arrows: false, dots: true, swipe: true, loop: true, autoplay: false, autoplayInterval: 5000, arrowStyleName: 'primary', arrowSize: 44, dotStyle: {} } };
    case 'section':
      return {
        verticalAlign: 'center', horizontalAlign: 'left', minHeightMode: 'auto',
        paddingTop: { desktop: 88, mobile: 48 }, paddingBottom: { desktop: 88, mobile: 48 },
        paddingLeft: { desktop: 0, mobile: 0 }, paddingRight: { desktop: 0, mobile: 0 },
        marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      };
    case 'layout':
      return { ratio: '50:50' };
    case 'text':
    case 'button':
    default:
      return {};
  }
}

/** Merge authored container knobs over the default per-viewport layout. */
function buildContainerLayout(block: Extract<ScreenBlock, { format: 'container' }>): Record<string, unknown> {
  const desktop: Record<string, unknown> = { direction: 'row', gap: 32, justify: 'start', align: 'stretch' };
  const mobile: Record<string, unknown> = { direction: 'column', gap: 16, justify: 'start', align: 'stretch' };
  if (block.direction) desktop.direction = block.direction;
  if (block.gap !== undefined) desktop.gap = block.gap;
  if (block.justify) desktop.justify = block.justify;
  if (block.align) desktop.align = block.align;
  if (block.directionMobile) mobile.direction = block.directionMobile;
  if (block.gapMobile !== undefined) mobile.gap = block.gapMobile;
  return { desktop, mobile };
}

/** Default control for a `button` block — a visible Next-style nav button. */
function buttonControl(label: string, target?: string): Record<string, unknown> {
  return {
    id: uuidv4(),
    label: label || 'Continue',
    position: 'bottomCenter',
    requires_click: true,
    conditionalActions: [{ do: [{ type: 'goto', body: { target: target || 'next_sibling' } }] }],
  };
}

const CHILD_MARGIN_KEYS = ['marginTop', 'marginBottom', 'marginLeft', 'marginRight'] as const;

// ----------------------------------------------------------------------------
// Block compile — ScreenBlock → wire-format block (single node, no children)
// ----------------------------------------------------------------------------

function compileBlock(block: ScreenBlock, rank: string): BlockExport {
  const body: Record<string, unknown> = {
    format: block.format,
    ...defaultBlockBody(block.format),
  };

  switch (block.format) {
    case 'text':
      body.content = markdownToTipTapString(block.content);
      break;
    case 'image':
      if (block.url !== undefined) body.url = block.url;
      if (block.alt) body.alt = block.alt;
      break;
    case 'video':
    case 'animation':
      if (block.url !== undefined) body.url = block.url;
      break;
    case 'question':
      body.question_md = markdownToTipTapString(block.question);
      body.choices = block.choices;
      body.correctAnswer = block.correctAnswer;
      break;
    case 'form':
    case 'email-form':
      body.fields = block.fields;
      if (block.submitLabel) body.submitLabel = block.submitLabel;
      if (block.successMessage) body.successMessage = block.successMessage;
      if (block.successContent) body.successContent = markdownToTipTapString(block.successContent);
      break;
    case 'button':
      // body stays {} — the button's action lives on the block's controls.
      break;
    case 'container':
      body.layout = buildContainerLayout(block);
      break;
    case 'section':
      if (block.background) body.background = block.background;
      if (block.verticalAlign) body.verticalAlign = block.verticalAlign;
      if (block.horizontalAlign) body.horizontalAlign = block.horizontalAlign;
      if (block.minHeightMode) body.minHeightMode = block.minHeightMode;
      if (block.minHeight !== undefined) body.minHeight = block.minHeight;
      break;
    case 'slider':
      if (block.slider) body.slider = { ...(body.slider as Record<string, unknown>), ...block.slider };
      break;
    case 'layout':
      if (block.ratio) body.ratio = block.ratio;
      break;
  }

  // Per-child layout props (set when this block is nested in a container).
  if (block.flex !== undefined) body.flex = block.flex;
  if (block.slot !== undefined) body.slot = block.slot;
  for (const m of CHILD_MARGIN_KEYS) {
    if (block[m] !== undefined) body[m] = block[m];
  }

  const out: BlockExport = {
    type: 'block',
    slug: uuidv4(),
    body: body as Record<string, unknown> & { format: string },
    lexoRank: rank,
  };

  if (block.format === 'button') {
    out.controls = [buttonControl(block.label, block.target)];
  }

  return out;
}

// ----------------------------------------------------------------------------
// Screen block tree → flat block list (luly-app screen wire format)
//
// luly-app stores a screen's blocks as a FLAT array; nesting is expressed via
// `parentSlug` (child → container slug) and order via `lexoRank`. We pre-order
// DFS the ScreenBlock tree, assigning one monotonically ascending LexoRank to
// every block. Pre-order guarantees a node's next sibling outranks the node AND
// all its descendants, so sibling order within every parent is preserved after
// the importer's global lexoRank sort + parentSlug grouping.
// ----------------------------------------------------------------------------

function makeRankGen(): () => string {
  let r: LexoRank | null = null;
  return () => {
    r = r === null ? LexoRank.middle() : r.genNext();
    return r.toString();
  };
}

function flattenBlocks(
  blocks: ScreenBlock[],
  parentSlug: string | undefined,
  nextRank: () => string,
  out: BlockExport[],
): void {
  for (const block of blocks) {
    const compiled = compileBlock(block, nextRank());
    if (parentSlug) compiled.parentSlug = parentSlug;
    out.push(compiled);
    if (isContainerBlock(block) && block.children.length > 0) {
      flattenBlocks(block.children, compiled.slug, nextRank, out);
    }
  }
}

// ----------------------------------------------------------------------------
// Controls — replace semantic placeholder ids with fresh UUIDs
// ----------------------------------------------------------------------------

function instantiateControls(controls: Control[] | undefined): Control[] {
  if (!controls) return [];
  return controls.map((c) => ({
    ...c,
    id: uuidv4(),
  }));
}

// ----------------------------------------------------------------------------
// Merge object helpers — for overrides application
// ----------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function deepMerge<A extends Record<string, unknown>>(target: A, source: Record<string, unknown>): A {
  const out: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out as A;
}

// ----------------------------------------------------------------------------
// Tree assembly
// ----------------------------------------------------------------------------

interface AssembleInputs {
  workdir: string;
  brief: Brief;
  productType: ProductType;
  plan: Plan;
  formatProfile: FormatProfile;
  theme: ThemeArtifact;
  lessons: Lesson[];
  onboarding: OnboardingArtifact | null;
  controlsMap: Record<string, Control[]>;
  overrides: OverridesArtifact | null;
  meta: MetaArtifact;
}

function buildScreenNode(
  screen: LessonScreen,
  pathKey: string,
  rank: string,
  inputs: AssembleInputs,
): NodeExport {
  const screenNode: NodeExport = {
    type: 'screen',
    title: screen.title,
    description: '',
    slug: uuidv4(),
    body: { isStory: inputs.formatProfile.screenMode === 'story', showLessonTitle: true },
    controls: instantiateControls(inputs.controlsMap[pathKey]),
    lexoRank: rank,
    blocks: [],
  };

  // Flatten the screen's block tree into the wire format's flat array (nesting
  // via parentSlug + ascending lexoRank). Block-level style overrides are keyed
  // by position in the flattened list.
  const flat: BlockExport[] = [];
  flattenBlocks(screen.blocks, undefined, makeRankGen(), flat);
  flat.forEach((compiled, blockIdx) => {
    const overridePath = `${pathKey}.block-${blockIdx}`;
    const blockOverride = inputs.overrides?.blocks?.[overridePath];
    if (blockOverride) {
      compiled.style = blockOverride.style as Record<string, unknown>;
    }
    screenNode.blocks!.push(compiled);
  });

  // Apply screen-level overrides
  const screenOverride = inputs.overrides?.screens?.[pathKey];
  if (screenOverride) {
    if (screenOverride.style) screenNode.style = screenOverride.style as Record<string, unknown>;
    if (screenOverride.controlStyle) screenNode.controlStyle = screenOverride.controlStyle as Record<string, unknown>;
  }

  return screenNode;
}

/**
 * Course shape per preset, mirroring the canonical templates:
 * - `simple` courses (Basic Campaign, Waitlist, Interactive Proposal):
 *     course.body: { flowType: "simple", courseKey }
 *     lesson.body: { sectionType: "default" } — single wrapper lesson
 *   This makes the CMS open directly inside the lesson editor (no course-details
 *   landing screen).
 * - `learning` courses (Academy, Campaign-Course, Academy-Course):
 *     course.body: { author, flowType: "learning", courseKey, sequentialLessons }
 *     lesson.body: { sectionType: "lesson" } (or "default" for onboarding/completion wrappers)
 *   This makes the CMS open at the course-details / lesson-list screen.
 */
const SIMPLE_COURSE_PRESETS = new Set(['campaign-simple', 'waitlist', 'interactive-proposal']);

function isSimpleCourse(preset: string): boolean {
  return SIMPLE_COURSE_PRESETS.has(preset);
}

function courseBodyFor(
  preset: string,
  courseKey: string,
  opts: { courseAuthor?: string; cardImageSvg?: string; iconSvg?: string; iconUrl?: string; tags?: string[] } = {},
): Record<string, unknown> {
  if (isSimpleCourse(preset)) {
    const body: Record<string, unknown> = { flowType: 'simple', courseKey };
    if (opts.cardImageSvg) body.cardImageSvg = opts.cardImageSvg;
    if (opts.iconSvg) body.iconSvg = opts.iconSvg;
    if (opts.iconUrl) body.iconUrl = opts.iconUrl;
    // tags intentionally omitted for simple presets — no hub catalog UI renders them.
    return body;
  }
  const body: Record<string, unknown> = {
    author: opts.courseAuthor ?? '',
    flowType: 'learning',
    courseKey,
    sequentialLessons: true,
  };
  if (opts.cardImageSvg) body.cardImageSvg = opts.cardImageSvg;
  if (opts.iconSvg) body.iconSvg = opts.iconSvg;
  if (opts.iconUrl) body.iconUrl = opts.iconUrl;
  // Tags render on the hub course card (HubCourseCard reads course.body.tags).
  // Applies to academy / academy-course / campaign-course. Set even when no hub
  // exists for the preset — harmless and forward-compatible if a hub is added.
  if (opts.tags && opts.tags.length > 0) body.tags = opts.tags;
  return body;
}

/**
 * Read an agent-authored SVG file from the per-run workdir and return its raw
 * markup. Returns undefined when the file is missing or doesn't start with
 * <svg — assemble then proceeds without that field and the renderer falls
 * back to its default.
 */
/**
 * Brand icon discovery — prefer SVG (renders as inline iconSvg), fall back to
 * PNG (inlined as base64 iconUrl data URI). Intake saves whichever variant
 * the brand's favicon chain returned: `/favicon.svg` → brand-icon.svg,
 * `/apple-touch-icon.png` or `.ico→png` → brand-icon.png. Used when the
 * preset has a course-icon slot (academy / academy-course / campaign-course).
 */
function loadBrandIcon(workdir: string): { kind: 'svg'; svg: string } | { kind: 'png-url'; url: string } | undefined {
  const svgPath = join(workdir, 'brand-icon.svg');
  if (existsSync(svgPath)) {
    const raw = readFileSync(svgPath, 'utf8').trim();
    if (raw.startsWith('<svg')) return { kind: 'svg', svg: raw };
  }
  const pngPath = join(workdir, 'brand-icon.png');
  if (existsSync(pngPath)) {
    const b64 = readFileSync(pngPath).toString('base64');
    return { kind: 'png-url', url: `data:image/png;base64,${b64}` };
  }
  return undefined;
}

function loadInlineSvg(workdir: string, name: string): string | undefined {
  const path = join(workdir, name);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, 'utf8');
  // Real-world brand SVGs (Wikipedia, CDNs, design-tool exporters) routinely
  // lead with a UTF-8 BOM, an `<?xml …?>` prolog, a `<!DOCTYPE …>`, or XML
  // comments BEFORE the `<svg>` tag. The old `startsWith('<svg')` check rejected
  // all of those silently, so a downloaded brand logo never reached the flow.
  // Slice from the first `<svg` so any leading preamble is dropped.
  const idx = raw.indexOf('<svg');
  if (idx === -1) return undefined;
  return raw.slice(idx).trim();
}

/**
 * Convert an SVG markup string to a base64 data URI suitable for <img src>.
 */
function svgToDataUri(svg: string): string {
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

/**
 * Convert an SVG markup string to a utf-8 data URI. Smaller and more readable
 * than base64 for small SVGs; the only characters that need encoding are
 * # (hex colors), <, >, ?, ", and space. Suitable for placeholders shipped
 * directly in the flow JSON.
 */
function svgToUtf8DataUri(svg: string): string {
  // Normalize whitespace, then percent-encode the characters that break
  // data-URI parsing or JSON embedding.
  const compact = svg.replace(/\s+/g, ' ').trim();
  const encoded = compact
    .replace(/"/g, "'")     // single quotes are fine inside attributes and don't need JSON escaping
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\?/g, '%3F')
    .replace(/ /g, '%20');
  return `data:image/svg+xml;utf8,${encoded}`;
}

/** Lowercase kebab key fragment from a title (for unique stub courseKeys). */
function slugifyKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// Bundled default-course template (sanitized copy of luly-app's
// public/product-templates/default-course.json: Onboarding lesson removed,
// screen backgrounds + control color overrides stripped so the product theme
// applies). Cached after first read.
let _stubTemplate: NodeExport | null = null;
function loadStubTemplate(): NodeExport {
  if (_stubTemplate === null) {
    const p = join(__dirname, 'templates', 'stub-course.json');
    _stubTemplate = JSON.parse(readFileSync(p, 'utf8')) as NodeExport;
  }
  return _stubTemplate;
}

/**
 * Give every node and control in a cloned stub a fresh identity: a uuid `slug`
 * on each course/lesson/screen/block node, and a fresh `id` on each control.
 * Controls navigate by RELATIVE targets, so no reference rewrite is needed —
 * this just prevents repeated stubs (built from the same fixture) from sharing
 * node slugs or control ids.
 */
function freshControlIds(controls: unknown): void {
  if (!Array.isArray(controls)) return;
  for (const c of controls) {
    if (c && typeof c === 'object' && 'id' in (c as Record<string, unknown>)) {
      (c as Record<string, unknown>).id = uuidv4();
    }
  }
}

function reslug(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(reslug); return; }
  const obj = node as Record<string, unknown>;
  if (typeof obj.type === 'string' && ['course', 'lesson', 'screen'].includes(obj.type)) {
    obj.slug = uuidv4();
  }
  freshControlIds(obj.controls);
  // Blocks live in a flat `blocks[]` and nest via `parentSlug` (child → container
  // slug). Reslug each block AND rewrite parentSlug through the same old→new map
  // so container nesting survives the clone — symmetric with the importer's
  // remapSlugs.
  if (Array.isArray(obj.blocks)) {
    const map = new Map<string, string>();
    for (const b of obj.blocks) {
      if (b && typeof b === 'object') {
        const blk = b as Record<string, unknown>;
        const fresh = uuidv4();
        if (typeof blk.slug === 'string') map.set(blk.slug, fresh);
        blk.slug = fresh;
      }
    }
    for (const b of obj.blocks) {
      if (b && typeof b === 'object') {
        const blk = b as Record<string, unknown>;
        if (typeof blk.parentSlug === 'string' && map.has(blk.parentSlug)) {
          blk.parentSlug = map.get(blk.parentSlug);
        }
        freshControlIds(blk.controls);
      }
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') reslug(v);
  }
}

/**
 * Build a content-less stub course from the bundled default-course template.
 * Clones the template, gives every node a fresh slug (controls navigate by
 * RELATIVE targets, so no reference rewrite is needed), injects the card
 * identity (title + description + courseKey + author), and clears any per-course
 * card/icon so the flow's shared branded placeholder is used.
 */
function buildStubCourse(
  entry: { title: string; description: string },
  courseKey: string,
  rank: string,
  author: string,
): NodeExport {
  const node = JSON.parse(JSON.stringify(loadStubTemplate())) as NodeExport;
  node.title = entry.title;
  node.description = entry.description ?? '';
  node.lexoRank = rank;
  const body = (node.body ?? {}) as Record<string, unknown>;
  body.courseKey = courseKey;
  body.author = author ?? '';
  body.flowType = 'learning';
  body.sequentialLessons = true;
  // Shared branded placeholder: drop any per-course card/icon so the flow-level
  // placeholderUrl applies.
  delete body.cardImageSvg; delete body.cardImageUrl; delete body.cardImageMobileUrl;
  delete body.iconSvg; delete body.iconUrl;
  node.body = body;
  // The app's default-course template leaves lesson/screen titles blank; the
  // plugin validator requires a non-empty title on every lesson and screen.
  // Backfill placeholder titles (the user renames them when authoring).
  (node.children ?? []).forEach((lesson, li) => {
    if (typeof lesson.title !== 'string' || !lesson.title.trim()) lesson.title = `Lesson ${li + 1}`;
    const screens = lesson.children ?? [];
    screens.forEach((screen, si) => {
      if (typeof screen.title !== 'string' || !screen.title.trim()) screen.title = `Screen ${si + 1}`;
      // Re-bake screen nav so finishLesson lands ONLY on the last screen (the
      // bundled fixture carried the old isLastScreen-guard form). Uses the same
      // builder as authored content; reslug() below mints fresh control ids.
      screen.controls = lessonScreenControls({ isFirst: si === 0, isLast: si === screens.length - 1 });
    });
  });
  reslug(node);
  return node;
}

function buildLessonNode(
  lesson: Lesson,
  lessonRank: string,
  inputs: AssembleInputs,
  sectionType: 'default' | 'lesson',
): NodeExport {
  const lessonPath = `lesson-${lesson.n}`;
  const lessonNode: NodeExport = {
    type: 'lesson',
    title: lesson.title ?? `Lesson ${lesson.n}`,
    description: '',
    slug: uuidv4(),
    body: { sectionType },
    controls: instantiateControls(inputs.controlsMap[lessonPath]),
    lexoRank: lessonRank,
    children: [],
  };
  const screenRanks = ranksFor(lesson.screens.length);
  lesson.screens.forEach((screen, screenIdx) => {
    const screenPath = `${lessonPath}.screen-${screen.n}`;
    const screenNode = buildScreenNode(screen, screenPath, screenRanks[screenIdx], inputs);
    lessonNode.children!.push(screenNode);
  });
  return lessonNode;
}

function buildCourseOnly(inputs: AssembleInputs): NodeExport {
  const preset = inputs.productType.preset;
  // Card cover + course icon SVGs only apply to learning-shape presets that
  // have a hub catalog (academy, academy-course, campaign-course). Simple
  // courses (campaign-simple, waitlist, interactive-proposal) have no hub
  // so the SVGs would never render. Skip the file reads entirely — this also
  // protects against stale SVG artifacts from a previous run polluting a
  // fresh generation of a simple preset.
  const cardImageSvg = isSimpleCourse(preset) ? undefined : loadInlineSvg(inputs.workdir, 'card-cover.svg');
  // Prefer the brand icon (SVG or PNG from intake's favicon fallback or
  // press-kit search) over the generated course-icon.svg — when the brand
  // publishes any usable icon-only mark, it carries instant recognition that
  // a generated abstract icon can't match.
  const brandIcon = isSimpleCourse(preset) ? undefined : loadBrandIcon(inputs.workdir);
  const iconSvg = isSimpleCourse(preset)
    ? undefined
    : (brandIcon?.kind === 'svg' ? brandIcon.svg : loadInlineSvg(inputs.workdir, 'course-icon.svg'));
  const iconUrl = brandIcon?.kind === 'png-url' ? brandIcon.url : undefined;
  const metaTags = (inputs.meta.tags && inputs.meta.tags.length > 0) ? inputs.meta.tags : undefined;
  const course: NodeExport = {
    type: 'course',
    title: inputs.plan.courseTitle,
    description: inputs.plan.intro ?? '',
    slug: uuidv4(),
    body: courseBodyFor(preset, inputs.productType.key, {
      courseAuthor: inputs.productType.courseAuthor,
      cardImageSvg,
      iconSvg,
      iconUrl,
      tags: metaTags,
    }),
    controls: instantiateControls(inputs.controlsMap['course']),
    lexoRank: ranksFor(1)[0],
    children: [],
  };

  // academy-course is a learning shape, so its lessons get sectionType='lesson'.
  const lessonRanks = ranksFor(inputs.lessons.length);
  inputs.lessons.forEach((lesson, lessonIdx) => {
    course.children!.push(buildLessonNode(lesson, lessonRanks[lessonIdx], inputs, 'lesson'));
  });

  return course;
}

function buildFlow(inputs: AssembleInputs): NodeExport {
  const spec = PRESETS[inputs.productType.preset];

  // theme.json now carries the full theme directly (colors + style + optional layout).
  // No preset resolution — pass through verbatim.
  const themeBlock: Record<string, unknown> = {
    colors: inputs.theme.colors,
    style: inputs.theme.style,
  };
  // Only attach `layout` when the theme actually carries overrides. The old
  // `{ maxWidth: '1200px' }` default used a key the renderer ignores (it expects
  // `maxWidthDesktop` / `paddingDesktop`), so it never applied — flows render at
  // the app default (desktop 1480px). Omitting the key keeps that behavior and
  // avoids shipping a dead override.
  if (inputs.theme.layout && Object.keys(inputs.theme.layout).length > 0) {
    themeBlock.layout = inputs.theme.layout;
  }

  const flowBody: Record<string, unknown> = {
    product: spec.product,
    flowType: spec.flowType,
    productType: spec.productType,
    key: inputs.productType.key,
    theme: themeBlock,
  };
  if (spec.campaignType) flowBody.campaignType = spec.campaignType;

  // Brand marks saved by intake:
  //   logo.svg     = lockup / wordmark (has the company name) — best for the hub.
  //   brand-icon.* = icon-only mark (no text) — best for the compact header bar
  //                  and the course icon. loadBrandIcon returns SVG or PNG-data-URI.
  const logoSvg = loadInlineSvg(inputs.workdir, 'logo.svg');
  const brandIcon = loadBrandIcon(inputs.workdir);
  const brandIconDataUri =
    brandIcon?.kind === 'svg' ? svgToDataUri(brandIcon.svg)
    : brandIcon?.kind === 'png-url' ? brandIcon.url
    : undefined;

  // Header logo — SHORT (icon-only) is preferred for the narrow header bar
  // (~20px tall); fall back to the lockup, then any brand-exposed URL, then the
  // default Luly mark. Sets headerLogoLink to "/" so the logo links to root.
  const headerLogo = brandIconDataUri ?? (logoSvg ? svgToDataUri(logoSvg) : undefined) ?? inputs.brief.brand?.logo;
  if (headerLogo) {
    flowBody.headerLogo = headerLogo;
    flowBody.headerLogoLink = '/';
  }

  flowBody.locales = {
    supported: inputs.formatProfile.locales,
    default: inputs.formatProfile.locales[0],
  };

  // Branded placeholder data URIs — shown when a media block has no image, a
  // course has no cardImageUrl, or a course has no iconUrl. Generated by
  // luly-style into <workdir>/placeholders/{media,card,icon}.svg and inlined
  // here as utf-8 data URIs. Field is omitted when the SVG isn't present, so
  // the CMS falls back to its built-in default placeholder.
  const mediaPh = loadInlineSvg(inputs.workdir, 'placeholders/media.svg');
  const cardPh  = loadInlineSvg(inputs.workdir, 'placeholders/card.svg');
  const iconPh  = loadInlineSvg(inputs.workdir, 'placeholders/icon.svg');
  if (mediaPh) flowBody.mediaPlaceholderUrl = svgToUtf8DataUri(mediaPh);
  if (cardPh)  flowBody.cardPlaceholderUrl  = svgToUtf8DataUri(cardPh);
  if (iconPh)  flowBody.iconPlaceholderUrl  = svgToUtf8DataUri(iconPh);

  // Marketing tags from meta.md land on the course node (where HubCourseCard
  // renders them), not on the flow. See per-preset behavior in courseBodyFor:
  // - academy / academy-course / campaign-course → tags on course.body.tags
  // - simple presets (campaign-simple / waitlist / interactive-proposal) → no tags
  const metaTags = (inputs.meta.tags && inputs.meta.tags.length > 0) ? inputs.meta.tags : undefined;

  // Title routing — academy preset uses academyName for the flow + hub title
  // and plan.courseTitle as the FIRST COURSE title. Other presets reuse
  // plan.courseTitle for everything.
  const preset = inputs.productType.preset;
  const isAcademy = preset === 'academy';
  const flowTitle = isAcademy ? (inputs.productType.academyName ?? inputs.plan.courseTitle) : inputs.plan.courseTitle;
  const flowDescription = isAcademy ? (inputs.productType.academyDescription ?? '') : (inputs.plan.intro ?? '');
  const courseTitle = inputs.plan.courseTitle;
  const courseDescription = inputs.plan.intro ?? '';

  const flowRanks = ranksFor(1);
  const flow: NodeExport = {
    type: 'flow',
    title: flowTitle,
    description: flowDescription,
    slug: uuidv4(),
    body: flowBody,
    controls: instantiateControls(inputs.controlsMap['flow']),
    lexoRank: flowRanks[0],
    children: [],
  };

  // Onboarding screens — direct flow children, before the hub
  if (inputs.onboarding && inputs.onboarding.screens.length > 0) {
    const obRanks = ranksFor(inputs.onboarding.screens.length + 1); // +1 leaves room for the hub below
    inputs.onboarding.screens.forEach((screen, i) => {
      const path = `onboarding-${screen.n}`;
      const node = buildScreenNode(screen, path, obRanks[i], inputs);
      // Academy onboarding screens canonically don't show the lesson title bar
      if (node.body && typeof node.body === 'object') {
        (node.body as Record<string, unknown>).showLessonTitle = false;
      }
      flow.children!.push(node);
    });
  }

  // Hub — academy preset carries the academy name as the hub title.
  // hubLogo defaults to brand logo when available, otherwise empty string
  // (which prevents the renderer from falling back to the default base icon).
  // hub.body.hubLogo: prefer the clean SVG (same as headerLogo); else fall back
  // to brand.logo URL; else empty string (renderer suppresses default base icon).
  // Hub logo decision — meta.md `hub-logo: placeholder` forces empty (the CMS
  // falls back to flow.body.iconPlaceholderUrl). Default (or 'brand-logo') uses
  // the workdir logo.svg / brand.logo URL chain.
  // Hub logo — LONG (lockup with the company name) reads best above the hub
  // title; fall back to the icon-only mark, then any brand URL. `placeholder`
  // forces empty so the CMS uses flow.body.iconPlaceholderUrl instead.
  const hubLogoUrl = inputs.meta.hubLogoDecision === 'placeholder'
    ? ''
    : ((logoSvg ? svgToDataUri(logoSvg) : undefined) ?? brandIconDataUri ?? (inputs.brief.brand?.logo ?? ''));
  const hub: NodeExport = {
    type: 'hub',
    title: isAcademy ? flowTitle : 'Hub',
    description: '',
    slug: uuidv4(),
    body: { hubLogo: hubLogoUrl },
    controls: instantiateControls(inputs.controlsMap['hub']),
    lexoRank: ranksFor(1)[0],
    children: [],
  };
  flow.children!.push(hub);

  // Course — body shape varies by preset:
  //   simple courses  → { flowType: 'simple', courseKey } (no SVG fields)
  //   learning courses → { author, flowType: 'learning', courseKey, sequentialLessons, cardImageSvg?, iconSvg? }
  // Both SVGs are authored by /luly-icon and stored inline as text:
  //   - cardImageSvg = wide fixed-height banner card cover (~10:3, cover-cropped)
  //   - iconSvg      = square 1:1 course icon (course-icon.svg)
  // Simple presets have no hub catalog → skip loading SVGs (defensive against
  // stale tmp artifacts from a previous run polluting a fresh generation).
  const courseIsSimple = isSimpleCourse(preset);

  // Optional content-less "template" courses appended to the hub (opt-in, set by
  // /luly-plan only when the user asks for multiple/placeholder courses). They
  // never apply to simple presets (no hub catalog).
  const templateCourses = (!courseIsSimple && inputs.plan.templateCourses) ? inputs.plan.templateCourses : [];
  const hasStubs = templateCourses.length > 0;
  // Authored course: always built when there are no stubs (preserves the default
  // single-course behavior). When stubs ARE present, build it only if there's
  // authored content — so an "onboarding + only stubs" academy skips it.
  const buildAuthored = !hasStubs || inputs.lessons.length > 0;
  const courseCount = (buildAuthored ? 1 : 0) + templateCourses.length;
  const courseRanks = ranksFor(Math.max(courseCount, 1));
  let courseIdx = 0;

  if (buildAuthored) {
    // SVGs only apply to hub-catalog presets; stale-artifact-safe for simple.
    const cardImageSvg = courseIsSimple ? undefined : loadInlineSvg(inputs.workdir, 'card-cover.svg');
    const courseBrandIcon = courseIsSimple ? undefined : brandIcon;
    const iconSvg = courseIsSimple
      ? undefined
      : (courseBrandIcon?.kind === 'svg' ? courseBrandIcon.svg : loadInlineSvg(inputs.workdir, 'course-icon.svg'));
    const iconUrl = courseBrandIcon?.kind === 'png-url' ? courseBrandIcon.url : undefined;
    const course: NodeExport = {
      type: 'course',
      title: courseTitle,
      description: courseDescription,
      slug: uuidv4(),
      body: courseBodyFor(preset, inputs.productType.key, {
        courseAuthor: inputs.productType.courseAuthor,
        cardImageSvg,
        iconSvg,
        iconUrl,
        tags: metaTags,
      }),
      controls: instantiateControls(inputs.controlsMap['course']),
      lexoRank: courseRanks[courseIdx++],
      children: [],
    };
    hub.children!.push(course);

    // Lessons — sectionType depends on course shape:
    //   simple course: single wrapper lesson, sectionType='default'
    //   learning course: lessons are TOC entries, sectionType='lesson'
    const lessonRanks = ranksFor(inputs.lessons.length);
    inputs.lessons.forEach((lesson, lessonIdx) => {
      const sectionType = courseIsSimple ? 'default' : 'lesson';
      course.children!.push(buildLessonNode(lesson, lessonRanks[lessonIdx], inputs, sectionType));
    });
  }

  // Template / stub courses — content-less catalog entries built from the
  // bundled default-course template (theme applies; shared branded placeholder
  // for card + icon). The user authors them later in the CMS.
  const stubAuthor = inputs.productType.courseAuthor ?? '';
  templateCourses.forEach((tc) => {
    const slugPart = slugifyKey(tc.title) || `course-${courseIdx + 1}`;
    const key = `${inputs.productType.key}-${slugPart}`;
    hub.children!.push(buildStubCourse(tc, key, courseRanks[courseIdx++], stubAuthor));
  });

  return flow;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

function readMd(path: string, label: string): string {
  if (!existsSync(path)) fail(`${label} not found at ${path}`);
  return readFileSync(path, 'utf8');
}

/**
 * Walk an assembled JSON tree, collecting every http(s) URL it can find and
 * recording where in the tree the URL lives. Data URIs, relative paths, and
 * non-string values are skipped. Result is grouped by URL so multi-references
 * resolve in one HEAD request.
 */
function collectUrls(root: unknown): Map<string, Array<{ owner: Record<string, unknown>; key: string; path: string }>> {
  const out = new Map<string, Array<{ owner: Record<string, unknown>; key: string; path: string }>>();
  function isHttp(s: string): boolean {
    return /^https?:\/\//i.test(s);
  }
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && isHttp(v)) {
        const entries = out.get(v) ?? [];
        entries.push({ owner: obj, key: k, path: `${path}.${k}` });
        out.set(v, entries);
      } else if (v && typeof v === 'object') {
        visit(v, `${path}.${k}`);
      }
    }
  }
  visit(root, '');
  return out;
}

/**
 * HEAD-check a URL with a 3-second timeout. Returns true iff the response is
 * 2xx or 3xx. Network errors, timeouts, and 4xx/5xx all count as failure.
 * Some hosts (notably AWS S3, Cloudflare) reject HEAD with 403 but accept GET
 * — fall back to a 2-byte ranged GET in that case.
 */
async function checkUrlAlive(url: string): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3000);
  try {
    const headRes = await fetch(url, { method: 'HEAD', signal: ac.signal, redirect: 'follow' });
    if (headRes.ok || (headRes.status >= 300 && headRes.status < 400)) return true;
    // Some CDNs return 403/405 on HEAD but serve GET fine.
    if (headRes.status === 403 || headRes.status === 405) {
      const getRes = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' }, signal: ac.signal, redirect: 'follow' });
      return getRes.ok || getRes.status === 206;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Walk the assembled tree, HEAD-check every http(s) URL, clear the ones that
 * fail. Cleared fields fall back to renderer defaults (placeholders for
 * images, Luly mark for logo). Logs a one-line summary per URL — bad URLs
 * surface loudly so the user can swap them.
 *
 * Skipped via env: LULY_SKIP_URL_CHECK=1 (useful for offline runs).
 * Returns the number of URLs cleared.
 */
async function checkAndStripDeadUrls(root: unknown): Promise<number> {
  if (process.env.LULY_SKIP_URL_CHECK === '1') {
    console.log('  url liveness check = SKIPPED (LULY_SKIP_URL_CHECK=1)');
    return 0;
  }
  const urls = collectUrls(root);
  if (urls.size === 0) {
    console.log('  url liveness check = no http(s) URLs to verify');
    return 0;
  }
  // Bounded parallel HEAD checks. 8 concurrent is gentle but quick.
  const uniqueUrls = Array.from(urls.keys());
  const results = new Map<string, boolean>();
  const CONCURRENCY = 8;
  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
    const batch = uniqueUrls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(async u => [u, await checkUrlAlive(u)] as const));
    for (const [u, ok_] of batchResults) results.set(u, ok_);
  }
  let cleared = 0;
  let ok_ = 0;
  for (const [url, entries] of urls) {
    if (results.get(url)) {
      ok_++;
      continue;
    }
    // Dead URL — clear every reference so the renderer falls back to placeholder.
    for (const { owner, key, path } of entries) {
      owner[key] = '';
      cleared++;
      console.log(`  url dead → cleared  ${path}  (${url})`);
    }
  }
  console.log(`  url liveness check = ${uniqueUrls.length} unique URLs · ${ok_} OK · ${cleared} field(s) cleared`);
  return cleared;
}

async function main(): Promise<void> {
  // Workdir = per-run subdirectory passed by the orchestrator (v0.2.2+):
  //   ./bin/luly assemble "tmp/luly-agent/phantom-academy"
  // Falls back to the legacy flat layout (tmp/luly-agent) when no arg given,
  // for direct invocations outside the orchestrator.
  const workdirArg = process.argv[2];
  const workdir = workdirArg
    ? resolve(process.cwd(), workdirArg)
    : resolve(process.cwd(), 'tmp/luly-agent');
  if (!existsSync(workdir)) fail(`workdir not found: ${workdir}`);

  const intakeMd  = readMd(join(workdir, 'intake.md'),  'intake.md');
  const planMd    = readMd(join(workdir, 'plan.md'),    'plan.md');
  const themeMd   = readMd(join(workdir, 'theme.md'),   'theme.md');
  const contentMd = readMd(join(workdir, 'content.md'), 'content.md');

  // meta.md is optional — when present, its values override plan-derived
  // title/description, supply tags, and gate the academy hub-logo decision.
  const metaPath = join(workdir, 'meta.md');
  const meta: MetaArtifact = existsSync(metaPath)
    ? parseMeta(readMd(metaPath, 'meta.md'))
    : {};

  const { brief, productType } = parseIntake(intakeMd);
  const { plan, formatProfile } = parsePlan(planMd);
  const theme = parseTheme(themeMd);
  const parsed = parseContent(contentMd);

  // Meta overrides — apply to plan and productType before downstream stages
  // read them. Empty/absent meta fields leave plan values untouched.
  if (meta.courseTitle) plan.courseTitle = meta.courseTitle;
  if (meta.courseDescription) plan.intro = meta.courseDescription;
  if (meta.academyName) productType.academyName = meta.academyName;
  if (meta.academyDescription) productType.academyDescription = meta.academyDescription;

  // Merge section titles from plan into the filled lessons (content.md only carries
  // per-screen titles; section titles live in plan.md).
  const lessons: Lesson[] = parsed.lessons.map((l) => {
    const planLesson = plan.lessons.find((pl) => pl.n === l.n);
    return { ...l, title: planLesson?.title ?? l.title };
  });
  const onboarding = parsed.onboarding;

  // Cross-checks (one final gate replaces all per-stage validators)
  if (productType.preset === 'academy-course' && plan.onboarding.length > 0) {
    fail(
      'academy-course preset does not support onboarding screens — onboarding lives on the parent academy. ' +
      'Remove the "## Onboarding" section from plan.md.'
    );
  }

  const planSectionNs = plan.lessons.map((l) => l.n);
  const filledNs = new Set(lessons.map((l) => l.n));
  const missing = planSectionNs.filter((n) => !filledNs.has(n));
  if (missing.length > 0) {
    fail(
      `plan has ${planSectionNs.length} section(s) but section(s) [${missing.join(', ')}] not present in content.md`
    );
  }

  if (plan.onboarding.length > 0) {
    if (!onboarding || onboarding.screens.length !== plan.onboarding.length) {
      fail(
        `plan declares ${plan.onboarding.length} onboarding screen(s) but content.md has ` +
        `${onboarding?.screens.length ?? 0} — re-fill content.md`
      );
    }
  }

  // Compute controls inline (replaces the old apply-controls + controls.json stage).
  // Driven by the ACTUAL content (lessons + onboarding screens) so control-map keys
  // and screen positions (first/last → finishLesson) match what gets assembled.
  const controlsArtifact = applyControls(productType.preset, {
    lessons,
    onboarding: onboarding?.screens ?? [],
  });

  const isCourseOnly = productType.preset === 'academy-course';

  const root = isCourseOnly
    ? buildCourseOnly({ workdir, brief, productType, plan, formatProfile, theme, lessons, onboarding, controlsMap: controlsArtifact.controls, overrides: null, meta })
    : buildFlow({ workdir, brief, productType, plan, formatProfile, theme, lessons, onboarding, controlsMap: controlsArtifact.controls, overrides: null, meta });

  // URL liveness pass — HEAD-check every http(s) URL and clear dead ones so
  // the renderer falls back to placeholders. Runs BEFORE the file is written
  // so cleared fields are persisted to disk. Data URIs and relative paths
  // are skipped. Set LULY_SKIP_URL_CHECK=1 to disable (offline runs).
  await checkAndStripDeadUrls(root);

  const outputPath = join(workdir, `${productType.key}.luly.json`);
  writeFileSync(outputPath, JSON.stringify(root, null, 2) + '\n', 'utf8');

  // Summary — count tree nodes
  let counts = { hub: 0, course: 0, lesson: 0, onboardingScreen: 0, lessonScreen: 0, block: 0 };
  if (!isCourseOnly) {
    for (const child of root.children ?? []) {
      if (child.type === 'screen') counts.onboardingScreen++;
    }
  }
  function walk(node: NodeExport): void {
    if (node.type === 'hub') counts.hub++;
    else if (node.type === 'course') counts.course++;
    else if (node.type === 'lesson') counts.lesson++;
    else if (node.type === 'screen') counts.lessonScreen++;
    for (const c of node.children ?? []) walk(c);
    for (const _b of node.blocks ?? []) counts.block++;
  }
  if (isCourseOnly) {
    walk(root);
  } else {
    for (const child of root.children ?? []) {
      if (child.type !== 'screen') walk(child);
      else for (const _b of child.blocks ?? []) counts.block++;
    }
  }

  ok(`wrote ${outputPath}`);
  console.log(`  preset             = ${productType.preset}`);
  console.log(`  key                = ${productType.key}`);
  console.log(`  output             = ${isCourseOnly ? 'course-only (no flow wrapper)' : 'full flow'}`);
  if (!isCourseOnly) {
    console.log(`  theme primary      = ${theme.colors.primary}`);
    console.log(`  fontHeading        = ${theme.style.fontHeading}`);
    console.log(`  fontBody           = ${theme.style.fontBody}`);
  }
  if (!isCourseOnly) console.log(`  onboarding screens = ${counts.onboardingScreen}`);
  if (!isCourseOnly) console.log(`  hubs / courses     = ${counts.hub} / ${counts.course}`);
  else console.log(`  courses            = ${counts.course}`);
  console.log(`  lessons / screens  = ${counts.lesson} / ${counts.lessonScreen}`);
  console.log(`  blocks             = ${counts.block}`);
  console.log(`  overrides applied  = no`);
  if (!isCourseOnly) console.log(`  locales            = [${formatProfile.locales.join(', ')}]`);

  // Asset-state summary — surfaces missing brand assets so failures aren't silent.
  const logoState = existsSync(join(workdir, 'logo.svg'))
    ? 'workdir/logo.svg (inlined)'
    : (brief.brand?.logo ? `brand URL (${brief.brand.logo})` : 'NONE → header falls back to Luly default');
  const cardSvg  = existsSync(join(workdir, 'card-cover.svg'))   ? 'present' : 'NONE';
  const brandIcnSvg = existsSync(join(workdir, 'brand-icon.svg'))? 'present (SVG — takes priority over generated course-icon)' : 'NONE';
  const brandIcnPng = existsSync(join(workdir, 'brand-icon.png'))? 'present (PNG — inlined as iconUrl data URI)' : 'NONE';
  const iconSvg  = existsSync(join(workdir, 'course-icon.svg'))  ? 'present' : 'NONE';
  const hubSvg   = existsSync(join(workdir, 'hub-logo.svg'))     ? 'present' : 'NONE';
  const phMedia  = existsSync(join(workdir, 'placeholders/media.svg')) ? 'Y' : 'N';
  const phCard   = existsSync(join(workdir, 'placeholders/card.svg'))  ? 'Y' : 'N';
  const phIcon   = existsSync(join(workdir, 'placeholders/icon.svg'))  ? 'Y' : 'N';
  console.log(`  --- assets ---`);
  console.log(`  header logo        = ${logoState}`);
  console.log(`  card-cover.svg     = ${cardSvg}`);
  console.log(`  brand-icon.svg     = ${brandIcnSvg}`);
  console.log(`  brand-icon.png     = ${brandIcnPng}`);
  console.log(`  course-icon.svg    = ${iconSvg}`);
  console.log(`  hub-logo.svg       = ${hubSvg}`);
  console.log(`  placeholders       = media:${phMedia} card:${phCard} icon:${phIcon}` +
    (phMedia === 'N' || phCard === 'N' || phIcon === 'N' ? ' (missing → CMS uses its own default)' : ''));

  // Run final validator
  const validatorPath = resolve(__dirname, 'validate-flow.ts');
  const tsconfigPath = resolve(__dirname, 'tsconfig.json');
  const result = spawnSync(
    'npx',
    ['ts-node', '--project', tsconfigPath, validatorPath, outputPath],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    fail(`final validation failed for ${outputPath} — see message above`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
