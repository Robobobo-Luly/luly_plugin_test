import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { ProductType } from './types';
import { PRESETS, PRESET_VALUES, type Preset } from './presets';

const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY_MIN = 3;
const KEY_MAX = 50;

function fail(message: string): never {
  console.error(`\x1b[31m✖ product-type invalid:\x1b[0m ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`\x1b[32m✓ product-type ok:\x1b[0m ${message}`);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function validate(raw: unknown): ProductType {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('top-level value is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  if (!isNonEmptyString(obj.preset) || !(PRESET_VALUES as readonly string[]).includes(obj.preset)) {
    fail(`"preset" must be one of: ${PRESET_VALUES.join(', ')}`);
  }
  if (!isNonEmptyString(obj.key)) {
    fail('"key" must be a non-empty string');
  }
  if (obj.key.length < KEY_MIN || obj.key.length > KEY_MAX) {
    fail(`"key" length must be ${KEY_MIN}..${KEY_MAX} (got ${obj.key.length})`);
  }
  if (!KEY_RE.test(obj.key)) {
    fail(`"key" must match /^[a-z0-9]+(-[a-z0-9]+)*$/ (lowercase kebab-case, no leading/trailing/double hyphen)`);
  }
  if (!isNonEmptyString(obj.rationale)) {
    fail('"rationale" must be a non-empty string');
  }

  // Academy preset: academyName REQUIRED. The plan.md H1 is the first course name
  // (e.g. "What is Blockchain"); academyName is the separate workspace/hub title
  // (e.g. "Blockchain Academy"). Without this, flow + hub + course all collapse
  // to the same string.
  if (obj.preset === 'academy') {
    if (!isNonEmptyString(obj.academyName)) {
      fail('"academyName" is required when preset = "academy" — it is the workspace and hub title (the plan H1 represents the FIRST COURSE name)');
    }
    if (obj.academyDescription !== undefined && !isNonEmptyString(obj.academyDescription)) {
      fail('"academyDescription" if present must be a non-empty string');
    }
  } else {
    if (obj.academyName !== undefined) {
      fail(`"academyName" is only valid when preset = "academy" (got preset = "${obj.preset}")`);
    }
    if (obj.academyDescription !== undefined) {
      fail(`"academyDescription" is only valid when preset = "academy" (got preset = "${obj.preset}")`);
    }
  }

  // courseAuthor: applies to learning-shape courses (academy / academy-course / campaign-course)
  const LEARNING_PRESETS = new Set(['academy', 'academy-course', 'campaign-course']);
  if (obj.courseAuthor !== undefined) {
    if (!LEARNING_PRESETS.has(obj.preset as string)) {
      fail(`"courseAuthor" is only valid for academy / academy-course / campaign-course presets`);
    }
    if (!isNonEmptyString(obj.courseAuthor)) {
      fail('"courseAuthor" if present must be a non-empty string');
    }
  }

  const knownKeys = new Set(['preset', 'key', 'rationale', 'academyName', 'academyDescription', 'courseAuthor']);
  const extra = Object.keys(obj).filter((k) => !knownKeys.has(k));
  if (extra.length > 0) {
    fail(`unknown field(s): ${extra.join(', ')} (allowed: ${[...knownKeys].join(', ')})`);
  }

  return obj as unknown as ProductType;
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/product-type.json');

  if (!existsSync(inputPath)) {
    fail(`file not found: ${inputPath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${inputPath}: ${(err as Error).message}`);
  }

  const pt = validate(raw);
  const spec = PRESETS[pt.preset as Preset];
  ok(`${inputPath}`);
  console.log(`  preset       = ${pt.preset}`);
  console.log(`  key          = ${pt.key}`);
  console.log(`  → productType= ${spec.productType}`);
  console.log(`  → flowType   = ${spec.flowType}`);
  console.log(`  → product    = ${spec.product}`);
  console.log(`  → campaignType= ${spec.campaignType ?? 'null'}`);
  console.log(`  → template   = public/product-templates/${spec.template}`);
}

main();
