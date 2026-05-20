import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  REQUIRED_COLOR_TOKENS,
  OPTIONAL_COLOR_TOKENS,
  REQUIRED_STYLE_TOKENS,
  OPTIONAL_STYLE_TOKENS,
  OPTIONAL_LAYOUT_TOKENS,
  SUPPORTED_FONTS,
  type ThemeArtifact,
} from './themes';

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const CSS_SIZE_RE = /^(0|\d+(\.\d+)?(px|em|rem|%|vh|vw))$/;
const FONT_KEYS = new Set(['fontHeading', 'fontBody']);

function fail(msg: string): never {
  console.error(`\x1b[31m✖ theme invalid:\x1b[0m ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`\x1b[32m✓ theme ok:\x1b[0m ${msg}`);
}
function warn(msg: string): void {
  console.warn(`\x1b[33m⚠ theme:\x1b[0m ${msg}`);
}

// --- WCAG-style luminance + contrast helpers ----------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace(/^#/, '').slice(0, 6);
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(fg: string, bg: string): number {
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
function checkContrast(
  pair: { fg: string; bg: string; pairName: string; target: number },
  colors: Record<string, string>,
): void {
  const fg = colors[pair.fg];
  const bg = colors[pair.bg];
  if (!fg || !bg) return;
  const ratio = contrastRatio(fg, bg);
  if (ratio < pair.target) {
    warn(`${pair.pairName}: ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}:1 (target ≥ ${pair.target}:1) — text may be hard to read`);
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validateColors(map: Record<string, unknown>): void {
  const known = new Set<string>([...REQUIRED_COLOR_TOKENS, ...OPTIONAL_COLOR_TOKENS]);

  // Required tokens present
  for (const token of REQUIRED_COLOR_TOKENS) {
    if (!(token in map)) fail(`colors: required token "${token}" is missing`);
  }

  // Each entry validates
  for (const [key, value] of Object.entries(map)) {
    if (!known.has(key)) {
      fail(`colors: unknown token "${key}" (allowed: ${[...known].join(', ')})`);
    }
    if (!isNonEmptyString(value)) {
      fail(`colors.${key}: must be a non-empty string`);
    }
    if (!HEX_RE.test(value)) {
      fail(`colors.${key} = ${JSON.stringify(value)}: must be a 6- or 8-char hex color (e.g. "#0142E5", "#0142E5FF")`);
    }
  }
}

function validateStyle(map: Record<string, unknown>): void {
  // fontHeading and fontBody required + must be from supported list
  for (const role of REQUIRED_STYLE_TOKENS) {
    const value = map[role];
    if (!isNonEmptyString(value)) {
      fail(`style.${role}: required, must be a non-empty CSS font-family string from the supported list`);
    }
    if (!SUPPORTED_FONTS.includes(value as string)) {
      fail(
        `style.${role} = ${JSON.stringify(value)}: not in the supported fonts list.\n` +
        `  Supported (use one of these strings verbatim):\n` +
        SUPPORTED_FONTS.map((f) => `    ${f}`).join('\n'),
      );
    }
  }

  // All other style fields are optional, but if present must be CSS-size strings
  const known = new Set<string>([...REQUIRED_STYLE_TOKENS, ...OPTIONAL_STYLE_TOKENS]);
  for (const [key, value] of Object.entries(map)) {
    if (!known.has(key)) {
      fail(`style: unknown token "${key}" (allowed: ${[...known].join(', ')})`);
    }
    if (FONT_KEYS.has(key)) continue;
    if (!isNonEmptyString(value)) fail(`style.${key}: must be a non-empty string`);
    if (!CSS_SIZE_RE.test(value)) {
      fail(`style.${key} = ${JSON.stringify(value)}: must be a CSS size (e.g. "8px", "1.5em", "0")`);
    }
  }
}

function validateLayout(map: Record<string, unknown>): void {
  const known = new Set<string>(OPTIONAL_LAYOUT_TOKENS);
  for (const [key, value] of Object.entries(map)) {
    if (!known.has(key)) {
      fail(`layout: unknown token "${key}" (allowed: ${[...known].join(', ')})`);
    }
    if (!isNonEmptyString(value)) fail(`layout.${key}: must be a non-empty string`);
    if (!CSS_SIZE_RE.test(value)) {
      fail(`layout.${key} = ${JSON.stringify(value)}: must be a CSS size (e.g. "1200px", "100%")`);
    }
  }
}

function validate(raw: unknown): ThemeArtifact {
  if (!isPlainObject(raw)) fail('top-level value is not a JSON object');

  const topAllowed = new Set(['colors', 'style', 'layout']);
  const extra = Object.keys(raw).filter((k) => !topAllowed.has(k));
  if (extra.length > 0) {
    fail(`unknown top-level field(s): ${extra.join(', ')} (allowed: colors, style, layout). theme.json no longer carries "preset" — the agent generates colors and picks fonts directly.`);
  }

  if (!isPlainObject(raw.colors)) fail('"colors" is required and must be an object with all 18 required tokens');
  validateColors(raw.colors);

  if (!isPlainObject(raw.style)) fail('"style" is required and must be an object containing at least fontHeading and fontBody');
  validateStyle(raw.style);

  if (raw.layout !== undefined) {
    if (!isPlainObject(raw.layout)) fail('"layout" if present must be an object');
    validateLayout(raw.layout);
  }

  return raw as unknown as ThemeArtifact;
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/theme.json');
  if (!existsSync(inputPath)) fail(`file not found: ${inputPath}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${inputPath}: ${(err as Error).message}`);
  }

  const theme = validate(raw);

  // Warn-only contrast checks for the header / footer foreground / background
  // pairs. The renderer pairs these directly, so poor contrast = unreadable bar.
  checkContrast({fg: 'headerText', bg: 'headerBackground', pairName: 'header foreground/background', target: 4.5}, theme.colors);
  checkContrast({fg: 'footerText', bg: 'footerBackground', pairName: 'footer foreground/background', target: 4.5}, theme.colors);
  checkContrast({fg: 'textColor', bg: 'background', pairName: 'body text/background', target: 4.5}, theme.colors);

  ok(`${inputPath}`);
  console.log(`  colors:`);
  console.log(`    background = ${theme.colors.background}`);
  console.log(`    surface    = ${theme.colors.surface}`);
  console.log(`    primary    = ${theme.colors.primary}`);
  console.log(`    textColor  = ${theme.colors.textColor}`);
    console.log(`    success / failure / warning = ${theme.colors.success} / ${theme.colors.failure} / ${theme.colors.warning}`);
  console.log(`    header bg / text = ${theme.colors.headerBackground} / ${theme.colors.headerText}`);
  console.log(`    footer bg / text = ${theme.colors.footerBackground} / ${theme.colors.footerText}`);
  console.log(`  fonts:`);
  console.log(`    fontHeading = ${theme.style.fontHeading}`);
  console.log(`    fontBody    = ${theme.style.fontBody}`);
  if (theme.style.buttonBorderRadius) console.log(`  button radius = ${theme.style.buttonBorderRadius}`);
  if (theme.style.buttonHeight) console.log(`  button height = ${theme.style.buttonHeight}`);
  if (theme.layout?.maxWidth) console.log(`  maxWidth      = ${theme.layout.maxWidth}`);
}

main();
