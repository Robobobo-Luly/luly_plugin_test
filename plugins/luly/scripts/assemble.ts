import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { LexoRank } from 'lexorank';
import { PRESETS } from './presets';
import { applyControls } from './controls-presets';
import { markdownToTipTapString } from './markdown-to-tiptap';
import { parseIntake, parsePlan, parseTheme, parseContent } from './parsers';
import type {
  BlockExport,
  Brief,
  Control,
  FormatProfile,
  Lesson,
  LessonBlock,
  LessonScreen,
  NodeExport,
  OnboardingArtifact,
  OverridesArtifact,
  Plan,
  ProductType,
  ThemeArtifact,
} from './types';

function red(s: string): string { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string): string { return `\x1b[33m${s}\x1b[0m`; }

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
// Block defaults per format (matches what real templates carry)
// ----------------------------------------------------------------------------

function defaultBlockBody(format: string): Record<string, unknown> {
  switch (format) {
    case 'image-richtext':
      return { mediaType: 'image', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '8px' };
    case 'image':
      return { objectFit: 'cover', borderRadius: '8px' };
    case 'quiz-text':
      return { autoSubmit: false, shuffleChoices: false, showCorrectAnswer: true };
    case 'form':
    case 'email-form':
      return { formPosition: 'center', postSubmitAction: 'message' };
    case 'form-text':
      return {
        formPosition: 'center',
        postSubmitAction: 'message',
        submitConfig: { method: 'POST', endpoint: '/api/forms/submit', includeLocale: true, storeResponse: false },
      };
    default:
      return {};
  }
}

// ----------------------------------------------------------------------------
// Block compile — stage-4 LessonBlock → wire-format block
// ----------------------------------------------------------------------------

