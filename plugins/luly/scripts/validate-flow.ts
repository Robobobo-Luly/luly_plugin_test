import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { REQUIRED_COLOR_TOKENS } from './themes';

const AUDIT_FIELDS = ['id', 'version', 'status', 'parentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'publishedAt', 'publishedBy'];
const NODE_TYPES = new Set(['flow', 'hub', 'course', 'lesson', 'screen']);
const BLOCK_FORMATS_KNOWN = new Set([
  'image-richtext', 'image', 'video', 'quiz-text', 'question',
  'form', 'email-form', 'layout', 'button', 'animation', 'text', 'form-text',
]);

function red(s: string): string { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }

class ValidationError extends Error {}
function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new ValidationError(msg);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

interface Counts { hub: number; course: number; lesson: number; screen: number; block: number }

function checkNoAuditFields(node: Record<string, unknown>, path: string): void {
  for (const f of AUDIT_FIELDS) {
    need(!(f in node), `${path}: audit field "${f}" must not be present in exported JSON`);
  }
}

function checkTipTapDoc(value: unknown, ctx: string): void {
  need(typeof value === 'string', `${ctx}: must be a JSON string`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value as string);
  } catch (err) {
    throw new ValidationError(`${ctx}: not valid JSON (${(err as Error).message})`);
  }
  need(isPlainObject(parsed), `${ctx}: parsed value is not an object`);
  need((parsed as any).type === 'doc', `${ctx}: top-level type must be "doc", got "${(parsed as any).type}"`);
  need(Array.isArray((parsed as any).content), `${ctx}: missing "content" array`);
}

function checkBlock(block: unknown, ctx: string, counts: Counts): void {
  need(isPlainObject(block), `${ctx}: block is not an object`);
  need(block.type === 'block', `${ctx}: type must be "block"`);
  checkNoAuditFields(block, ctx);
  need(isPlainObject(block.body), `${ctx}: missing "body"`);
  need(isNonEmptyString((block.body as any).format), `${ctx}: missing body.format`);
  need(BLOCK_FORMATS_KNOWN.has((block.body as any).format), `${ctx}: unknown body.format "${(block.body as any).format}"`);
  need(isNonEmptyString(block.lexoRank), `${ctx}: missing lexoRank`);

  const fmt = (block.body as any).format as string;
  if (fmt === 'text' || fmt === 'image-richtext') {
    checkTipTapDoc((block.body as any).content, `${ctx} body.content`);
  }
  if (fmt === 'quiz-text' || fmt === 'question') {
    checkTipTapDoc((block.body as any).question_md, `${ctx} body.question_md`);
  }
  if (fmt === 'form-text') {
    checkTipTapDoc((block.body as any).content, `${ctx} body.content`);
    checkTipTapDoc((block.body as any).successContent, `${ctx} body.successContent`);
  }
  counts.block++;
}

function checkScreen(screen: unknown, ctx: string, counts: Counts): void {
  need(isPlainObject(screen), `${ctx}: not an object`);
  need(screen.type === 'screen', `${ctx}: type must be "screen"`);
  need(isNonEmptyString(screen.title), `${ctx}: missing title`);
  need(isNonEmptyString(screen.lexoRank), `${ctx}: missing lexoRank`);
  need(isPlainObject(screen.body), `${ctx}: missing body`);
  need(Array.isArray(screen.controls), `${ctx}: missing controls array`);
  need(Array.isArray(screen.blocks), `${ctx}: missing blocks array`);
  need((screen.blocks as unknown[]).length >= 1, `${ctx}: blocks must be non-empty`);
  checkNoAuditFields(screen, ctx);
  for (const [i, b] of (screen.blocks as unknown[]).entries()) {
    checkBlock(b, `${ctx} block[${i}]`, counts);
  }
  // Control-graph audit: every screen must have at least one outgoing path.
  // Acceptable:
  //   (a) ≥1 control with requires_click=true whose conditionalActions contain
  //       at least one goto / finishLesson / externalLink action, OR
  //   (b) ≥1 control with requires_click=false whose conditionalActions auto-
  //       progress (rare for screens, but allowed for special flows).
  // A screen with controls=[] OR with only no-op controls is a dead end.
  const screenControls = screen.controls as unknown[];
  const hasExit = screenControls.some(c => controlHasActionPath(c));
  need(hasExit,
    `${ctx}: dead-end screen — no control with goto / finishLesson / externalLink action. ` +
    `Every screen must have a forward path (Next, finish, submit, or close).`);
  counts.screen++;
}

