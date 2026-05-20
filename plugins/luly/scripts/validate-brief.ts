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

  // lengthHint is deprecated but still accepted for backward compat.
  // New briefs omit it; lesson/screen counts come from per-preset ranges in /luly-plan.
  if (obj.lengthHint !== undefined) {
    if (!isNonEmptyString(obj.lengthHint) || !VALID_LENGTH.includes(obj.lengthHint as LengthHint)) {
      fail(`"lengthHint" if present must be one of: ${VALID_LENGTH.join(', ')}`);
    }
  }

  if (!Array.isArray(obj.materials)) fail('"materials" must be an array (can be empty)');
  for (const [i, m] of (obj.materials as unknown[]).entries()) {
    if (!isNonEmptyString(m)) fail(`"materials[${i}]" must be a non-empty string`);
  }

  // Optional brand block — only validated if present
  if (obj.brand !== undefined) {
    if (obj.brand === null || typeof obj.brand !== 'object' || Array.isArray(obj.brand)) {
      fail('"brand" must be an object if present');
    }
    const brand = obj.brand as Record<string, unknown>;
    if (!isNonEmptyString(brand.company)) fail('"brand.company" must be a non-empty string');

    for (const optStr of ['website', 'docsUrl', 'logo', 'voice'] as const) {
      if (brand[optStr] !== undefined && !isNonEmptyString(brand[optStr])) {
        fail(`"brand.${optStr}" must be a non-empty string if present`);
      }
    }
    if (brand.fonts !== undefined) {
      if (!Array.isArray(brand.fonts)) fail('"brand.fonts" must be an array of strings if present');
      for (const [i, f] of (brand.fonts as unknown[]).entries()) {
        if (!isNonEmptyString(f)) fail(`"brand.fonts[${i}]" must be a non-empty string`);
      }
    }
    if (brand.colors !== undefined) {
      if (brand.colors === null || typeof brand.colors !== 'object' || Array.isArray(brand.colors)) {
        fail('"brand.colors" must be an object if present');
      }
      const hexRe = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
      for (const [k, v] of Object.entries(brand.colors as Record<string, unknown>)) {
        if (!isNonEmptyString(v) || !hexRe.test(v)) {
          fail(`"brand.colors.${k}" must be a 6- or 8-char hex string (e.g. "#AB9FF2")`);
        }
      }
    }

    const brandKnownKeys = new Set(['company', 'website', 'docsUrl', 'colors', 'logo', 'fonts', 'voice']);
    const brandExtra = Object.keys(brand).filter((k) => !brandKnownKeys.has(k));
    if (brandExtra.length > 0) {
      fail(`unknown field(s) in "brand": ${brandExtra.join(', ')} (allowed: ${[...brandKnownKeys].join(', ')})`);
    }
  }

  const knownKeys = new Set(['intent', 'audience', 'tone', 'lengthHint', 'materials', 'brand']);
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
  ok(`${inputPath} — intent="${brief.intent.slice(0, 60)}${brief.intent.length > 60 ? '…' : ''}", materials=${brief.materials.length}${brief.lengthHint ? ` (legacy lengthHint=${brief.lengthHint})` : ''}`);
}

main();
