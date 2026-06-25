import type { Preset } from './presets';
import type { Lesson, LessonScreen } from './types';

export type GuardName =
  | 'isFirstScreen' | 'isLastScreen' | 'isNotFirstScreen' | 'isNotLastScreen'
  | 'cameFromParent' | 'cameFromChild'
  | 'lessonCompleted' | 'courseCompleted'
  | 'contentClicked' | 'answerCorrect';

export const GUARD_VOCAB: readonly GuardName[] = [
  'isFirstScreen', 'isLastScreen', 'isNotFirstScreen', 'isNotLastScreen',
  'cameFromParent', 'cameFromChild',
  'lessonCompleted', 'courseCompleted',
  'contentClicked', 'answerCorrect',
] as const;

export type GotoTarget =
  | 'next_sibling' | 'previous_sibling' | 'parent' | 'first_child' | 'first_lesson'
  | 'parent_next_sibling' | 'hub' | 'clicked_content' | 'specific_content';

export const GOTO_VOCAB: readonly GotoTarget[] = [
  'next_sibling', 'previous_sibling', 'parent', 'first_child', 'first_lesson',
  'parent_next_sibling', 'hub', 'clicked_content', 'specific_content',
] as const;

export type ActionType = 'goto' | 'finishLesson' | 'externalLink';
export const ACTION_VOCAB: readonly ActionType[] = ['goto', 'finishLesson', 'externalLink'] as const;

// Closed set matching the CMS schema (src/types/content.ts:29). 'topLeft' is NOT
// recognised by the renderer — unknown positions fall through to the bottom panel.
export type ControlPosition =
  | 'bottomRight' | 'bottomLeft' | 'bottomCenter' | 'topRight';

export interface ControlGuard {
  name: GuardName;
  args?: unknown[];
}

export interface ControlAction {
  type: ActionType;
  body?: {
    target?: GotoTarget;
    slug?: string;
    url?: string;
    newTab?: boolean;
  };
}

export interface ConditionalAction {
  guard?: ControlGuard;
  do: ControlAction[];
}

export interface Control {
  id: string;
  slug?: string;
  label?: string;
  position?: ControlPosition;
  requires_click?: boolean;
  is_visible?: ControlGuard | null;
  is_enabled?: ControlGuard | null;
  style?: Record<string, unknown>;
  styleName?: string;
  conditionalActions: ConditionalAction[];
}

export interface ControlsArtifact {
  preset: Preset;
  controls: Record<string, Control[]>;
}

// ============================================================================
// Per-node-type control builders
// ============================================================================

function hubControls(): Control[] {
  return [{
    id: 'ctrl.hub.click',
    requires_click: false,
    conditionalActions: [
      { guard: { name: 'contentClicked' }, do: [{ type: 'goto', body: { target: 'clicked_content' } }] },
    ],
  }];
}

function courseControls(): Control[] {
  return [
    {
      id: 'ctrl.course.click',
      position: 'bottomLeft',
      requires_click: false,
      conditionalActions: [
        { guard: { name: 'contentClicked' }, do: [{ type: 'goto', body: { target: 'clicked_content' } }] },
      ],
    },
    // Back to the hub. The course's parent IS the academy hub, so `parent`
    // returns the learner to the course catalog. Without this the course
    // landing only offers "Learn" and there's no way back to the hub.
    // Mirrors the canonical academy template (Back → parent, bottomCenter).
    {
      id: 'ctrl.course.back',
      label: 'Back',
      position: 'bottomCenter',
      requires_click: true,
      styleName: 'secondary',
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'parent' } }] },
      ],
    },
    {
      id: 'ctrl.course.learn',
      label: 'Learn',
      position: 'bottomCenter',
      requires_click: true,
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'first_lesson' } }] },
      ],
    },
  ];
}

/**
 * Course control for SIMPLE-shape courses (campaign-simple / waitlist /
 * interactive-proposal). The course is a wrapper with no landing screen, so the
 * only control is an invisible auto-nav: descend into the first lesson on entry,
 * return to the hub when coming back from a child. Mirrors luly-app
 * COURSE_CONTROL_CONFIGS.simple (controlConfig.ts) and the canonical
 * Basic_Campaign template. Without this the course has no navigation action and
 * fails the validator's container-control check.
 */
