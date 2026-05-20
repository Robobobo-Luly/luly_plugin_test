import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { LexoRank } from 'lexorank';
import { PRESETS } from './presets';
import { applyControls } from './controls-presets';
import { markdownToTipTapString } from './markdown-to-tiptap';
import type {
  BlockExport,
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

function readJson<T>(path: string, label: string): T {
  if (!existsSync(path)) fail(`${label} not found at ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (err) {
    fail(`could not parse ${label}: ${(err as Error).message}`);
  }
}

function readJsonOptional<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
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
  opts: { courseAuthor?: string; cardImageUrl?: string } = {},
): Record<string, unknown> {
  if (isSimpleCourse(preset)) {
    const body: Record<string, unknown> = { flowType: 'simple', courseKey };
    if (opts.cardImageUrl) body.cardImageUrl = opts.cardImageUrl;
    return body;
  }
  const body: Record<string, unknown> = {
    author: opts.courseAuthor ?? '',
    flowType: 'learning',
    courseKey,
    sequentialLessons: true,
  };
  if (opts.cardImageUrl) body.cardImageUrl = opts.cardImageUrl;
  return body;
}

/**
 * Synthesise a simple SVG data-URI for a course card. Uses the theme primary as
 * the background and renders the course title in textOnPrimary. Gives the
 * catalog card a branded look without requiring real asset upload.
 */
function buildCourseCardSvg(title: string, primary: string, textOnPrimary: string): string {
  // Keep the title within roughly 4 lines × 18 chars before truncating
  const safe = title.length > 70 ? title.slice(0, 67) + '…' : title;
  // Split into lines roughly every 22 chars at word boundary
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (current.length + 1 + w.length > 22) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = current ? `${current} ${w}` : w;
    }
    if (lines.length >= 3) break;
  }
  if (current && lines.length < 4) lines.push(current);
  const tspans = lines.map((l, i) => `<tspan x="48" dy="${i === 0 ? 0 : 44}">${escapeXml(l)}</tspan>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${primary}" stop-opacity="0.78"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><text x="48" y="142" fill="${textOnPrimary}" font-family="Inter, sans-serif" font-size="36" font-weight="700">${tspans}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
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
  const cardImageUrl = buildCourseCardSvg(
    inputs.plan.courseTitle,
    inputs.theme.colors.primary,
    inputs.theme.colors.textOnPrimary,
  );
  const course: NodeExport = {
    type: 'course',
    title: inputs.plan.courseTitle,
    description: inputs.plan.intro ?? '',
    slug: uuidv4(),
    body: courseBodyFor(preset, inputs.productType.key, {
      courseAuthor: inputs.productType.courseAuthor,
      cardImageUrl,
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
  if (inputs.theme.layout) themeBlock.layout = inputs.theme.layout;

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
  if (inputs.brief.brand?.logo) {
    flowBody.headerLogo = inputs.brief.brand.logo;
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
  const hubLogoUrl = inputs.brief.brand?.logo ?? '';
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
  //   simple courses  → { flowType: 'simple', courseKey, cardImageUrl? }
  //   learning courses → { author, flowType: 'learning', courseKey, sequentialLessons, cardImageUrl? }
  const courseIsSimple = isSimpleCourse(preset);
  const cardImageUrl = buildCourseCardSvg(
    courseTitle,
    inputs.theme.colors.primary,
    inputs.theme.colors.textOnPrimary,
  );
  const course: NodeExport = {
    type: 'course',
    title: courseTitle,
    description: courseDescription,
    slug: uuidv4(),
    body: courseBodyFor(preset, inputs.productType.key, {
      courseAuthor: inputs.productType.courseAuthor,
      cardImageUrl,
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

function main(): void {
  const workdir = resolve(process.cwd(), 'tmp/luly-agent');
  if (!existsSync(workdir)) fail(`workdir not found: ${workdir}`);

  const productType = readJson<ProductType>(join(workdir, 'product-type.json'), 'product-type.json');
  const plan = readJson<Plan>(join(workdir, 'plan.parsed.json'), 'plan.parsed.json');
  const formatProfile = readJson<FormatProfile>(join(workdir, 'format-profile.json'), 'format-profile.json');
  const theme = readJson<ThemeArtifact>(join(workdir, 'theme.json'), 'theme.json');
  const controlsArtifact = readJson<{ preset: string; controls: Record<string, Control[]> }>(
    join(workdir, 'controls.json'),
    'controls.json'
  );
  const overrides = readJsonOptional<OverridesArtifact>(join(workdir, 'overrides.json'));

  const lessonFiles = readdirSync(workdir).filter((f) => /^lesson-\d+\.json$/.test(f));
  if (lessonFiles.length === 0) fail(`no lesson-*.json files in ${workdir}`);
  const lessons: Lesson[] = lessonFiles
    .map((f) => Number(f.match(/^lesson-(\d+)\.json$/)![1]))
    .sort((a, b) => a - b)
    .map((n) => readJson<Lesson>(join(workdir, `lesson-${n}.json`), `lesson-${n}.json`));

  const planLessons = plan.lessons.map((l) => l.n);
  const presentLessons = new Set(lessons.map((l) => l.n));
  const missing = planLessons.filter((n) => !presentLessons.has(n));
  if (missing.length > 0) {
    fail(
      `plan has ${planLessons.length} lesson(s) but lesson(s) [${missing.join(', ')}] not yet filled — ` +
      `run /luly-fill-lesson before assembling`
    );
  }

  // Academy-course doesn't carry onboarding (lives on the parent academy)
  if (productType.preset === 'academy-course' && plan.onboarding && plan.onboarding.length > 0) {
    fail(
      'academy-course preset does not support onboarding screens — onboarding lives on the parent academy. ' +
      'Remove the "## Onboarding" section from plan.md and re-run /luly-plan.'
    );
  }

  // Onboarding is conditional: required iff plan declares an onboarding section
  const onboardingPath = join(workdir, 'onboarding.json');
  let onboarding: OnboardingArtifact | null = null;
  if (plan.onboarding && plan.onboarding.length > 0) {
    if (!existsSync(onboardingPath)) {
      fail(
        `plan declares ${plan.onboarding.length} onboarding screen(s) but onboarding.json not found — ` +
        `run /luly-fill-onboarding before assembling`
      );
    }
    onboarding = readJson<OnboardingArtifact>(onboardingPath, 'onboarding.json');
    if (onboarding.screens.length !== plan.onboarding.length) {
      fail(
        `onboarding.json has ${onboarding.screens.length} screen(s) but plan declares ${plan.onboarding.length} — ` +
        `re-run /luly-fill-onboarding`
      );
    }
  } else if (existsSync(onboardingPath)) {
    // Onboarding artifact exists but plan doesn't declare it — ignore silently with a warning
    console.log(`\x1b[33m⚠ assemble:\x1b[0m onboarding.json exists but plan.parsed.json has no onboarding section — skipping`);
  }

  const isCourseOnly = productType.preset === 'academy-course';

  const root = isCourseOnly
    ? buildCourseOnly({ productType, plan, formatProfile, theme, lessons, onboarding, controlsMap: controlsArtifact.controls, overrides })
    : buildFlow({ productType, plan, formatProfile, theme, lessons, onboarding, controlsMap: controlsArtifact.controls, overrides });

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
  console.log(`  overrides applied  = ${overrides ? 'yes' : 'no'}`);
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
