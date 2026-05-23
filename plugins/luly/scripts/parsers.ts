// Markdown parsers for the v0.2 pipeline.
// Each parser consumes a raw markdown string and produces structures matching
// the existing types in ./types.ts so the downstream build functions in
// assemble.ts don't need to change shape.

import type {
  Brief,
  Brand,
  BrandColors,
  ProductType,
  Plan,
  PlanLesson,
  PlanScreen,
  FormatProfile,
  Lesson,
  LessonScreen,
  LessonBlock,
  OnboardingArtifact,
  FormField,
  FormFieldLink,
  QuizChoice,
} from './types';
import type { Preset } from './presets';
import type { ThemeArtifact } from './themes';

const VALID_PRESETS: Preset[] = [
  'academy',
  'academy-course',
  'campaign-course',
  'campaign-simple',
  'waitlist',
  'interactive-proposal',
];

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

// ============================================================================
// parseIntake — reads intake.md → { brief, productType }
// ============================================================================

export function parseIntake(md: string): { brief: Brief; productType: ProductType } {
  const sections = splitSections(md);

  const intent = readParagraph(sections, 'Intent');
  const audience = readParagraph(sections, 'Audience');
  const tone = readParagraph(sections, 'Tone');

  const presetBlock = sections.get('Preset') ?? '';
  const presetLines = presetBlock.split('\n').map(l => l.trim()).filter(Boolean);
  const presetValue = (presetLines[0] ?? '').trim() as Preset;
  if (!VALID_PRESETS.includes(presetValue)) {
    throw new Error(`intake.md "Preset" must be one of: ${VALID_PRESETS.join(', ')} (got: "${presetValue}")`);
  }
  const rationaleLine = presetLines.find(l => l.toLowerCase().startsWith('rationale:'));
  const rationale = rationaleLine ? rationaleLine.replace(/^rationale:\s*/i, '').trim() : '';

  const key = readKeyFromHeader(md);

  const brand = parseBrandSection(sections.get('Brand (optional — only include this section when a specific company is named)') ?? sections.get('Brand') ?? '');

  const materials = parseBulletList(sections.get('Materials') ?? '');

  const academyName = readParagraph(sections, 'Academy name (academy preset only)') || readParagraph(sections, 'Academy name') || undefined;

  const courseAuthor = readParagraph(sections, 'Course author (optional — academy / academy-course / campaign-course only)') || readParagraph(sections, 'Course author') || undefined;

  const brief: Brief = {
    intent,
    audience,
    tone,
    materials,
    ...(brand ? { brand } : {}),
  };

  const productType: ProductType = {
    preset: presetValue,
    key,
    rationale,
    ...(academyName ? { academyName } : {}),
    ...(courseAuthor ? { courseAuthor } : {}),
  };

  return { brief, productType };
}