function simpleCourseControls(): Control[] {
  return [{
    id: 'ctrl.course.auto',
    position: 'bottomLeft',
    requires_click: false,
    conditionalActions: [
      { guard: { name: 'cameFromChild' }, do: [{ type: 'goto', body: { target: 'parent' } }] },
      { do: [{ type: 'goto', body: { target: 'first_child' } }] },
    ],
  }];
}

function lessonControls(): Control[] {
  return [{
    id: 'ctrl.lesson.auto',
    requires_click: false,
    conditionalActions: [
      { guard: { name: 'cameFromChild' }, do: [{ type: 'goto', body: { target: 'parent' } }] },
      { do: [{ type: 'goto', body: { target: 'first_child' } }] },
    ],
  }];
}

export function lessonScreenControls(opts: { isFirst: boolean; isLast: boolean }): Control[] {
  // Position is BAKED at generation time — we do NOT use the runtime `isLastScreen`
  // guard for the Next action. The guard misfired in older setups (the first
  // screen finishing the lesson), and the plugin knows each screen's position
  // here, so emit the exact action per position. `finishLesson` lands ONLY on the
  // real last screen of the lesson.
  const { isFirst, isLast } = opts;
  const controls: Control[] = [
    // Top-right exit is always the default close-icon → parent. The renderer
    // hard-enforces icon shape on topRight regardless of what we send.
    {
      id: 'ctrl.screen.header-back',
      position: 'topRight',
      requires_click: true,
      style: { variant: 'close-icon' },
      conditionalActions: [{ do: [{ type: 'goto', body: { target: 'parent' } }] }],
    },
  ];

  // Previous — omitted entirely on the first screen (no previous sibling).
  if (!isFirst) {
    controls.push({
      id: 'ctrl.screen.prev',
      label: 'Previous',
      position: 'bottomLeft',
      requires_click: true,
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'previous_sibling' } }] },
      ],
    });
  }

  // Next — finish the lesson only on the last screen; otherwise advance.
  controls.push({
    id: 'ctrl.screen.next',
    label: 'Next',
    position: 'bottomRight',
    requires_click: true,
    conditionalActions: [
      { do: isLast
        ? [{ type: 'finishLesson' }, { type: 'goto', body: { target: 'parent_next_sibling' } }]
        : [{ type: 'goto', body: { target: 'next_sibling' } }] },
    ],
  });

  return controls;
}

function onboardingScreenControls(opts: { isFirst: boolean; isLast: boolean; multiScreen: boolean }): Control[] {
  // Onboarding navigation:
  // - Single-screen onboarding: just "Continue" → hub
  // - Multi-screen onboarding:
  //     • First screen → Skip onboarding (secondary, goto: hub) + Next (primary, next_sibling)
  //     • Middle screens → Previous (secondary, previous_sibling) + Next (primary, next_sibling)
  //     • Last screen → Previous (secondary) + Continue (primary, goto: hub)
  // This prevents the skip-screen bug where a "Continue → hub" on screen 1 jumps past screen 2+.
  const { isFirst, isLast, multiScreen } = opts;

  if (!multiScreen) {
    // Single-screen onboarding — keep the simple Continue → hub
    return [{
      id: 'ctrl.onboarding.continue',
      label: 'Continue',
      position: 'bottomCenter',
      requires_click: true,
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'hub' } }] },
      ],
    }];
  }

  const controls: Control[] = [];

  // Left button: Skip (first) or Previous (middle / last)
  if (isFirst) {
    controls.push({
      id: 'ctrl.onboarding.skip',
      label: 'Skip onboarding',
      position: 'bottomLeft',
      requires_click: true,
      styleName: 'secondary',
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'hub' } }] },
      ],
    });
  } else {
    controls.push({
      id: 'ctrl.onboarding.prev',
      label: 'Previous',
      position: 'bottomLeft',
      requires_click: true,
      styleName: 'secondary',
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'previous_sibling' } }] },
      ],
    });
  }

  // Right button: Next (first / middle) or Continue (last)
  if (isLast) {
    controls.push({
      id: 'ctrl.onboarding.continue',
      label: 'Continue',
      position: 'bottomRight',
      requires_click: true,
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'hub' } }] },
      ],
    });
  } else {
    controls.push({
      id: 'ctrl.onboarding.next',
      label: 'Next',
      position: 'bottomRight',
      requires_click: true,
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'next_sibling' } }] },
      ],
    });
  }

  return controls;
}

