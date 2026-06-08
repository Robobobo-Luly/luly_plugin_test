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

export interface Plan {
  shape: PlanShape;
  courseTitle: string;
  intro: string | null;
  onboarding: PlanScreen[];
  lessons: PlanLesson[];
  /** Optional stub courses appended to the hub. Default: none. */
  templateCourses?: TemplateCourse[];
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

export type BlockFormat =
  | 'text'
  | 'image-richtext'
  | 'image'
  | 'video'
  | 'quiz-text'
  | 'question'
  | 'form'
  | 'email-form'
  | 'form-text'
  | 'layout';

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

export type LessonBlock =
  | { format: 'text'; content: string }
  | { format: 'image-richtext'; imageUrl: string; imagePosition: 'left' | 'right'; imagePositionMobile?: 'top' | 'bottom'; content: string; caption?: string }
  | { format: 'image'; url: string; alt: string; caption?: string }
  | { format: 'video'; url: string; poster?: string; caption?: string }
  | { format: 'quiz-text'; question: string; choices: QuizChoice[]; correctAnswer: string; text?: string }
  | { format: 'question'; question: string; choices: QuizChoice[]; correctAnswer: string }
  | { format: 'form' | 'email-form'; fields: FormField[]; submitLabel?: string; successMessage?: string }
  | { format: 'form-text'; content: string; fields: FormField[]; submitLabel: string; successContent: string }
  | { format: 'layout'; ratio: string };

export interface LessonScreen {
  n: number;
  title: string;
  blocks: LessonBlock[];
}

export interface Lesson {
  n: number;
  title: string | null;
  screens: LessonScreen[];
}

export interface OnboardingArtifact {
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