function readKeyFromHeader(md: string): string {
  const m = md.match(/^#\s+Intake\s+—\s+(\S+)\s*$/m);
  if (!m) throw new Error('intake.md must start with `# Intake — <key>`');
  return m[1];
}

function parseBrandSection(text: string): Brand | undefined {
  if (!text.trim()) return undefined;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const brand: Partial<Brand> & { company: string } = { company: '' };
  const colors: BrandColors = {};
  let inColors = false;
  const fontsList: string[] = [];
  let inFonts = false;

  for (const line of lines) {
    if (inColors && line.startsWith('-')) {
      const m = line.match(/^-\s*(\w+):\s*(\S+)\s*$/);
      if (m) {
        const [, role, value] = m;
        if (!HEX_RE.test(value)) {
          throw new Error(`intake.md brand color "${role}" must be a 6/8-char hex (got: "${value}")`);
        }
        colors[role] = value;
      }
      continue;
    } else if (inColors) {
      inColors = false;
    }

    if (inFonts && line.startsWith('-')) {
      fontsList.push(line.replace(/^-\s*/, '').trim());
      continue;
    } else if (inFonts) {
      inFonts = false;
    }

    if (/^Colors\s*:\s*$/i.test(line)) { inColors = true; continue; }
    if (/^Fonts\s*:\s*$/i.test(line)) {
      // Inline JSON array form: Fonts: ["Inter"]
      const m = line.match(/^Fonts\s*:\s*\[(.*)\]\s*$/i);
      if (m) {
        const items = m[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        for (const item of items) fontsList.push(item);
        continue;
      }
      inFonts = true;
      continue;
    }

    const inlineFonts = line.match(/^Fonts\s*:\s*\[(.*)\]\s*$/i);
    if (inlineFonts) {
      const items = inlineFonts[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      for (const item of items) fontsList.push(item);
      continue;
    }

    const kv = line.match(/^(\w[\w ]*?)\s*:\s*(.+)$/);
    if (!kv) continue;
    const [, rawKey, value] = kv;
    const key = rawKey.trim().toLowerCase();
    const v = value.trim();
    switch (key) {
      case 'company':  brand.company = v; break;
      case 'website':  brand.website = v; break;
      case 'docs':
      case 'docsurl':  brand.docsUrl = v; break;
      case 'logo':     brand.logo = v; break;
      case 'voice':    brand.voice = v; break;
    }
  }

  if (!brand.company) return undefined;
  if (Object.keys(colors).length > 0) brand.colors = colors;
  if (fontsList.length > 0) brand.fonts = fontsList;
  return brand as Brand;
}

// ============================================================================
// parsePlan — reads plan.md → { plan, formatProfile }
// ============================================================================

interface PlanFrontmatter {
  preset?: Preset;
  key?: string;
  academyName?: string;
  mode?: 'story' | 'responsive';
  quizzes?: 'on' | 'off';
  forms?: 'on' | 'off';
  locales?: string[];
}

export function parsePlan(md: string): { plan: Plan; formatProfile: FormatProfile; frontmatter: PlanFrontmatter } {
  const { frontmatter, body } = splitFrontmatter(md);
  const fm = parsePlanFrontmatter(frontmatter);

  // Parse body
  const lines = body.split('\n');
  let i = 0;

  // Skip leading blanks
  while (i < lines.length && !lines[i].trim()) i++;

  // H1 title (course title)
  let courseTitle = '';
  if (i < lines.length && lines[i].startsWith('# ')) {
    courseTitle = lines[i].slice(2).trim();
    i++;
  } else {
    throw new Error('plan.md must contain a `# <title>` H1');
  }

  // Optional intro paragraph(s) until first H2
  const introLines: string[] = [];
  while (i < lines.length && !lines[i].startsWith('## ')) {
    if (lines[i].trim()) introLines.push(lines[i].trim());
    i++;
  }
  const intro = introLines.length > 0 ? introLines.join(' ') : null;

  // Sections (## Onboarding or ## Section N — title)
  const onboarding: PlanScreen[] = [];
  const lessons: PlanLesson[] = [];

  while (i < lines.length) {
    if (!lines[i].startsWith('## ')) { i++; continue; }
    const heading = lines[i].slice(3).trim();
    i++;

    const screens: PlanScreen[] = [];
    let screenN = 0;
    while (i < lines.length && !lines[i].startsWith('## ')) {
      const m = lines[i].match(/^\s*-\s+Screen\s+(\d+)\s*[—–-]\s*(.+?)\s*$/);
      if (m) {
        screenN = parseInt(m[1], 10);
        screens.push({ n: screenN, synopsis: m[2].trim() });
      } else if (/^\s*-\s+/.test(lines[i])) {
        // Fallback: any bullet under the section counts as a screen
        screenN++;
        const txt = lines[i].replace(/^\s*-\s+/, '').trim();
        screens.push({ n: screenN, synopsis: txt });
      }
      i++;
    }

    if (/^onboarding$/i.test(heading)) {
      for (const s of screens) onboarding.push(s);
    } else {
      // "Section N — title" or "Lesson N — title" (legacy)
      const m = heading.match(/^(?:Section|Lesson)\s+(\d+)\s*[—–-]\s*(.+)$/i);
      if (m) {
        lessons.push({
          n: parseInt(m[1], 10),
          title: m[2].trim(),
          screens,
        });
      }
    }
  }

  const plan: Plan = {
    shape: 'with-lessons',
    courseTitle,
    intro,
    onboarding,
    lessons,
  };

  const formatProfile: FormatProfile = {
    screenMode: fm.mode ?? 'story',
    allowQuiz: fm.quizzes !== 'off',
    allowMedia: true,
    allowLayout: fm.mode === 'responsive',
    allowForm: fm.forms === 'on',
    locales: fm.locales ?? ['en'],
  };

  return { plan, formatProfile, frontmatter: fm };
}

function splitFrontmatter(md: string): { frontmatter: string; body: string } {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) throw new Error('plan.md must start with `---` frontmatter block');
  return { frontmatter: m[1], body: m[2] };
}

function parsePlanFrontmatter(fm: string): PlanFrontmatter {
  const result: PlanFrontmatter = {};
  for (const raw of fm.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([\w]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const v = value.trim();
    switch (key) {
      case 'preset':       result.preset = v as Preset; break;
      case 'key':          result.key = v; break;
      case 'academyName':  result.academyName = v; break;
      case 'mode':         result.mode = v as 'story' | 'responsive'; break;
      case 'quizzes':      result.quizzes = v as 'on' | 'off'; break;
      case 'forms':        result.forms = v as 'on' | 'off'; break;
      case 'locales': {
        const arr = v.match(/\[(.*)\]/);
        if (arr) {
          result.locales = arr[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        }
        break;
      }
    }
  }
  return result;
}

// ============================================================================
// parseTheme — reads theme.md → ThemeArtifact
// ============================================================================

export function parseTheme(md: string): ThemeArtifact {
  const sections = splitSections(md);
  const paletteRaw = sections.get('Palette') ?? '';
  const fontsRaw = sections.get('Fonts') ?? '';

  const colors: Record<string, string> = {};
  for (const raw of paletteRaw.split('\n')) {
    const line = raw.trim();
    if (!line || !line.startsWith('-')) continue;
    const m = line.match(/^-\s*([\w]+)\s*:\s*(\S+)\s*$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!HEX_RE.test(value)) {
      throw new Error(`theme.md palette token "${key}" must be a 6/8-char hex (got: "${value}")`);
    }
    colors[key] = value;
  }

  const style: Record<string, string> = {};
  for (const raw of fontsRaw.split('\n')) {
    const line = raw.trim();
    if (!line || !line.startsWith('-')) continue;
    const m = line.match(/^-\s*([\w]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const [, rawKey, value] = m;
    const key = rawKey.trim();
    const v = value.trim();
    switch (key) {
      case 'heading':            style.fontHeading = v; break;
      case 'body':               style.fontBody = v; break;
      case 'buttonBorderRadius': style.buttonBorderRadius = v; break;
      default: style[key] = v;
    }
  }

  return { colors: colors as ThemeArtifact['colors'], style: style as ThemeArtifact['style'] };
}

// ============================================================================
// parseContent — reads content.md → { lessons, onboarding }
// ============================================================================

interface ScreenHeaderInfo {
  kind: 'onboarding' | 'section';
  sectionN: number;
  screenN: number;
  title: string;
}

export function parseContent(md: string): { lessons: Lesson[]; onboarding: OnboardingArtifact | null } {
  const screenBlocks = md.split(/^---\s*$/m).map(s => s.trim()).filter(Boolean);

  const onboardingScreens: LessonScreen[] = [];
  const sectionScreens = new Map<number, { title: string; screens: LessonScreen[] }>();

  for (const blk of screenBlocks) {
    const lines = blk.split('\n');
    let i = 0;
    // Find first H2
    while (i < lines.length && !lines[i].startsWith('## ')) i++;
    if (i >= lines.length) continue;

    const headingLine = lines[i].slice(3).trim();
    i++;

    const info = parseScreenHeading(headingLine);
    if (!info) continue;

    // Header lines (key: value or list intro `key:`) until blank line
    const headerLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      headerLines.push(lines[i]);
      i++;
    }
    // skip blank
    while (i < lines.length && lines[i].trim() === '') i++;

    // Body lines from here to end of this block
    const bodyLines: string[] = [];
    while (i < lines.length) {
      bodyLines.push(lines[i]);
      i++;
    }
    const body = bodyLines.join('\n').trim();

    const headerFields = parseScreenHeader(headerLines);
    const block = buildBlock(headerFields, body);

    const screen: LessonScreen = {
      n: info.screenN,
      title: info.title,
      blocks: [block],
    };

    if (info.kind === 'onboarding') {
      onboardingScreens.push(screen);
    } else {
      let entry = sectionScreens.get(info.sectionN);
      if (!entry) {
        entry = { title: '', screens: [] };
        sectionScreens.set(info.sectionN, entry);
      }
      entry.screens.push(screen);
    }
  }

  const lessons: Lesson[] = Array.from(sectionScreens.entries())
    .sort(([a], [b]) => a - b)
    .map(([n, entry]) => ({
      n,
      title: entry.title || null,
      screens: entry.screens.sort((a, b) => a.n - b.n),
    }));

  const onboarding: OnboardingArtifact | null = onboardingScreens.length > 0
    ? { screens: onboardingScreens.sort((a, b) => a.n - b.n) }
    : null;

  return { lessons, onboarding };
}

function parseScreenHeading(h: string): ScreenHeaderInfo | null {
  // "Onboarding · Screen N — title"
  let m = h.match(/^Onboarding\s*[·•]\s*Screen\s+(\d+)\s*[—–-]\s*(.+)$/i);
  if (m) {
    return { kind: 'onboarding', sectionN: 0, screenN: parseInt(m[1], 10), title: m[2].trim() };
  }
  // "Section N · Screen M — title"
  m = h.match(/^Section\s+(\d+)\s*[·•]\s*Screen\s+(\d+)\s*[—–-]\s*(.+)$/i);
  if (m) {
    return { kind: 'section', sectionN: parseInt(m[1], 10), screenN: parseInt(m[2], 10), title: m[3].trim() };
  }
  return null;
}

// Per-screen header is YAML-style key/value with optional indented bulleted lists for
// `choices:` and `fields:`. No external YAML dep.
function parseScreenHeader(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    const m = trimmed.match(/^([\w]+)\s*:\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, valueRaw] = m;
    const value = valueRaw.trim();

    if (value === '') {
      // Possibly a list follows (choices: / fields: / links:)
      const list: unknown[] = [];
      i++;
      // Look for indented items
      while (i < lines.length) {
        const itemRaw = lines[i];
        const itemTrim = itemRaw.trimStart();
        if (!itemTrim) { i++; continue; }
        if (!itemTrim.startsWith('-') || (itemRaw.startsWith('  ') === false && itemRaw.startsWith('-') === true && itemRaw[1] === ' ' && !key.match(/^(choices|fields|links)$/i))) {
          // Probably end of list
          break;
        }
        if (!itemRaw.startsWith(' ') && itemRaw.startsWith('-')) {
          // Top-level bullet — not part of a sub-list
          break;
        }
        // Collect the item's sub-fields until next bullet at same indent or end
        const itemFields: Record<string, unknown> = {};
        const stripped = itemRaw.replace(/^\s*-\s*/, '');
        const inlineMatch = stripped.match(/^([\w]+)\s*:\s*(.+)$/);
        if (inlineMatch) {
          itemFields[inlineMatch[1]] = stripValueQuotes(inlineMatch[2].trim());
        } else if (stripped) {
          itemFields._value = stripped;
        }
        i++;
        while (i < lines.length) {
          const subRaw = lines[i];
          const subTrim = subRaw.trimStart();
          if (!subTrim) { i++; continue; }
          // sub-fields are indented more than the bullet
          if (subRaw.startsWith('    ') && !subTrim.startsWith('-')) {
            const subM = subTrim.match(/^([\w]+)\s*:\s*(.+)$/);
            if (subM) {
              itemFields[subM[1]] = stripValueQuotes(subM[2].trim());
            }
            i++;
            continue;
          }
          break;
        }
        list.push(itemFields);
      }
      result[key] = list;
      continue;
    }

    result[key] = stripValueQuotes(value);
    i++;
  }
  return result;
}

function stripValueQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function buildBlock(hdr: Record<string, unknown>, body: string): LessonBlock {
  const type = String(hdr.type ?? 'text');
  switch (type) {
    case 'text':
      return { format: 'text', content: body };
    case 'image-richtext':
      return {
        format: 'image-richtext',
        imageUrl: String(hdr.image ?? '/assets/placeholder-image.svg'),
        imagePosition: (hdr.position as 'left' | 'right') ?? 'left',
        content: body,
        ...(hdr.caption ? { caption: String(hdr.caption) } : {}),
      };
    case 'image':
      return {
        format: 'image',
        url: String(hdr.url ?? ''),
        alt: String(hdr.alt ?? ''),
        ...(hdr.caption ? { caption: String(hdr.caption) } : {}),
      };
    case 'video':
      return {
        format: 'video',
        url: String(hdr.url ?? ''),
        ...(hdr.poster ? { poster: String(hdr.poster) } : {}),
        ...(hdr.caption ? { caption: String(hdr.caption) } : {}),
      };
    case 'quiz-text':
      return {
        format: 'quiz-text',
        question: String(hdr.question ?? ''),
        text: String(hdr.text ?? ''),
        choices: parseChoices(hdr.choices),
        correctAnswer: String(hdr.correct ?? ''),
      };
    case 'question':
      return {
        format: 'question',
        question: String(hdr.question ?? ''),
        choices: parseChoices(hdr.choices),
        correctAnswer: String(hdr.correct ?? ''),
      };
    case 'form':
    case 'email-form':
      return {
        format: type as 'form' | 'email-form',
        fields: parseFields(hdr.fields),
        ...(hdr.submitLabel ? { submitLabel: String(hdr.submitLabel) } : {}),
        ...(hdr.successMessage ? { successMessage: String(hdr.successMessage) } : {}),
      };
    case 'form-text':
      return {
        format: 'form-text',
        content: body,
        fields: parseFields(hdr.fields),
        submitLabel: String(hdr.submitLabel ?? 'Submit'),
        successContent: String(hdr.successContent ?? 'Thank you!'),
      };
    case 'layout':
      return { format: 'layout', ratio: String(hdr.ratio ?? '50:50') };
    default:
      // Fallback: treat as text
      return { format: 'text', content: body };
  }
}

function parseChoices(raw: unknown): QuizChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => {
    const obj = c as Record<string, unknown>;
    return { id: String(obj.id ?? ''), text: String(obj.text ?? '') };
  }).filter(c => c.id && c.text);
}

function parseFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => {
    const obj = f as Record<string, unknown>;
    const field: FormField = {
      id: String(obj.id ?? ''),
      label: String(obj.label ?? ''),
      type: (obj.type as FormField['type']) ?? 'text',
      ...(obj.required !== undefined ? { required: obj.required === true || obj.required === 'true' } : {}),
      ...(obj.placeholder ? { placeholder: String(obj.placeholder) } : {}),
      ...(obj.checkboxLabel ? { checkboxLabel: String(obj.checkboxLabel) } : {}),
    };
    if (Array.isArray(obj.links)) {
      field.links = (obj.links as Record<string, unknown>[]).map((l) => ({
        url: String(l.url ?? ''),
        text: String(l.text ?? ''),
      })).filter((l) => l.url && l.text) as FormFieldLink[];
    }
    return field;
  }).filter(f => f.id);
}

// ============================================================================
// Shared markdown helpers
// ============================================================================

// Split a markdown doc into a map of `H2 heading text → section body text`.
// Body text is everything from after the heading to the next H2 or EOF.
function splitSections(md: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = md.split('\n');
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentHeading) result.set(currentHeading, currentLines.join('\n').trim());
      currentHeading = line.slice(3).trim();
      currentLines = [];
    } else if (line.startsWith('# ')) {
      // Don't include H1
      continue;
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }
  if (currentHeading) result.set(currentHeading, currentLines.join('\n').trim());

  return result;
}

function readParagraph(sections: Map<string, string>, heading: string): string {
  const raw = sections.get(heading);
  if (!raw) return '';
  return raw.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
}

function parseBulletList(text: string): string[] {
  const items: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('-')) continue;
    items.push(line.replace(/^-\s*/, '').trim());
  }
  return items;
}
