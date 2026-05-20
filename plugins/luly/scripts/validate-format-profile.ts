import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { FormatProfile, QuizDensity, ScreenMode } from './types';

const SCREEN_MODES: ScreenMode[] = ['story', 'responsive'];
const QUIZ_DENSITIES: QuizDensity[] = ['low', 'medium', 'high'];
const LOCALE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;

function fail(message: string): never {
  console.error(`\x1b[31m✖ format-profile invalid:\x1b[0m ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`\x1b[32m✓ format-profile ok:\x1b[0m ${message}`);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function validate(raw: unknown): FormatProfile {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('top-level value is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.screenMode !== 'string' || !(SCREEN_MODES as string[]).includes(obj.screenMode)) {
    fail(`"screenMode" must be one of: ${SCREEN_MODES.join(', ')}`);
  }
  if (!isBoolean(obj.allowQuiz)) fail('"allowQuiz" must be a boolean');
  if (!isBoolean(obj.allowMedia)) fail('"allowMedia" must be a boolean');
  if (!isBoolean(obj.allowLayout)) fail('"allowLayout" must be a boolean');
  if (!isBoolean(obj.allowForm)) fail('"allowForm" must be a boolean');

  const hasDensity = Object.prototype.hasOwnProperty.call(obj, 'quizDensity');
  if (obj.allowQuiz === true) {
    if (!hasDensity) fail('"quizDensity" is required when allowQuiz is true');
    if (typeof obj.quizDensity !== 'string' || !(QUIZ_DENSITIES as string[]).includes(obj.quizDensity)) {
      fail(`"quizDensity" must be one of: ${QUIZ_DENSITIES.join(', ')}`);
    }
  } else {
    if (hasDensity) fail('"quizDensity" must be omitted when allowQuiz is false');
  }

  if (obj.allowLayout === true && obj.screenMode === 'story') {
    fail('"allowLayout" cannot be true when screenMode is "story" (layout blocks need responsive mode)');
  }

  if (!Array.isArray(obj.locales)) fail('"locales" must be a non-empty array');
  if ((obj.locales as unknown[]).length === 0) fail('"locales" must contain at least one entry');
  for (const [i, code] of (obj.locales as unknown[]).entries()) {
    if (typeof code !== 'string' || !LOCALE_RE.test(code)) {
      fail(`"locales[${i}]" = ${JSON.stringify(code)} — must match /^[a-z]{2}(-[A-Z]{2})?$/ (e.g. "en", "en-US")`);
    }
  }

  const knownKeys = new Set(['screenMode', 'allowQuiz', 'quizDensity', 'allowMedia', 'allowLayout', 'allowForm', 'locales']);
  const extra = Object.keys(obj).filter((k) => !knownKeys.has(k));
  if (extra.length > 0) {
    fail(`unknown field(s): ${extra.join(', ')} (allowed: ${[...knownKeys].join(', ')})`);
  }

  return obj as unknown as FormatProfile;
}

function unlockedBlockFormats(fp: FormatProfile): string[] {
  const formats: string[] = ['richtext'];
  if (fp.allowMedia) formats.push('image', 'image-richtext', 'video');
  if (fp.allowQuiz) formats.push('quiz-text', 'question');
  if (fp.allowLayout) formats.push('layout');
  if (fp.allowForm) formats.push('form', 'email-form', 'form-text');
  return formats;
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/format-profile.json');

  if (!existsSync(inputPath)) {
    fail(`file not found: ${inputPath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${inputPath}: ${(err as Error).message}`);
  }

  const fp = validate(raw);
  ok(`${inputPath}`);
  console.log(`  screenMode    = ${fp.screenMode}`);
  console.log(`  allowQuiz     = ${fp.allowQuiz}${fp.allowQuiz ? ` (density = ${fp.quizDensity})` : ''}`);
  console.log(`  allowMedia    = ${fp.allowMedia}`);
  console.log(`  allowLayout   = ${fp.allowLayout}`);
  console.log(`  allowForm     = ${fp.allowForm}`);
  console.log(`  locales       = [${fp.locales.join(', ')}]`);
  console.log(`  → block formats unlocked for stage 4:`);
  console.log(`      ${unlockedBlockFormats(fp).join(', ')}`);
}

main();
