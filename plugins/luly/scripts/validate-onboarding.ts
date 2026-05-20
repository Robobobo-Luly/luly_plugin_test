import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { FormatProfile, OnboardingArtifact, Plan } from './types';
import {
  ValidationError,
  allowedFormats,
  isNonEmptyString,
  loadFormatProfile,
  need,
  validateScreen,
} from './block-validation';

function red(s: string): string { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }

function fail(msg: string): never {
  console.error(`${red('✖ onboarding invalid:')} ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`${green('✓ onboarding ok:')} ${msg}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function loadPlanOnboarding(workdir: string): { n: number; synopsis: string }[] {
  const path = resolve(workdir, 'plan.parsed.json');
  if (!existsSync(path)) {
    throw new ValidationError(`sibling plan.parsed.json not found at ${path} — run /luly-plan first`);
  }
  const plan = JSON.parse(readFileSync(path, 'utf8')) as Plan;
  return plan.onboarding ?? [];
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/onboarding.json');
  if (!existsSync(inputPath)) fail(`file not found: ${inputPath}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${inputPath}: ${(err as Error).message}`);
  }

  const workdir = dirname(inputPath);
  let fp: FormatProfile;
  let planOnboarding: { n: number; synopsis: string }[];
  try {
    fp = loadFormatProfile(workdir);
    planOnboarding = loadPlanOnboarding(workdir);
  } catch (err) {
    fail((err as Error).message);
  }

  if (planOnboarding.length === 0) {
    fail(`plan.parsed.json has no onboarding screens — remove onboarding.json or add an "## Onboarding" section to plan.md`);
  }

  try {
    if (!isPlainObject(raw)) throw new ValidationError('top-level value is not a JSON object');
    const obj = raw as Record<string, unknown>;
    const knownKeys = new Set(['screens']);
    const extra = Object.keys(obj).filter((k) => !knownKeys.has(k));
    if (extra.length > 0) throw new ValidationError(`unknown top-level key(s): ${extra.join(', ')} (allowed: screens)`);
    if (!Array.isArray(obj.screens) || obj.screens.length === 0) {
      throw new ValidationError('"screens" must be a non-empty array');
    }
    if (obj.screens.length !== planOnboarding.length) {
      throw new ValidationError(`screen count ${obj.screens.length} doesn't match plan.onboarding count ${planOnboarding.length}`);
    }

    const allowed = allowedFormats(fp);
    const summary: string[] = [];
    for (const [i, s] of (obj.screens as unknown[]).entries()) {
      const result = validateScreen(s, 'onboarding', i + 1, allowed, fp);
      summary.push(`  screen ${result.n} "${result.title}": ${result.blockFormats.join(', ')}`);
    }

    const out = obj as unknown as OnboardingArtifact;
    ok(`${inputPath}`);
    console.log(`  screens      = ${out.screens.length}`);
    for (const line of summary) console.log(line);
  } catch (err) {
    if (err instanceof ValidationError) fail(`${inputPath}: ${err.message}`);
    throw err;
  }
}

main();
