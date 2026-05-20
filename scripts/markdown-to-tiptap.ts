/**
 * Minimal Markdown → TipTap (ProseMirror JSON) converter.
 *
 * Closed subset (stage 4 commits to this):
 *   - # to #### headings
 *   - paragraphs (blank-line separated)
 *   - bulleted lists (- or *)
 *   - ordered lists (1. ...)
 *   - inline marks: **bold**, *italic* / _italic_, `code`, [label](url)
 *
 * Anything outside the subset is wrapped as a plain paragraph — the converter
 * never errors on input.
 */

export interface TipTapMark {
  type: 'bold' | 'italic' | 'code' | 'link';
  attrs?: Record<string, string>;
}

export interface TipTapText {
  type: 'text';
  text: string;
  marks?: TipTapMark[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (TipTapNode | TipTapText)[];
}

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

// ----------------------------------------------------------------------------
// Inline tokenisation
//
// Strategy: greedy single-pass tokeniser. For each position in the input,
// look for the next-starting inline mark and split accordingly. Marks do not
// nest in this subset (e.g. **bold *and italic***) — first match wins.
// ----------------------------------------------------------------------------

interface InlineMatch {
  /** Position in input where the matched substring starts (including markers) */
  start: number;
  /** Position in input one past the matched substring (including markers) */
  end: number;
  /** The displayed text (markers stripped) */
  text: string;
  /** Marks to attach to this text */
  marks: TipTapMark[];
}

const INLINE_PATTERNS: Array<{ re: RegExp; build: (m: RegExpExecArray) => InlineMatch }> = [
  // Code: `text` — highest priority (no inner mark processing inside)
  {
    re: /`([^`\n]+)`/g,
    build: (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1],
      marks: [{ type: 'code' }],
    }),
  },
  // Link: [label](url)
  {
    re: /\[([^\]\n]+)\]\(([^)\s\n]+)\)/g,
    build: (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1],
      marks: [{ type: 'link', attrs: { href: m[2] } }],
    }),
  },
  // Bold: **text**
  {
    re: /\*\*([^*\n]+)\*\*/g,
    build: (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1],
      marks: [{ type: 'bold' }],
    }),
  },
  // Italic with asterisk: *text* (not preceded/followed by *, must have non-word boundary)
  {
    re: /(?<![*\w])\*([^*\n]+)\*(?![*\w])/g,
    build: (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1],
      marks: [{ type: 'italic' }],
    }),
  },
  // Italic with underscore: _text_
  {
    re: /(?<![_\w])_([^_\n]+)_(?![_\w])/g,
    build: (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1],
      marks: [{ type: 'italic' }],
    }),
  },
];

function findNextMatch(input: string, fromIndex: number): InlineMatch | null {
  let best: InlineMatch | null = null;
  for (const { re, build } of INLINE_PATTERNS) {
    re.lastIndex = fromIndex;
    const m = re.exec(input);
    if (m && (best === null || m.index < best.start)) {
      best = build(m);
    }
  }
  return best;
}

function parseInline(line: string): TipTapText[] {
  const out: TipTapText[] = [];
  let i = 0;
  while (i < line.length) {
    const next = findNextMatch(line, i);
    if (!next) {
      const rest = line.slice(i);
      if (rest) out.push({ type: 'text', text: rest });
      break;
    }
    if (next.start > i) {
      out.push({ type: 'text', text: line.slice(i, next.start) });
    }
    const node: TipTapText = { type: 'text', text: next.text, marks: next.marks };
    out.push(node);
    i = next.end;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Block parsing
// ----------------------------------------------------------------------------

const HEADING_RE = /^(#{1,4})\s+(.+)$/;
const ULIST_RE = /^[-*]\s+(.+)$/;
const OLIST_RE = /^\d+\.\s+(.+)$/;

function makeParagraph(text: string): TipTapNode {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'paragraph' };
  return { type: 'paragraph', content: parseInline(trimmed) };
}

function makeListItem(text: string): TipTapNode {
  return { type: 'listItem', content: [makeParagraph(text)] };
}

export function markdownToTipTap(input: string): TipTapDoc {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const content: TipTapNode[] = [];

  let i = 0;
  let paragraphLines: string[] = [];

  function flushParagraph(): void {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(' ').trim();
    paragraphLines = [];
    if (text) content.push(makeParagraph(text));
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      i++;
      continue;
    }

    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInline(headingMatch[2].trim()),
      });
      i++;
      continue;
    }

    const ulistMatch = trimmed.match(ULIST_RE);
    if (ulistMatch) {
      flushParagraph();
      const items: TipTapNode[] = [];
      while (i < lines.length) {
        const li = lines[i].trim();
        const m = li.match(ULIST_RE);
        if (!m) break;
        items.push(makeListItem(m[1].trim()));
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    const olistMatch = trimmed.match(OLIST_RE);
    if (olistMatch) {
      flushParagraph();
      const items: TipTapNode[] = [];
      while (i < lines.length) {
        const li = lines[i].trim();
        const m = li.match(OLIST_RE);
        if (!m) break;
        items.push(makeListItem(m[1].trim()));
        i++;
      }
      content.push({ type: 'orderedList', content: items });
      continue;
    }

    paragraphLines.push(trimmed);
    i++;
  }
  flushParagraph();

  if (content.length === 0) content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

export function markdownToTipTapString(input: string): string {
  return JSON.stringify(markdownToTipTap(input));
}
