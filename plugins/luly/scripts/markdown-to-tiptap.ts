/**
 * Markdown → TipTap (ProseMirror JSON) converter.
 *
 * Supported subset — aligned with the luly-app TipTap editor extensions:
 *   Block:
 *     - # to #### headings (4 levels)
 *     - paragraphs (blank-line separated)
 *     - bullet lists (- or *)
 *     - check-style bullets (- [ ] or - [x]) → renders with checkmark icons
 *     - ordered lists (1. ...)
 *     - blockquote (> text)
 *   Inline:
 *     - **bold**, *italic* / _italic_, `code`, [label](url)
 *     - Definition tooltips: {{term | description}}
 *                            {{term | title | description}}
 *                            renders as <span data-tooltip-title="..." data-tooltip-description="...">term</span>
 *
 * Not supported (CMS-only or special-case):
 *   - tables (deliberate — keep content linear)
 *   - inline icons / inline buttons (add in CMS)
 *   - inline SVG, spoiler, font weight, color (rare; via raw HTML when needed)
 *   - text alignment (CMS-only)
 *
 * Anything outside the subset is wrapped as a plain paragraph — the converter
 * never errors on input.
 */

export interface TipTapMark {
  type: 'bold' | 'italic' | 'code' | 'link' | 'descriptionTooltip';
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
  // Definition tooltip: {{trigger | description}} OR {{trigger | title | description}}
  //   2 parts → title = trigger text (the displayed word)
  //   3 parts → custom title (popover heading) + description (popover body)
  // The trigger text is what renders inline; the rest sits in mark attrs.
  {
    re: /\{\{\s*([^|}\n]+?)\s*\|\s*([^|}\n]+?)\s*(?:\|\s*([^}\n]+?)\s*)?\}\}/g,
    build: (m) => {
      const trigger = m[1].trim();
      const a = m[2].trim();
      const b = m[3]?.trim();
      const title = b ? a : trigger;
      const description = b ?? a;
      return {
        start: m.index,
        end: m.index + m[0].length,
        text: trigger,
        marks: [{ type: 'descriptionTooltip', attrs: { title, description } }],
      };
    },
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

const HEADING_RE    = /^(#{1,4})\s+(.+)$/;
const ULIST_RE      = /^[-*]\s+(.+)$/;
// Task-list bullet: `- [ ]` or `- [x]` (any case for x). Body is what's after the bracket.
const ULIST_TASK_RE = /^[-*]\s+\[(?:\s|[xX])\]\s+(.+)$/;
const OLIST_RE      = /^\d+\.\s+(.+)$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;

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
      // Detect whether ANY item in this list uses the task-list (`- [ ]` / `- [x]`)
      // syntax. If so, the whole list becomes check-style (data-bullet-style="check").
      // The bracketed marker itself is stripped from each item's text.
      let isCheck = false;
      while (i < lines.length) {
        const li = lines[i].trim();
        const taskM = li.match(ULIST_TASK_RE);
        if (taskM) {
          isCheck = true;
          items.push(makeListItem(taskM[1].trim()));
          i++;
          continue;
        }
        const m = li.match(ULIST_RE);
        if (!m) break;
        items.push(makeListItem(m[1].trim()));
        i++;
      }
      const listNode: TipTapNode = { type: 'bulletList', content: items };
      if (isCheck) listNode.attrs = { 'data-bullet-style': 'check' };
      content.push(listNode);
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

    const bqMatch = trimmed.match(BLOCKQUOTE_RE);
    if (bqMatch) {
      flushParagraph();
      // Collapse consecutive `> ` lines into one blockquote; blank-quoted lines
      // (`>` alone) become paragraph separators inside the blockquote.
      const inner: TipTapNode[] = [];
      let paraBuf: string[] = [];
      const flushBqPara = () => {
        if (paraBuf.length === 0) return;
        const t = paraBuf.join(' ').trim();
        paraBuf = [];
        if (t) inner.push(makeParagraph(t));
      };
      while (i < lines.length) {
        const li = lines[i].trim();
        const bm = li.match(BLOCKQUOTE_RE);
        if (!bm) break;
        const body = bm[1].trim();
        if (body) paraBuf.push(body);
        else flushBqPara();
        i++;
      }
      flushBqPara();
      if (inner.length === 0) inner.push({ type: 'paragraph' });
      content.push({ type: 'blockquote', content: inner });
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