/**
 * True iff the control's conditionalActions reference at least one navigation
 * action (goto / finishLesson / externalLink). Used by the control-graph audit
 * to confirm a screen has a way out.
 */
function controlHasActionPath(c: unknown): boolean {
  if (!isPlainObject(c)) return false;
  const conds = c.conditionalActions;
  if (!Array.isArray(conds)) return false;
  for (const cond of conds) {
    if (!isPlainObject(cond)) continue;
    const actions = cond.do;
    if (!Array.isArray(actions)) continue;
    for (const a of actions) {
      if (!isPlainObject(a)) continue;
      if (a.type === 'goto' || a.type === 'finishLesson' || a.type === 'externalLink') return true;
    }
  }
  return false;
}

/**
 * Container-level control-graph audit. Rules per node type:
 *   - hub:     no visible controls required (entry is via course-card click).
 *              An invisible auto-click control may be present but isn't required.
 *   - course:  must have ≥1 control with an action path (Learn button or
 *              invisible auto-progress to first_lesson).
 *   - lesson:  must have ≥1 control with an action path (typically invisible
 *              auto: cameFromChild→parent, else→first_child).
 */
function checkContainerControls(node: Record<string, unknown>, ctx: string, expectedType: 'flow' | 'hub' | 'course' | 'lesson'): void {
  if (expectedType === 'hub' || expectedType === 'flow') return;
  const controls = node.controls as unknown[];
  const hasExit = controls.some(c => controlHasActionPath(c));
  need(hasExit,
    `${ctx}: ${expectedType} has no control with a navigation action. ` +
    `Every ${expectedType} must have at least one control with goto / finishLesson / externalLink.`);
}

function checkContainerNode(node: unknown, ctx: string, expectedType: 'flow' | 'hub' | 'course' | 'lesson', counts: Counts): void {
  need(isPlainObject(node), `${ctx}: not an object`);
  need(node.type === expectedType, `${ctx}: type must be "${expectedType}", got "${node.type}"`);
  need(isNonEmptyString(node.title) || expectedType === 'hub', `${ctx}: missing title`);
  need(isNonEmptyString(node.lexoRank), `${ctx}: missing lexoRank`);
  need(isPlainObject(node.body), `${ctx}: missing body`);
  need(Array.isArray(node.controls), `${ctx}: missing controls array`);
  need(Array.isArray(node.children), `${ctx}: missing children array`);
  checkNoAuditFields(node, ctx);

  if (expectedType === 'flow') counts;
  else (counts as any)[expectedType]++;
}

function validateCourseOnly(raw: unknown): { root: any; counts: Counts } {
  need(isPlainObject(raw), 'top-level value is not a JSON object');
  const counts: Counts = { hub: 0, course: 0, lesson: 0, screen: 0, block: 0 };
  checkContainerNode(raw, '<course>', 'course', counts);
  const course = raw as Record<string, any>;
  const body = course.body as Record<string, unknown>;
  need(body.flowType === 'learning', `<course> body.flowType must be "learning" (got ${JSON.stringify(body.flowType)})`);
  need(isNonEmptyString(body.courseKey), `<course> body.courseKey must be a non-empty string`);
  checkContainerControls(course, '<course>', 'course');
  for (const [k, lessonRaw] of (course.children as unknown[]).entries()) {
    checkContainerNode(lessonRaw, `<course>.children[${k}]`, 'lesson', counts);
    checkContainerControls(lessonRaw as Record<string, unknown>, `<course>.children[${k}]`, 'lesson');
    const lesson = lessonRaw as any;
    for (const [m, scrRaw] of (lesson.children as unknown[]).entries()) {
      checkScreen(scrRaw, `<course>.children[${k}].children[${m}]`, counts);
    }
  }
  return { root: course, counts };
}

