import type { Preset } from './presets';

/** @deprecated — kept for backward compat with existing brief.json files. New briefs omit this field; lesson/screen counts are picked by /luly-plan from per-preset ranges plus prompt signals. */
export type LengthHint = 'quick' | 'standard' | 'long';

export interface BrandColors {
  primary?: string;       // HEX, e.g. "#AB9FF2"
  secondary?: string;
  background?: string;
  accent?: string;
  text?: string;
  [key: string]: string | undefined;
}

export interface Brand {
  company: string;         // e.g. "Phantom"
  website?: string;
  docsUrl?: string;
  colors?: BrandColors;    // HEX values pulled from real brand sources
  logo?: string;           // absolute URL to logo image (lockup preferred — used for header + hub logo)
  logoIcon?: string;       // absolute URL to icon-only logo variant (no wordmark) — used for course icon slot
  logoWordmark?: string;   // absolute URL to wordmark-only variant (text, no symbol) — fallback for header
  fonts?: string[];        // e.g. ["Inter"]
  voice?: string;          // 1-line brand voice description
  buttonBorderRadius?: string;     // e.g. "8px" — extracted from brand CSS button rules
  containerBorderRadius?: string;  // e.g. "12px" — for cards/panels
}

export interface Brief {
  intent: string;
  audience: string;
  tone: string;
  /** @deprecated — see LengthHint. Validator accepts but no longer requires this. */
  lengthHint?: LengthHint;
  materials: string[];
  brand?: Brand;           // present when the product is for a specific company
}

export interface ProductType {
  preset: Preset;
  key: string;
  rationale: string;
  /** Required when preset === 'academy'. The user-facing name of the academy itself (flow + hub title). The plan.md H1 is the FIRST COURSE name, not the academy name. */
  academyName?: string;
  /** Optional one-line academy description (academy preset only). Lands on flow.description. */
  academyDescription?: string;
  /** Optional course author name (academy / academy-course / campaign-course). Lands on course.body.author. Empty when unspecified. */
  courseAuthor?: string;
}

export type PlanShape = 'with-lessons' | 'screens-only';

export interface PlanScreen {
  n: number;
  synopsis: string;
}

export interface PlanLesson {
  n: number;
  title: string | null;
  screens: PlanScreen[];
}

/**
 * A content-less "template" / stub course added to an academy hub on top of
 * the authored content. Carries only a card identity (title + description);
 * the assembler fills its body from the bundled default-course template so the
 * user can author it later in the CMS. Opt-in — populated by /luly-plan only
 * when the user asks for multiple / placeholder courses.
 */
export interface TemplateCourse {
  title: string;
  description: string;
}

/**
 * An authored "flow course" appended to an academy hub: a course rendered as a
 * linear simple flow (flowType:'simple') — a hub card that opens its screens
 * directly with NO course-details landing, and whose screens exit back to the
 * hub. Used for short lead-gen / mini-flow cards (e.g. "leave a request") that
 * sit alongside full learning courses. Academy preset only.
 */
export interface FlowCoursePlan {
  title: string;
  description?: string;
  /** True when the flow ends in a form screen (last screen carries a form block). */
  hasForm?: boolean;
  screens: PlanScreen[];
}

export interface Plan {
  shape: PlanShape;
  courseTitle: string;
  intro: string | null;
  onboarding: PlanScreen[];
  lessons: PlanLesson[];
  /** Optional stub courses appended to the hub. Default: none. */
  templateCourses?: TemplateCourse[];
  /** Optional authored simple-flow courses appended to the hub. Default: none. */
  flowCourses?: FlowCoursePlan[];
}

export type ScreenMode = 'story' | 'responsive';
export type QuizDensity = 'low' | 'medium' | 'high';

export interface FormatProfile {
  screenMode: ScreenMode;
  allowQuiz: boolean;
  quizDensity?: QuizDensity;
  allowMedia: boolean;
  allowLayout: boolean;
  allowForm: boolean;
  locales: string[];
}

/**
 * Block formats the plugin EMITS. Mirrors the luly-app editor's current palette
 * (src/services/util/blockFormats.ts). The legacy monolithic composites
 * (`image-richtext`, `quiz-text`, `form-text`) are intentionally NOT here — the
 * editor no longer mints them; the canonical replacement is a `container` block
 * with two child leaves (see the preset sugar in parsers.ts). They still render
 * for old content, so the validator keeps recognizing them — but generation is
 * forward-only.
 *
 * Container formats hold child blocks (nested in the screen's flat block list via
 * `parentSlug`): `section`, `container`, `slider`, `layout` (`layout` is legacy —
 * recognized but `container` is preferred).
 */
export type BlockFormat =
  // leaves
  | 'text'
  | 'image'
  | 'video'
  | 'animation'
  | 'question'
  | 'form'
  | 'email-form'
  | 'button'
  // containers
  | 'section'
  | 'container'
  | 'slider'
  | 'layout';