function compileBlock(block: LessonBlock, rank: string): BlockExport {
  const body: Record<string, unknown> = {
    format: block.format,
    ...defaultBlockBody(block.format),
  };

  switch (block.format) {
    case 'text':
      body.content = markdownToTipTapString(block.content);
      break;
    case 'image-richtext':
      body.imageUrl = block.imageUrl;
      body.imagePosition = block.imagePosition;
      body.content = markdownToTipTapString(block.content);
      if (block.caption) body.caption = block.caption;
      break;
    case 'image':
      body.url = block.url;
      body.alt = block.alt;
      if (block.caption) body.caption = block.caption;
      break;
    case 'video':
      body.url = block.url;
      if (block.poster) body.poster = block.poster;
      if (block.caption) body.caption = block.caption;
      break;
    case 'quiz-text':
      // 'quiz-text' is the composite (text + quiz) renderer. Only emit when the
      // agent supplied non-empty body text via the `text` field. The agent
      // should pick the `question` format instead for pure quiz screens.
      body.question_md = markdownToTipTapString(block.question);
      body.choices = block.choices;
      body.correctAnswer = block.correctAnswer;
      if ((block as { text?: string }).text) {
        body.content = markdownToTipTapString((block as { text: string }).text);
      }
      break;
    case 'question':
      // Pure quiz block (no surrounding text panel). Same multi-choice shape
      // as quiz-text minus body.content.
      body.question_md = markdownToTipTapString(block.question);
      body.choices = block.choices;
      body.correctAnswer = block.correctAnswer;
      break;
    case 'form':
    case 'email-form':
      body.fields = block.fields;
      if (block.submitLabel) body.submitLabel = block.submitLabel;
      if (block.successMessage) body.successMessage = block.successMessage;
      break;
    case 'form-text':
      body.content = markdownToTipTapString(block.content);
      body.fields = block.fields;
      body.submitLabel = block.submitLabel;
      body.successContent = markdownToTipTapString(block.successContent);
      break;
    case 'layout':
      body.ratio = block.ratio;
      break;
  }

  return {
    type: 'block',
    slug: uuidv4(),
    body: body as Record<string, unknown> & { format: string },
    lexoRank: rank,
  };
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

  const blockRanks = ranksFor(screen.blocks.length);
  screen.blocks.forEach((block, blockIdx) => {
    const compiled = compileBlock(block, blockRanks[blockIdx]);
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
  opts: { courseAuthor?: string; cardImageSvg?: string; iconSvg?: string } = {},
): Record<string, unknown> {
  if (isSimpleCourse(preset)) {
    const body: Record<string, unknown> = { flowType: 'simple', courseKey };
    if (opts.cardImageSvg) body.cardImageSvg = opts.cardImageSvg;
    if (opts.iconSvg) body.iconSvg = opts.iconSvg;
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
  return body;
}

/**
 * Read an agent-authored SVG file from the per-run workdir and return its raw
 * markup. Returns undefined when the file is missing or doesn't start with
 * <svg — assemble then proceeds without that field and the renderer falls
 * back to its default.
 */
function loadInlineSvg(workdir: string, name: string): string | undefined {
  const path = join(workdir, name);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw.startsWith('<svg')) return undefined;
  return raw;
}

/**
 * Convert an SVG markup string to a base64 data URI suitable for <img src>.
 */
function svgToDataUri(svg: string): string {
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
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
  const iconSvg = isSimpleCourse(preset) ? undefined : loadInlineSvg(inputs.workdir, 'course-icon.svg');
  const course: NodeExport = {
    type: 'course',
    title: inputs.plan.courseTitle,
    description: inputs.plan.intro ?? '',
    slug: uuidv4(),
    body: courseBodyFor(preset, inputs.productType.key, {
      courseAuthor: inputs.productType.courseAuthor,
      cardImageSvg,
      iconSvg,
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
  themeBlock.layout = inputs.theme.layout ?? { maxWidth: '1200px' };

  const flowBody: Record<string, unknown> = {
    product: spec.product,
    flowType: spec.flowType,
    productType: spec.productType,
    key: inputs.productType.key,
    theme: themeBlock,
  };
  if (spec.campaignType) flowBody.campaignType = spec.campaignType;

  // Propagate brand logo from the brief to the flow's headerLogo so the
  // app header + hub fall back to it when no per-hub logo is set.
  // Header logo + link. Priority:
  //   1. Clean SVG at <workdir>/logo.svg (written by /luly-style when brand exists)
  //      — inlined as base64 data URI; sets headerLogoLink to "/" so the logo
  //      links to the product's published root.
  //   2. brand.logo URL from intake — falls back to whatever the brand exposed.
  //   3. Neither — header falls back to default Luly mark.
  const logoSvg = loadInlineSvg(inputs.workdir, 'logo.svg');
  if (logoSvg) {
    flowBody.headerLogo = svgToDataUri(logoSvg);
    flowBody.headerLogoLink = '/';
  } else if (inputs.brief.brand?.logo) {
    flowBody.headerLogo = inputs.brief.brand.logo;
    flowBody.headerLogoLink = '/';
  }

  flowBody.locales = {
    supported: inputs.formatProfile.locales,
    default: inputs.formatProfile.locales[0],
  };

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
  const hubLogoUrl = logoSvg
    ? svgToDataUri(logoSvg)
    : (inputs.brief.brand?.logo ?? '');
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
  //   - cardImageSvg = wide 16:9 card cover (card-cover.svg)
  //   - iconSvg      = square 1:1 course icon (course-icon.svg)
  // Simple presets have no hub catalog → skip loading SVGs (defensive against
  // stale tmp artifacts from a previous run polluting a fresh generation).
  const courseIsSimple = isSimpleCourse(preset);
  const cardImageSvg = courseIsSimple ? undefined : loadInlineSvg(inputs.workdir, 'card-cover.svg');
  const iconSvg = courseIsSimple ? undefined : loadInlineSvg(inputs.workdir, 'course-icon.svg');
  const course: NodeExport = {
    type: 'course',
    title: courseTitle,
    description: courseDescription,
    slug: uuidv4(),
    body: courseBodyFor(preset, inputs.productType.key, {
      courseAuthor: inputs.productType.courseAuthor,
      cardImageSvg,
      iconSvg,
    }),
    controls: instantiateControls(inputs.controlsMap['course']),
    lexoRank: ranksFor(1)[0],
    children: [],
  };
  hub.children!.push(course);

  // Lessons — sectionType depends on course shape:
  //   simple course: single wrapper lesson, sectionType='default'
  //     (CMS opens directly inside the lesson editor)
  //   learning course: lessons are TOC entries, sectionType='lesson'
  const lessonRanks = ranksFor(inputs.lessons.length);
  inputs.lessons.forEach((lesson, lessonIdx) => {
    const sectionType = courseIsSimple ? 'default' : 'lesson';
    course.children!.push(buildLessonNode(lesson, lessonRanks[lessonIdx], inputs, sectionType));
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

function main(): void {
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

  const { brief, productType } = parseIntake(intakeMd);
  const { plan, formatProfile } = parsePlan(planMd);
  const theme = parseTheme(themeMd);
  const parsed = parseContent(contentMd);

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

  // Compute controls inline (replaces the old apply-controls + controls.json stage)
  const controlsArtifact = applyControls(productType.preset, plan);

  const isCourseOnly = productType.preset === 'academy-course';

  const root = isCourseOnly
    ? buildCourseOnly({ workdir, brief, productType, plan, formatProfile, theme, lessons, onboarding, controlsMap: controlsArtifact.controls, overrides: null })
    : buildFlow({ workdir, brief, productType, plan, formatProfile, theme, lessons, onboarding, controlsMap: controlsArtifact.controls, overrides: null });

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

main();
