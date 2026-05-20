import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';

const SCREEN_PATH_RE = /^lesson-(\d+)\.screen-(\d+)$/;
const BLOCK_PATH_RE = /^lesson-(\d+)\.screen-(\d+)\.block-(\d+)$/;
const ONBOARDING_SCREEN_RE = /^onboarding-(\d+)$/;
const ONBOARDING_BLOCK_RE = /^onboarding-(\d+)\.block-(\d+)$/;

function fail(msg: string): never {
  console.error(`\x1b[31m✖ overrides invalid:\x1b[0m ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`\x1b[32m✓ overrides ok:\x1b[0m ${msg}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

interface LessonShape { n: number; screens: { blocks: unknown[] }[] }

function loadLesson(workdir: string, n: number): LessonShape | null {
  const path = join(workdir, `lesson-${n}.json`);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return raw as LessonShape;
  } catch (err) {
    fail(`lesson-${n}.json could not be parsed: ${(err as Error).message}`);
  }
}

interface OnboardingShape { screens?: { blocks: unknown[] }[] }
function loadOnboarding(workdir: string): OnboardingShape | null {
  const path = join(workdir, 'onboarding.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as OnboardingShape;
  } catch {
    return null;
  }
}

function checkScreenPath(workdir: string, path: string, lessonCache: Map<number, LessonShape | null>, onboardingCache: { val?: OnboardingShape | null }): void {
  const onbMatch = path.match(ONBOARDING_SCREEN_RE);
  if (onbMatch) {
    const n = Number(onbMatch[1]);
    if (n < 1) fail(`screens["${path}"]: onboarding number must be ≥ 1`);
    if (onboardingCache.val === undefined) onboardingCache.val = loadOnboarding(workdir);
    if (!onboardingCache.val) fail(`screens["${path}"]: onboarding.json not found — onboarding-* paths require onboarding.json present`);
    const screens = onboardingCache.val.screens ?? [];
    if (n > screens.length) fail(`screens["${path}"]: onboarding.json has ${screens.length} screen(s), onboarding-${n} doesn't exist`);
    return;
  }
  const match = path.match(SCREEN_PATH_RE);
  if (!match) fail(`screens: path "${path}" does not match /^lesson-N.screen-M$/ or /^onboarding-N$/`);
  const lessonN = Number(match![1]);
  const screenM = Number(match![2]);
  if (lessonN < 1) fail(`screens["${path}"]: lesson number must be ≥ 1`);
  if (screenM < 1) fail(`screens["${path}"]: screen number must be ≥ 1`);

  if (!lessonCache.has(lessonN)) lessonCache.set(lessonN, loadLesson(workdir, lessonN));
  const lesson = lessonCache.get(lessonN);
  if (!lesson) fail(`screens["${path}"]: lesson-${lessonN}.json not found in ${workdir}`);
  if (!Array.isArray(lesson.screens)) fail(`screens["${path}"]: lesson-${lessonN}.json has no "screens" array`);
  if (screenM > lesson.screens.length) {
    fail(`screens["${path}"]: lesson ${lessonN} has only ${lesson.screens.length} screen(s), screen ${screenM} doesn't exist`);
  }
}

function checkBlockPath(workdir: string, path: string, lessonCache: Map<number, LessonShape | null>, onboardingCache: { val?: OnboardingShape | null }): void {
  const onbMatch = path.match(ONBOARDING_BLOCK_RE);
  if (onbMatch) {
    const n = Number(onbMatch[1]);
    const blockK = Number(onbMatch[2]);
    if (n < 1) fail(`blocks["${path}"]: onboarding number must be ≥ 1`);
    if (blockK < 0) fail(`blocks["${path}"]: block index must be ≥ 0`);
    if (onboardingCache.val === undefined) onboardingCache.val = loadOnboarding(workdir);
    if (!onboardingCache.val) fail(`blocks["${path}"]: onboarding.json not found`);
    const screens = onboardingCache.val.screens ?? [];
    if (n > screens.length) fail(`blocks["${path}"]: onboarding.json has ${screens.length} screen(s), onboarding-${n} doesn't exist`);
    const screen = screens[n - 1] as { blocks?: unknown[] };
    if (!screen || !Array.isArray(screen.blocks)) fail(`blocks["${path}"]: onboarding screen ${n} has no "blocks" array`);
    if (blockK >= screen.blocks!.length) fail(`blocks["${path}"]: onboarding screen ${n} has ${screen.blocks!.length} block(s), block index ${blockK} doesn't exist`);
    return;
  }
  const match = path.match(BLOCK_PATH_RE);
  if (!match) fail(`blocks: path "${path}" does not match /^lesson-N.screen-M.block-K$/ or /^onboarding-N.block-K$/`);
  const lessonN = Number(match![1]);
  const screenM = Number(match![2]);
  const blockK = Number(match![3]);
  if (lessonN < 1) fail(`blocks["${path}"]: lesson number must be ≥ 1`);
  if (screenM < 1) fail(`blocks["${path}"]: screen number must be ≥ 1`);
  if (blockK < 0) fail(`blocks["${path}"]: block index must be ≥ 0`);

  if (!lessonCache.has(lessonN)) lessonCache.set(lessonN, loadLesson(workdir, lessonN));
  const lesson = lessonCache.get(lessonN);
  if (!lesson) fail(`blocks["${path}"]: lesson-${lessonN}.json not found in ${workdir}`);
  if (!Array.isArray(lesson.screens)) fail(`blocks["${path}"]: lesson-${lessonN}.json has no "screens" array`);
  if (screenM > lesson.screens.length) {
    fail(`blocks["${path}"]: lesson ${lessonN} has only ${lesson.screens.length} screen(s), screen ${screenM} doesn't exist`);
  }
  const screen = lesson.screens[screenM - 1];
  if (!screen || !Array.isArray((screen as any).blocks)) {
    fail(`blocks["${path}"]: screen ${screenM} of lesson ${lessonN} has no "blocks" array`);
  }
  const blocks = (screen as any).blocks as unknown[];
  if (blockK >= blocks.length) {
    fail(`blocks["${path}"]: screen ${screenM} of lesson ${lessonN} has ${blocks.length} block(s), block index ${blockK} doesn't exist`);
  }
}

function validateScreenOverride(path: string, raw: unknown): void {
  if (!isPlainObject(raw)) fail(`screens["${path}"]: must be a plain object`);
  const allowed = new Set(['style', 'controlStyle']);
  const extra = Object.keys(raw).filter(k => !allowed.has(k));
  if (extra.length > 0) {
    fail(`screens["${path}"]: unknown key(s) ${extra.join(', ')} (allowed: style, controlStyle)`);
  }
  if (raw.style !== undefined && !isPlainObject(raw.style)) fail(`screens["${path}"].style: must be an object`);
  if (raw.controlStyle !== undefined && !isPlainObject(raw.controlStyle)) fail(`screens["${path}"].controlStyle: must be an object`);
}

function validateBlockOverride(path: string, raw: unknown): void {
  if (!isPlainObject(raw)) fail(`blocks["${path}"]: must be a plain object`);
  const allowed = new Set(['style']);
  const extra = Object.keys(raw).filter(k => !allowed.has(k));
  if (extra.length > 0) {
    fail(`blocks["${path}"]: unknown key(s) ${extra.join(', ')} (allowed: style only — controlStyle is for screens, not blocks)`);
  }
  if (!isPlainObject(raw.style)) fail(`blocks["${path}"].style: must be an object`);
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/overrides.json');
  if (!existsSync(inputPath)) fail(`file not found: ${inputPath}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${inputPath}: ${(err as Error).message}`);
  }

  if (!isPlainObject(raw)) fail('top-level value is not a JSON object');

  const allowed = new Set(['screens', 'blocks']);
  const extra = Object.keys(raw).filter(k => !allowed.has(k));
  if (extra.length > 0) {
    fail(`unknown top-level key(s): ${extra.join(', ')} (allowed: screens, blocks)`);
  }

  const workdir = dirname(inputPath);
  const lessonCache = new Map<number, LessonShape | null>();
  const onboardingCache: { val?: OnboardingShape | null } = {};

  const screenPaths: string[] = [];
  const blockPaths: string[] = [];

  if (raw.screens !== undefined) {
    if (!isPlainObject(raw.screens)) fail('"screens" must be an object');
    for (const [path, override] of Object.entries(raw.screens)) {
      checkScreenPath(workdir, path, lessonCache, onboardingCache);
      validateScreenOverride(path, override);
      screenPaths.push(path);
    }
  }
  if (raw.blocks !== undefined) {
    if (!isPlainObject(raw.blocks)) fail('"blocks" must be an object');
    for (const [path, override] of Object.entries(raw.blocks)) {
      checkBlockPath(workdir, path, lessonCache, onboardingCache);
      validateBlockOverride(path, override);
      blockPaths.push(path);
    }
  }

  ok(`${inputPath}`);
  console.log(`  screen overrides: ${screenPaths.length}`);
  for (const p of screenPaths) console.log(`    - ${p}`);
  console.log(`  block overrides:  ${blockPaths.length}`);
  for (const p of blockPaths) console.log(`    - ${p}`);
  if (screenPaths.length + blockPaths.length === 0) {
    console.log(`  (overrides file is empty — stage 9 will skip the overrides layer)`);
  }
}

main();