/** Formats that hold child blocks. Mirrors luly-app CONTAINER_FORMATS. */
export const CONTAINER_FORMATS: ReadonlySet<string> = new Set(['section', 'container', 'slider', 'layout']);
export function isContainerFormat(format?: string): boolean {
  return !!format && CONTAINER_FORMATS.has(format);
}

export type FormFieldType = 'text' | 'email' | 'url' | 'tel' | 'number' | 'textarea' | 'checkbox';

export interface FormFieldLink {
  url: string;
  text: string;
}

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  /** Only used when type === 'checkbox' — the label rendered next to the box */
  checkboxLabel?: string;
  /** Only used when type === 'checkbox' — clickable links inside the checkbox label */
  links?: FormFieldLink[];
}

export interface QuizChoice {
  id: string;
  text: string;
}

/**
 * Layout props a block carries when it sits INSIDE a container. The assembler
 * copies these onto the child's emitted body. Mirrors the editor: container
 * children get a `flex`; legacy `layout` children get a `slot`; preset children
 * get zeroed margins so the container gap is the only spacing.
 */
export interface ChildLayout {
  flex?: number;                  // container row sizing (default renderer = 1)
  slot?: 'left' | 'right';        // legacy `layout` block slot
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

/** Leaf blocks render content directly (no children). */
export type LeafBlock = ChildLayout & (
  | { format: 'text'; content: string }
  | { format: 'image'; url?: string; alt?: string }
  | { format: 'video'; url?: string }
  | { format: 'animation'; url?: string }
  | { format: 'question'; question: string; choices: QuizChoice[]; correctAnswer: string }
  | { format: 'form' | 'email-form'; fields: FormField[]; submitLabel?: string; successMessage?: string; successContent?: string }
  | { format: 'button'; label: string; target?: string }
);

/** Container blocks hold an ordered list of child blocks. */
export type ContainerBlock = ChildLayout & {
  children: ScreenBlock[];
} & (
  | { format: 'container'; direction?: 'row' | 'column'; gap?: number; justify?: 'start' | 'center' | 'end' | 'between'; align?: 'start' | 'center' | 'end' | 'stretch'; directionMobile?: 'row' | 'column'; gapMobile?: number }
  | { format: 'section'; background?: Record<string, unknown>; verticalAlign?: 'start' | 'center' | 'end'; horizontalAlign?: 'left' | 'center' | 'right'; minHeightMode?: 'auto' | 'viewport' | 'custom'; minHeight?: number }
  | { format: 'slider'; slider?: Record<string, unknown> }
  | { format: 'layout'; ratio?: string }
);

/** A block in a screen — a leaf or a container holding more blocks (any depth). */
export type ScreenBlock = LeafBlock | ContainerBlock;

/** @deprecated alias kept for back-compat with older imports. Use ScreenBlock. */
export type LessonBlock = ScreenBlock;

export function isContainerBlock(b: ScreenBlock): b is ContainerBlock {
  return CONTAINER_FORMATS.has(b.format);
}

export interface LessonScreen {
  n: number;
  title: string;
  blocks: ScreenBlock[];
}

export interface Lesson {
  n: number;
  title: string | null;
  screens: LessonScreen[];
}

export interface OnboardingArtifact {
  screens: LessonScreen[];
}

/** Filled screens for one flow course, keyed by its 1-based index in plan order. */
export interface FlowCourseContent {
  index: number;
  screens: LessonScreen[];
}

export type { ThemeArtifact, ResolvedTheme } from './themes';

export type ScreenPath = `lesson-${number}.screen-${number}`;
export type BlockPath = `lesson-${number}.screen-${number}.block-${number}`;

export interface ScreenOverride {
  style?: Record<string, unknown>;
  controlStyle?: Record<string, unknown>;
}

export interface BlockOverride {
  style: Record<string, unknown>;
}

export interface OverridesArtifact {
  screens?: Record<string, ScreenOverride>;
  blocks?: Record<string, BlockOverride>;
}

export type {
  GuardName,
  GotoTarget,
  ActionType,
  ControlPosition,
  ControlGuard,
  ControlAction,
  ConditionalAction,
  Control,
  ControlsArtifact,
} from './controls-presets';

export type { TipTapDoc, TipTapNode, TipTapText, TipTapMark } from './markdown-to-tiptap';

export interface BlockExport {
  type: 'block';
  slug?: string;
  /**
   * Set on a block nested inside a container. References the parent container
   * block's `slug`. The importer resolves it to the parent's parentNodeId so
   * section/container/slider nesting survives import (see luly-app
   * MappingService.parseBlocksFromScreen).
   */
  parentSlug?: string;
  body: Record<string, unknown> & { format: string };
  lexoRank: string;
  controls?: unknown[];
  style?: Record<string, unknown>;
}

export interface NodeExport {
  type: 'flow' | 'hub' | 'course' | 'lesson' | 'screen';
  title: string;
  description: string;
  slug?: string;
  body: Record<string, unknown>;
  controls: unknown[];
  lexoRank: string;
  style?: Record<string, unknown> | null;
  controlStyle?: Record<string, unknown> | null;
  children?: NodeExport[];
  blocks?: BlockExport[];
}

export type FlowExport = NodeExport & { type: 'flow' };
