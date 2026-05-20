/**
 * Shared block + screen validation logic used by both
 * validate-lesson.ts and validate-onboarding.ts.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { BlockFormat, FormatProfile, FormFieldType } from './types';

export const ALL_FORMATS: BlockFormat[] = [
  'text', 'image-richtext', 'image', 'video', 'quiz-text', 'question', 'form', 'email-form', 'form-text', 'layout',
];
export const FORM_FIELD_TYPES: FormFieldType[] = ['text', 'email', 'url', 'tel', 'number', 'textarea', 'checkbox'];

export class ValidationError extends Error {}

export function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new ValidationError(msg);
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}

export function loadFormatProfile(workdir: string): FormatProfile {
  const path = resolve(workdir, 'format-profile.json');
  if (!existsSync(path)) {
    throw new ValidationError(`sibling format-profile.json not found at ${path} — run /luly-format first`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as FormatProfile;
}

export function allowedFormats(fp: FormatProfile): Set<BlockFormat> {
  // 'text' is the renderer's canonical name for a plain rich-text screen
  // (BlockRenderer dispatches on 'text' → RichTextRenderer).
  // image-richtext is the media variant with a placeholder image when no real asset.
  const set = new Set<BlockFormat>(['text', 'image-richtext', 'image']);
  if (fp.allowMedia) set.add('video');
  if (fp.allowQuiz) { set.add('quiz-text'); set.add('question'); }
  if (fp.allowLayout && fp.screenMode === 'responsive') set.add('layout');
  if (fp.allowForm) { set.add('form'); set.add('email-form'); set.add('form-text'); }
  return set;
}

export function checkFields(rawFields: unknown, ctx: string): void {
  need(Array.isArray(rawFields) && rawFields.length >= 1, `${ctx}: "fields" must be a non-empty array`);
  for (const [i, f] of (rawFields as unknown[]).entries()) {
    need(f !== null && typeof f === 'object' && !Array.isArray(f), `${ctx}: fields[${i}] is not an object`);
    const fld = f as Record<string, unknown>;
    need(isNonEmptyString(fld.id), `${ctx}: fields[${i}].id must be non-empty string`);
    need(typeof fld.label === 'string', `${ctx}: fields[${i}].label must be a string (may be empty for checkbox)`);
    need(typeof fld.type === 'string' && (FORM_FIELD_TYPES as string[]).includes(fld.type as string), `${ctx}: fields[${i}].type must be one of: ${FORM_FIELD_TYPES.join(', ')}`);
    if (fld.required !== undefined) need(typeof fld.required === 'boolean', `${ctx}: fields[${i}].required if present must be boolean`);
    if (fld.placeholder !== undefined) need(typeof fld.placeholder === 'string', `${ctx}: fields[${i}].placeholder if present must be a string`);
    if (fld.type === 'checkbox') {
      if (fld.checkboxLabel !== undefined) need(typeof fld.checkboxLabel === 'string', `${ctx}: fields[${i}].checkboxLabel if present must be a string`);
      if (fld.links !== undefined) {
        need(Array.isArray(fld.links), `${ctx}: fields[${i}].links must be an array`);
        for (const [j, l] of (fld.links as unknown[]).entries()) {
          need(l !== null && typeof l === 'object' && !Array.isArray(l), `${ctx}: fields[${i}].links[${j}] not an object`);
          const lnk = l as Record<string, unknown>;
          need(isNonEmptyString(lnk.url), `${ctx}: fields[${i}].links[${j}].url must be non-empty string`);
          need(isNonEmptyString(lnk.text), `${ctx}: fields[${i}].links[${j}].text must be non-empty string`);
          const lKnown = new Set(['url', 'text']);
          const lExtra = Object.keys(lnk).filter(k => !lKnown.has(k));
          need(lExtra.length === 0, `${ctx}: fields[${i}].links[${j}] unknown key(s): ${lExtra.join(', ')}`);
        }
      }
    } else {
      need(fld.checkboxLabel === undefined, `${ctx}: fields[${i}].checkboxLabel only valid when type=checkbox`);
      need(fld.links === undefined, `${ctx}: fields[${i}].links only valid when type=checkbox`);
    }
    const fieldKnown = new Set(['id', 'label', 'type', 'required', 'placeholder', 'checkboxLabel', 'links']);
    const fieldExtra = Object.keys(fld).filter(k => !fieldKnown.has(k));
    need(fieldExtra.length === 0, `${ctx}: fields[${i}] has unknown key(s): ${fieldExtra.join(', ')}`);
  }
}

export function validateBlock(raw: unknown, ctx: string, allowed: Set<BlockFormat>, fp: FormatProfile): { format: string } {
  need(raw !== null && typeof raw === 'object' && !Array.isArray(raw), `${ctx}: block is not an object`);
  const b = raw as Record<string, unknown>;
  need(typeof b.format === 'string', `${ctx}: missing or non-string "format"`);
  const format = b.format as string;
  need((ALL_FORMATS as string[]).includes(format), `${ctx}: unknown block format "${format}" (allowed at all: ${ALL_FORMATS.join(', ')})`);
  need(allowed.has(format as BlockFormat), `${ctx}: block format "${format}" not in allowlist derived from format-profile (allowed here: ${[...allowed].join(', ')})`);

  let requiredKeys: string[] = ['format'];
  let optionalKeys: string[] = [];

  switch (format) {
    case 'text':
      requiredKeys = ['format', 'content'];
      need(isNonEmptyString(b.content), `${ctx}: "content" must be non-empty Markdown string`);
      break;
    case 'image-richtext':
      requiredKeys = ['format', 'imageUrl', 'imagePosition', 'content'];
      optionalKeys = ['caption'];
      need(isNonEmptyString(b.imageUrl), `${ctx}: "imageUrl" must be non-empty string`);
      need(b.imagePosition === 'left' || b.imagePosition === 'right', `${ctx}: "imagePosition" must be "left" or "right"`);
      need(isNonEmptyString(b.content), `${ctx}: "content" must be non-empty Markdown string`);
      if (b.caption !== undefined) need(isNonEmptyString(b.caption), `${ctx}: "caption" if present must be non-empty string`);
      break;
    case 'image':
      requiredKeys = ['format', 'url', 'alt'];
      optionalKeys = ['caption'];
      need(isNonEmptyString(b.url), `${ctx}: "url" must be non-empty string`);
      need(isNonEmptyString(b.alt), `${ctx}: "alt" must be non-empty string`);
      if (b.caption !== undefined) need(isNonEmptyString(b.caption), `${ctx}: "caption" if present must be non-empty string`);
      break;
    case 'video':
      requiredKeys = ['format', 'url'];
      optionalKeys = ['poster', 'caption'];
      need(isNonEmptyString(b.url), `${ctx}: "url" must be non-empty string`);
      if (b.poster !== undefined) need(isNonEmptyString(b.poster), `${ctx}: "poster" if present must be non-empty string`);
      if (b.caption !== undefined) need(isNonEmptyString(b.caption), `${ctx}: "caption" if present must be non-empty string`);
      break;
    case 'quiz-text': {
      requiredKeys = ['format', 'question', 'choices', 'correctAnswer'];
      optionalKeys = ['text'];
      need(isNonEmptyString(b.question), `${ctx}: "question" must be non-empty Markdown string`);
      if (b.text !== undefined) {
        need(
          isNonEmptyString(b.text),
          `${ctx}: "text" if present must be non-empty Markdown string (for pure quiz screens, use format "question" instead of "quiz-text" — don't emit an empty text)`,
        );
      }
      need(Array.isArray(b.choices) && b.choices.length >= 2, `${ctx}: "choices" must be an array of at least 2`);
      const seenIds = new Set<string>();
      for (const [i, c] of (b.choices as unknown[]).entries()) {
        need(c !== null && typeof c === 'object' && !Array.isArray(c), `${ctx}: choices[${i}] is not an object`);
        const ch = c as Record<string, unknown>;
        need(isNonEmptyString(ch.id), `${ctx}: choices[${i}].id must be non-empty string`);
        need(isNonEmptyString(ch.text), `${ctx}: choices[${i}].text must be non-empty string`);
        const choiceKnown = new Set(['id', 'text']);
        const choiceExtra = Object.keys(ch).filter(k => !choiceKnown.has(k));
        need(choiceExtra.length === 0, `${ctx}: choices[${i}] has unknown key(s): ${choiceExtra.join(', ')}`);
        need(!seenIds.has(ch.id), `${ctx}: duplicate choice id "${ch.id}"`);
        seenIds.add(ch.id);
      }
      need(isNonEmptyString(b.correctAnswer), `${ctx}: "correctAnswer" must be non-empty string`);
      need(seenIds.has(b.correctAnswer as string), `${ctx}: "correctAnswer" = "${b.correctAnswer}" must match one of the choice ids: ${[...seenIds].join(', ')}`);
      break;
    }
    case 'question': {
      // Same multi-choice shape as quiz-text but without the surrounding text panel.
      // Use this for pure quiz screens (no context blurb).
      requiredKeys = ['format', 'question', 'choices', 'correctAnswer'];
      need(isNonEmptyString(b.question), `${ctx}: "question" must be non-empty Markdown string`);
      need(Array.isArray(b.choices) && b.choices.length >= 2, `${ctx}: "choices" must be an array of at least 2`);
      const qSeenIds = new Set<string>();
      for (const [i, c] of (b.choices as unknown[]).entries()) {
        need(c !== null && typeof c === 'object' && !Array.isArray(c), `${ctx}: choices[${i}] is not an object`);
        const ch = c as Record<string, unknown>;
        need(isNonEmptyString(ch.id), `${ctx}: choices[${i}].id must be non-empty string`);
        need(isNonEmptyString(ch.text), `${ctx}: choices[${i}].text must be non-empty string`);
        const choiceKnown = new Set(['id', 'text']);
        const choiceExtra = Object.keys(ch).filter((k) => !choiceKnown.has(k));
        need(choiceExtra.length === 0, `${ctx}: choices[${i}] has unknown key(s): ${choiceExtra.join(', ')}`);
        need(!qSeenIds.has(ch.id), `${ctx}: duplicate choice id "${ch.id}"`);
        qSeenIds.add(ch.id);
      }
      need(isNonEmptyString(b.correctAnswer), `${ctx}: "correctAnswer" must be non-empty string`);
      need(qSeenIds.has(b.correctAnswer as string), `${ctx}: "correctAnswer" = "${b.correctAnswer}" must match one of the choice ids: ${[...qSeenIds].join(', ')}`);
      break;
    }
    case 'form':
    case 'email-form':
      requiredKeys = ['format', 'fields'];
      optionalKeys = ['submitLabel', 'successMessage'];
      checkFields(b.fields, ctx);
      if (b.submitLabel !== undefined) need(isNonEmptyString(b.submitLabel), `${ctx}: "submitLabel" if present must be non-empty string`);
      if (b.successMessage !== undefined) need(isNonEmptyString(b.successMessage), `${ctx}: "successMessage" if present must be non-empty string`);
      break;
    case 'form-text':
      requiredKeys = ['format', 'content', 'fields', 'submitLabel', 'successContent'];
      need(isNonEmptyString(b.content), `${ctx}: "content" must be non-empty Markdown string`);
      checkFields(b.fields, ctx);
      need(isNonEmptyString(b.submitLabel), `${ctx}: "submitLabel" must be non-empty string`);
      need(isNonEmptyString(b.successContent), `${ctx}: "successContent" must be non-empty Markdown string`);
      break;
    case 'layout':
      requiredKeys = ['format', 'ratio'];
      need(fp.screenMode === 'responsive', `${ctx}: "layout" blocks require screenMode "responsive"`);
      need(isNonEmptyString(b.ratio), `${ctx}: "ratio" must be non-empty string (e.g. "50:50")`);
      break;
  }

  const known = new Set([...requiredKeys, ...optionalKeys]);
  const extra = Object.keys(b).filter(k => !known.has(k));
  need(extra.length === 0, `${ctx}: unknown key(s): ${extra.join(', ')} — stage 4 forbids styles/controls/etc. (allowed for ${format}: ${[...known].join(', ')})`);

  return { format };
}

export interface ScreenValidationResult {
  n: number;
  title: string;
  blockFormats: string[];
}

export function validateScreen(
  raw: unknown,
  scope: string,
  expectedN: number,
  allowed: Set<BlockFormat>,
  fp: FormatProfile,
): ScreenValidationResult {
  need(raw !== null && typeof raw === 'object' && !Array.isArray(raw), `${scope}: screen is not an object`);
  const s = raw as Record<string, unknown>;
  need(isPositiveInt(s.n), `${scope}: screen.n must be a positive integer`);
  need(s.n === expectedN, `${scope}: screen.n = ${s.n} but expected ${expectedN} (sequential)`);
  need(isNonEmptyString(s.title), `${scope} screen ${s.n}: title must be non-empty string`);
  need(Array.isArray(s.blocks) && s.blocks.length >= 1, `${scope} screen ${s.n}: blocks must be a non-empty array`);

  const knownKeys = new Set(['n', 'title', 'blocks']);
  const extra = Object.keys(s).filter(k => !knownKeys.has(k));
  need(extra.length === 0, `${scope} screen ${s.n}: unknown key(s): ${extra.join(', ')}`);

  const blockFormats: string[] = [];
  for (const [i, b] of (s.blocks as unknown[]).entries()) {
    const { format } = validateBlock(b, `${scope} screen ${s.n} block[${i}]`, allowed, fp);
    blockFormats.push(format);
  }
  return { n: s.n as number, title: s.title as string, blockFormats };
}
