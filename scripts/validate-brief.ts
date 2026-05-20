import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Brief, LengthHint } from './types';

const VALID_LENGTH: LengthHint[] = ['quick', 'standard', 'long'];

function fail(message: string): never {
  console.error(`\x1b[31m✖ brief invalid:\x1b[0m ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`\x1b[32m✓ brief ok:\x1b[0m ${message}`);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function validate(raw: unknown): Brief {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('top-level value is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  if (!isNonEmptyString(obj.intent)) fail('"intent" must be a non-empty string');
  if (!isNonEmptyString(obj.audience)) fail('"audience" must be a non-empty string');
  if (!isNonEmptyString(obj.tone)) fail('"tone" must be a non-empty string');

  if (!isNonEmptyString(obj.lengthHint) || !VALID_LENGTH.includes(obj.lengthHint as LengthHint)) {
    fail(`"lengthHint" must be one of: ${VALID_LENGTH.join(', ')}`);
  }

  if (!Array.isArray(obj.materials)) fail('"materials" must be an array (can be empty)');
  for (const [i, m] of (obj.materials as unknown[]).entries()) {
    if (!isNonEmptyString(m)) fail(`"materials[${i}]" must be a non-empty string`);
  }

  const knownKeys = new Set(['intent', 'audience', 'tone', 'lengthHint', 'materials']);
  const extra = Object.keys(obj).filter((k) => !knownKeys.has(k));
  if (extra.length > 0) {
    fail(`unknown field(s): ${extra.join(', ')} (allowed: ${[...knownKeys].join(', ')})`);
  }

  return obj as unknown as Brief;
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/brief.json');

  if (!existsSync(inputPath)) {
    fail(`file not found: ${inputPath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${inputPath}: ${(err as Error).message}`);
  }

  const brief = validate(raw);
  ok(`${inputPath} — intent="${brief.intent.slice(0, 60)}${brief.intent.length > 60 ? '…' : ''}", lengthHint=${brief.lengthHint}, materials=${brief.materials.length}`);
}

main();
