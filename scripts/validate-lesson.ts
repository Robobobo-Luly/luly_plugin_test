import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import type { FormatProfile, Lesson } from './types';
import {
  ValidationError,
  allowedFormats,
  isNonEmptyString,
  isPositiveInt,
  loadFormatProfile,
  need,
  validateScreen,
} from './block-validation';

const LESSON_FILE_RE = /^lesson-(\d+)\.json$/;

function red(msg: string): string { return `\x1b[31m${msg}\x1b[0m`; }
function green(msg: string): string { return `\x1b[32m${msg}\x1b[0m`; }

function validateLesson(raw: unknown, fp: FormatProfile): Lesson {
  need(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'top-level value is not a JSON object');
  const l = raw as Record<string, unknown>;
  need(isPositiveInt(l.n), '"n" must be a positive integer');
  need(l.title === null || isNonEmptyString(l.title), '"title" must be a non-empty string or null (screens-only)');
  need(Array.isArray(l.screens) && l.screens.length >= 1, '"screens" must be a non-empty array');

  const knownKeys = new Set(['n', 'title', 'screens']);
  const extra = Object.keys(l).filter((k) => !knownKeys.has(k));
  need(extra.length === 0, `unknown top-level key(s): ${extra.join(', ')}`);

  const allowed = allowedFormats(fp);
  for (const [i, s] of (l.screens as unknown[]).entries()) {
    validateScreen(s, `lesson ${l.n}`, i + 1, allowed, fp);
  }

  return l as unknown as Lesson;
}

function validateFile(inputPath: string, workdir: string): { ok: boolean; message: string; summary?: string[] } {
  if (!existsSync(inputPath)) {
    return { ok: false, message: `file not found: ${inputPath}` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    return { ok: false, message: `invalid JSON in ${inputPath}: ${(err as Error).message}` };
  }
  let fp: FormatProfile;
  try {
    fp = loadFormatProfile(workdir);
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  try {
    const lesson = validateLesson(raw, fp);
    const summary: string[] = [];
    summary.push(`lesson ${lesson.n} "${lesson.title ?? '(implicit)'}" — ${lesson.screens.length} screens`);
    for (const screen of lesson.screens) {
      const formats = screen.blocks.map((b) => b.format).join(', ');
      summary.push(`  screen ${screen.n} "${screen.title}": ${formats}`);
    }
    return { ok: true, message: inputPath, summary };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, message: `${inputPath}: ${err.message}` };
    throw err;
  }
}

function main(): void {
  const arg = process.argv[2];

  if (arg === '--all') {
    const workdir = resolve(process.cwd(), 'tmp/luly-agent');
    if (!existsSync(workdir)) {
      console.error(red(`✖ lesson invalid: workdir not found: ${workdir}`));
      process.exit(1);
    }
    const files = readdirSync(workdir)
      .filter((f) => LESSON_FILE_RE.test(f))
      .sort((a, b) => Number(a.match(LESSON_FILE_RE)![1]) - Number(b.match(LESSON_FILE_RE)![1]));
    if (files.length === 0) {
      console.error(red(`✖ lesson invalid: no lesson-*.json files in ${workdir}`));
      process.exit(1);
    }
    let allOk = true;
    for (const f of files) {
      const result = validateFile(resolve(workdir, f), workdir);
      if (result.ok) {
        console.log(green(`✓ lesson ok:`) + ` ${f}`);
        if (result.summary) for (const line of result.summary.slice(1)) console.log(line);
      } else {
        console.error(red(`✖ lesson invalid:`) + ` ${result.message}`);
        allOk = false;
      }
    }
    console.log(`\n${allOk ? green('all lessons valid') : red('one or more lessons invalid')} (${files.length} file${files.length === 1 ? '' : 's'})`);
    process.exit(allOk ? 0 : 1);
  }

  const inputPath = resolve(process.cwd(), arg ?? 'tmp/luly-agent/lesson-1.json');
  const workdir = dirname(inputPath);
  const result = validateFile(inputPath, workdir);
  if (result.ok) {
    console.log(green(`✓ lesson ok:`) + ` ${result.message}`);
    if (result.summary) for (const line of result.summary) console.log(`  ${line}`);
    process.exit(0);
  }
  console.error(red(`✖ lesson invalid:`) + ` ${result.message}`);
  process.exit(1);
}

main();