function campaignScreenControls(): Control[] {
  // Campaign-simple / waitlist / interactive-proposal screens:
  // - First screen → only Next (Previous hidden)
  // - Middle screens → Previous + Next
  // - Last screen → only Previous (Next hidden — the CMS schema offers no valid
  //   "end of campaign" goto target, and the form-text block on the last screen
  //   carries the CTA via its own submit button)
  return [
    {
      id: 'ctrl.screen.prev',
      label: 'Previous',
      position: 'bottomLeft',
      requires_click: true,
      is_visible: { name: 'isNotFirstScreen' },
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'previous_sibling' } }] },
      ],
    },
    {
      id: 'ctrl.screen.next',
      label: 'Next',
      position: 'bottomRight',
      requires_click: true,
      is_visible: { name: 'isNotLastScreen' },
      conditionalActions: [
        { do: [{ type: 'goto', body: { target: 'next_sibling' } }] },
      ],
    },
  ];
}

// ============================================================================
// Apply controls per preset
// ============================================================================

// Simple-shape presets: a single wrapper lesson, linear screens, no course
// landing. Mirrors SIMPLE_COURSE_PRESETS in assemble.ts.
const SIMPLE_PRESETS: ReadonlySet<Preset> = new Set<Preset>([
  'campaign-simple', 'waitlist', 'interactive-proposal',
]);

/**
 * Build the per-node control map. Driven by the ACTUAL content (lessons +
 * onboarding screens) — not the plan — so positions and map keys
 * (`lesson-N.screen-M`, `onboarding-N`) match exactly what buildScreenNode looks
 * up even when fill split a screen.
 */
export function applyControls(
  productPreset: Preset,
  content: { lessons: Lesson[]; onboarding: LessonScreen[] },
): ControlsArtifact {
  const controls: Record<string, Control[]> = {};

  const isSimple = SIMPLE_PRESETS.has(productPreset);
  // Learning-shape lessons are course sections with story screens; simple-shape
  // lessons are linear-campaign wrappers (screens use campaignScreenControls).
  const lessonShape = !isSimple;
  // A flow with a hub is built for every preset except academy-course
  // (course-only output, no flow/hub).
  const hasHub = productPreset !== 'academy-course';

  // Onboarding (siblings of the hub) — position-aware.
  const onboardingScreens = content.onboarding ?? [];
  const obMulti = onboardingScreens.length > 1;
  for (let i = 0; i < onboardingScreens.length; i++) {
    const screen = onboardingScreens[i];
    controls[`onboarding-${screen.n}`] = onboardingScreenControls({
      isFirst: i === 0,
      isLast: i === onboardingScreens.length - 1,
      multiScreen: obMulti,
    });
  }

  // Hub: every hub-bearing flow needs the contentClicked→clicked_content nav so a
  // course card opens its course (canonical: all flows get it, not just academy).
  if (hasHub) controls['hub'] = hubControls();

  // Course: every preset has a course node. Learning courses get click/Back/Learn;
  // simple courses get the invisible auto-nav (entry + return). Both carry a
  // navigation action, so the validator's container-control check passes.
  controls['course'] = isSimple ? simpleCourseControls() : courseControls();

  for (const lesson of content.lessons) {
    // Every lesson — learning section OR simple wrapper — gets the auto-nav.
    controls[`lesson-${lesson.n}`] = lessonControls();

    const screens = lesson.screens;
    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i];
      const path = `lesson-${lesson.n}.screen-${screen.n}`;
      controls[path] = lessonShape
        ? lessonScreenControls({ isFirst: i === 0, isLast: i === screens.length - 1 })
        : campaignScreenControls();
    }
  }

  return { preset: productPreset, controls };
}