function validate(raw: unknown): { root: any; counts: Counts; kind: 'flow' | 'course' } {
  need(isPlainObject(raw), 'top-level value is not a JSON object');
  const topType = (raw as any).type;
  if (topType === 'course') {
    const { root, counts } = validateCourseOnly(raw);
    return { root, counts, kind: 'course' };
  }

  checkContainerNode(raw, '<flow>', 'flow', { hub: 0, course: 0, lesson: 0, screen: 0, block: 0 });

  const flow = raw as Record<string, any>;
  // theme check
  const theme = (flow.body && flow.body.theme) as Record<string, unknown> | undefined;
  need(isPlainObject(theme), '<flow> body.theme missing or not an object');
  const colors = (theme as any).colors as Record<string, unknown>;
  need(isPlainObject(colors), '<flow> body.theme.colors missing');
  for (const token of REQUIRED_COLOR_TOKENS) {
    need(isNonEmptyString((colors as any)[token]), `<flow> body.theme.colors missing required token "${token}"`);
  }
  need(isPlainObject((theme as any).style), '<flow> body.theme.style missing');
  need(isPlainObject((theme as any).layout), '<flow> body.theme.layout missing');

  const counts: Counts = { hub: 0, course: 0, lesson: 0, screen: 0, block: 0 };

  // Walk flow.children: each is either an onboarding `screen` (sibling of hub)
  // or the `hub` itself. Order is enforced loosely — onboarding screens come
  // before the hub in real templates, but we don't strictly require that.
  for (const [i, child] of (flow.children as unknown[]).entries()) {
    const c = child as Record<string, unknown>;
    if (c.type === 'screen') {
      checkScreen(c, `<flow>.children[${i}] (onboarding)`, counts);
      continue;
    }
    checkContainerNode(child, `<flow>.children[${i}]`, 'hub', counts);
    const hub = child as any;
    // Hub itself: no visible-control requirement (entry via card click).
    for (const [j, courseRaw] of (hub.children as unknown[]).entries()) {
      checkContainerNode(courseRaw, `<flow>.children[${i}].children[${j}]`, 'course', counts);
      checkContainerControls(courseRaw as Record<string, unknown>, `<flow>.children[${i}].children[${j}]`, 'course');
      const course = courseRaw as any;
      for (const [k, lessonRaw] of (course.children as unknown[]).entries()) {
        checkContainerNode(lessonRaw, `<flow>.children[${i}].children[${j}].children[${k}]`, 'lesson', counts);
        checkContainerControls(lessonRaw as Record<string, unknown>, `<flow>.children[${i}].children[${j}].children[${k}]`, 'lesson');
        const lesson = lessonRaw as any;
        for (const [m, scrRaw] of (lesson.children as unknown[]).entries()) {
          checkScreen(scrRaw, `<flow>.children[${i}].children[${j}].children[${k}].children[${m}]`, counts);
        }
      }
    }
  }

  return { root: flow, counts, kind: 'flow' };
}

function findDefaultPath(): string {
  const workdir = resolve(process.cwd(), 'tmp/luly-agent');
  // Prefer the flow file derived from product-type if it exists; else any .luly.json
  const ptPath = join(workdir, 'product-type.json');
  if (existsSync(ptPath)) {
    try {
      const pt = JSON.parse(readFileSync(ptPath, 'utf8'));
      const candidate = join(workdir, `${pt.key}.luly.json`);
      if (existsSync(candidate)) return candidate;
    } catch { /* fall through */ }
  }
  if (existsSync(workdir)) {
    const found = readdirSync(workdir).find((f) => f.endsWith('.luly.json'));
    if (found) return join(workdir, found);
  }
  return join(workdir, 'flow.luly.json');
}

function main(): void {
  const arg = process.argv[2];
  const inputPath = arg ? resolve(process.cwd(), arg) : findDefaultPath();
  if (!existsSync(inputPath)) {
    console.error(red(`✖ invalid: file not found: ${inputPath}`));
    process.exit(1);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error(red(`✖ invalid: not valid JSON: ${(err as Error).message}`));
    process.exit(1);
  }
  try {
    const { root, counts, kind } = validate(raw);
    console.log(green(`✓ ${kind} ok:`) + ` ${inputPath}`);
    console.log(`  type              = ${root.type}`);
    console.log(`  title             = ${root.title}`);
    if (kind === 'flow') {
      console.log(`  key               = ${root.body?.key}`);
      console.log(`  preset (product)  = ${root.body?.flowType} / ${root.body?.productType}`);
      console.log(`  hubs              = ${counts.hub}`);
    } else {
      console.log(`  courseKey         = ${root.body?.courseKey}`);
      console.log(`  flowType          = ${root.body?.flowType}`);
    }
    console.log(`  courses           = ${counts.course}`);
    console.log(`  lessons           = ${counts.lesson}`);
    console.log(`  screens           = ${counts.screen}`);
    console.log(`  blocks            = ${counts.block}`);
    process.exit(0);
  } catch (err) {
    if (err instanceof ValidationError) {
      console.error(red(`✖ invalid:`) + ` ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
