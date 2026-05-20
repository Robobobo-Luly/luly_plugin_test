import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { PRESET_VALUES } from './presets';
import {
  ACTION_VOCAB,
  GOTO_VOCAB,
  GUARD_VOCAB,
  type Control,
  type ControlsArtifact,
} from './controls-presets';

const PATH_FIXED = new Set(['flow', 'hub', 'course']);
const PATH_LESSON_RE = /^lesson-(\d+)$/;
const PATH_SCREEN_RE = /^lesson-(\d+)\.screen-(\d+)$/;
const PATH_ONBOARDING_RE = /^onboarding-(\d+)$/;

function fail(msg: string): never {
  console.error(`\x1b[31m✖ controls invalid:\x1b[0m ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`\x1b[32m✓ controls ok:\x1b[0m ${msg}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

interface LessonShape { n: number; screens: { blocks: unknown[] }[] }
function loadLesson(workdir: string, n: number): LessonShape | null {
  const path = join(workdir, `lesson-${n}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LessonShape;
  } catch (err) {
    fail(`lesson-${n}.json could not be parsed: ${(err as Error).message}`);
  }
}

const CONTROL_KEYS = new Set([
  'id', 'slug', 'label', 'position', 'requires_click',
  'is_visible', 'is_enabled', 'style', 'styleName',
  'conditionalActions',
]);

function checkAction(action: unknown, ctx: string): void {
  if (!isPlainObject(action)) fail(`${ctx}: action is not an object`);
  if (!isNonEmptyString(action.type) || !(ACTION_VOCAB as readonly string[]).includes(action.type)) {
    fail(`${ctx}: "type" must be one of: ${ACTION_VOCAB.join(', ')}`);
  }
  if (action.body !== undefined && !isPlainObject(action.body)) {
    fail(`${ctx}: "body" must be an object`);
  }
  if (action.type === 'goto') {
    const body = (action.body ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(body.target) || !(GOTO_VOCAB as readonly string[]).includes(body.target as string)) {
      fail(`${ctx}: goto.body.target must be one of: ${GOTO_VOCAB.join(', ')}`);
    }
    if (body.target === 'specific_content' && !isNonEmptyString(body.slug)) {
      fail(`${ctx}: goto with target=specific_content requires body.slug`);
    }
  }
  if (action.type === 'externalLink') {
    const body = (action.body ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(body.url)) fail(`${ctx}: externalLink requires body.url`);
  }
  const knownActionKeys = new Set(['type', 'body']);
  const extraAction = Object.keys(action).filter(k => !knownActionKeys.has(k));
  if (extraAction.length > 0) fail(`${ctx}: unknown action key(s): ${extraAction.join(', ')}`);
}

function checkGuard(guard: unknown, ctx: string): void {
  if (!isPlainObject(guard)) fail(`${ctx}: guard is not an object`);
  if (!isNonEmptyString(guard.name) || !(GUARD_VOCAB as readonly string[]).includes(guard.name)) {
    fail(`${ctx}: guard.name "${guard.name}" not in vocabulary (allowed: ${GUARD_VOCAB.join(', ')})`);
  }
  if (guard.args !== undefined && !Array.isArray(guard.args)) fail(`${ctx}: guard.args must be an array`);
  const knownGuardKeys = new Set(['name', 'args']);
  const extra = Object.keys(guard).filter(k => !knownGuardKeys.has(k));
  if (extra.length > 0) fail(`${ctx}: unknown guard key(s): ${extra.join(', ')}`);
}

function checkControl(ctrl: unknown, ctx: string): void {
  if (!isPlainObject(ctrl)) fail(`${ctx}: control is not an object`);
  if (!isNonEmptyString(ctrl.id)) fail(`${ctx}: control "id" must be a non-empty string`);
  if (!Array.isArray(ctrl.conditionalActions) || ctrl.conditionalActions.length === 0) {
    fail(`${ctx}: "conditionalActions" must be a non-empty array`);
  }

  const extra = Object.keys(ctrl).filter(k => !CONTROL_KEYS.has(k));
  if (extra.length > 0) fail(`${ctx}: unknown control key(s): ${extra.join(', ')}`);

  let fallbackIndex = -1;
  for (const [i, ca] of (ctrl.conditionalActions as unknown[]).entries()) {
    const caCtx = `${ctx} conditionalActions[${i}]`;
    if (!isPlainObject(ca)) fail(`${caCtx}: not an object`);
    if (!Array.isArray((ca as any).do) || ((ca as any).do as unknown[]).length === 0) {
      fail(`${caCtx}: "do" must be a non-empty array`);
    }
    if ((ca as any).guard !== undefined && (ca as any).guard !== null) {
      checkGuard((ca as any).guard, `${caCtx}.guard`);
    } else {
      if (fallbackIndex !== -1) {
        fail(`${ctx}: multiple fallback clauses (no guard) — at most one allowed`);
      }
      fallbackIndex = i;
    }
    for (const [j, a] of ((ca as any).do as unknown[]).entries()) {
      checkAction(a, `${caCtx}.do[${j}]`);
    }
    const caKnown = new Set(['guard', 'do']);
    const caExtra = Object.keys(ca).filter(k => !caKnown.has(k));
    if (caExtra.length > 0) fail(`${caCtx}: unknown key(s): ${caExtra.join(', ')}`);
  }
  if (fallbackIndex !== -1 && fallbackIndex !== (ctrl.conditionalActions as unknown[]).length - 1) {
    fail(`${ctx}: fallback clause (no guard) at index ${fallbackIndex} must be last`);
  }

  if (ctrl.position !== undefined && !isNonEmptyString(ctrl.position)) {
    fail(`${ctx}: "position" must be a string if present`);
  }
  if (ctrl.label !== undefined && !isNonEmptyString(ctrl.label)) {
    fail(`${ctx}: "label" must be a non-empty string if present`);
  }
  if (ctrl.requires_click !== undefined && typeof ctrl.requires_click !== 'boolean') {
    fail(`${ctx}: "requires_click" must be a boolean if present`);
  }
}

interface PlanShape { onboarding?: { n: number }[] }
function loadPlanOnboarding(workdir: string): { n: number }[] {
  const path = resolve(workdir, 'plan.parsed.json');
  if (!existsSync(path)) return [];
  try {
    const p = JSON.parse(readFileSync(path, 'utf8')) as PlanShape;
    return p.onboarding ?? [];
  } catch {
    return [];
  }
}

function checkPathKey(workdir: string, key: string, lessonCache: Map<number, LessonShape | null>, onboardingCount: number): void {
  if (PATH_FIXED.has(key)) return;
  const onboardingMatch = key.match(PATH_ONBOARDING_RE);
  if (onboardingMatch) {
    const n = Number(onboardingMatch[1]);
    if (n < 1) fail(`controls["${key}"]: onboarding number must be ≥ 1`);
    if (n > onboardingCount) {
      fail(`controls["${key}"]: plan.parsed.json has ${onboardingCount} onboarding screen(s), onboarding-${n} doesn't exist`);
    }
    return;
  }
  const lessonMatch = key.match(PATH_LESSON_RE);
  if (lessonMatch) {
    const n = Number(lessonMatch[1]);
    if (n < 1) fail(`controls["${key}"]: lesson number must be ≥ 1`);
    if (!lessonCache.has(n)) lessonCache.set(n, loadLesson(workdir, n));
    if (!lessonCache.get(n)) fail(`controls["${key}"]: lesson-${n}.json not found in ${workdir}`);
    return;
  }
  const screenMatch = key.match(PATH_SCREEN_RE);
  if (screenMatch) {
    const lessonN = Number(screenMatch[1]);
    const screenM = Number(screenMatch[2]);
    if (lessonN < 1 || screenM < 1) fail(`controls["${key}"]: lesson and screen numbers must be ≥ 1`);
    if (!lessonCache.has(lessonN)) lessonCache.set(lessonN, loadLesson(workdir, lessonN));
    const lesson = lessonCache.get(lessonN);
    if (!lesson) fail(`controls["${key}"]: lesson-${lessonN}.json not found in ${workdir}`);
    if (!Array.isArray(lesson!.screens)) fail(`controls["${key}"]: lesson-${lessonN}.json has no "screens" array`);
    if (screenM > lesson!.screens.length) {
      fail(`controls["${key}"]: lesson ${lessonN} has only ${lesson!.screens.length} screen(s), screen ${screenM} doesn't exist`);
    }
    return;
  }
  fail(`controls: path key "${key}" must be one of "flow"|"hub"|"course"|"onboarding-N"|"lesson-N"|"lesson-N.screen-M"`);
}

function validate(raw: unknown, workdir: string): ControlsArtifact {
  if (!isPlainObject(raw)) fail('top-level value is not a JSON object');

  if (!isNonEmptyString(raw.preset) || !(PRESET_VALUES as readonly string[]).includes(raw.preset)) {
    fail(`"preset" must be one of: ${PRESET_VALUES.join(', ')}`);
  }
  if (!isPlainObject(raw.controls)) fail('"controls" must be an object');

  const topKnown = new Set(['preset', 'controls']);
  const topExtra = Object.keys(raw).filter(k => !topKnown.has(k));
  if (topExtra.length > 0) fail(`unknown top-level key(s): ${topExtra.join(', ')}`);

  const lessonCache = new Map<number, LessonShape | null>();
  const onboardingCount = loadPlanOnboarding(workdir).length;
  for (const [path, ctrlList] of Object.entries(raw.controls)) {
    checkPathKey(workdir, path, lessonCache, onboardingCount);
    if (!Array.isArray(ctrlList) || ctrlList.length === 0) {
      fail(`controls["${path}"]: must be a non-empty array of controls`);
    }
    for (const [i, ctrl] of ctrlList.entries()) {
      checkControl(ctrl, `controls["${path}"][${i}]`);
    }
  }

  return raw as unknown as ControlsArtifact;
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/controls.json');
  if (!existsSync(inputPath)) fail(`file not found: ${inputPath}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${inputPath}: ${(err as Error).message}`);
  }

  const workdir = dirname(inputPath);
  const artifact = validate(raw, workdir);

  let totalControls = 0;
  for (const list of Object.values(artifact.controls)) totalControls += list.length;
  ok(`${inputPath}`);
  console.log(`  preset       = ${artifact.preset}`);
  console.log(`  paths        = ${Object.keys(artifact.controls).length}`);
  console.log(`  total ctrls  = ${totalControls}`);
  for (const [path, list] of Object.entries(artifact.controls)) {
    const labels = (list as Control[]).map(c => c.label ?? c.id.split('.').slice(-1)[0]).join(', ');
    console.log(`    ${path.padEnd(28)} ${list.length}× [${labels}]`);
  }
}

main();
