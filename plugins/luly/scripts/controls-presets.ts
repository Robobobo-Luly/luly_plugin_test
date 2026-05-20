import type { Preset } from './presets';
import type { Plan } from './types';

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

function lessonScreenControls(): Control[] {
  return [
    {
      id: 'ctrl.screen.header-back',
      position: 'topRight',
      requires_click: true,
      style: { variant: 'close-icon' },
      conditionalActions: [{ do: [{ type: 'goto', body: { target: 'parent' } }] }],
    },
    {
      id: 'ctrl.screen.prev',
      label: 'Previous',
      position: 'bottomLeft',
      requires_click: true,
      // Hide entirely on the first screen of a lesson — no previous to go to,
      // and falling through to parent feels misleading visually.
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
      conditionalActions: [
        { guard: { name: 'isLastScreen' }, do: [
          { type: 'finishLesson' },
          { type: 'goto', body: { target: 'parent_next_sibling' } },
        ]},
        { do: [{ type: 'goto', body: { target: 'next_sibling' } }] },
      ],
    },
  ];
}

function onboardingScreenControls(): Control[] {
  // Canonical academy onboarding pattern (verified against Product_Academy_Template.json):
  // single CTA → goto: hub. This works for the last onboarding screen too, since
  // hub is the next sibling and 'hub' is the explicit destination.
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

export function applyControls(productPreset: Preset, plan: Plan): ControlsArtifact {
  const controls: Record<string, Control[]> = {};

  const lessonShape =
    productPreset === 'academy' ||
    productPreset === 'academy-course' ||
    productPreset === 'campaign-course';
  const hasHub = productPreset === 'academy';
  const hasCourse =
    productPreset === 'academy' ||
    productPreset === 'academy-course' ||
    productPreset === 'campaign-course';

  // Onboarding (sibling of hub) — applied whenever the plan has an onboarding section,
  // regardless of preset. The skill only proposes onboarding for academy, but the
  // applier is agnostic.
  for (const screen of plan.onboarding ?? []) {
    controls[`onboarding-${screen.n}`] = onboardingScreenControls();
  }

  if (hasHub) controls['hub'] = hubControls();
  if (hasCourse) controls['course'] = courseControls();

  for (const lesson of plan.lessons) {
    if (lessonShape) {
      controls[`lesson-${lesson.n}`] = lessonControls();
    }
    for (const screen of lesson.screens) {
      const path = `lesson-${lesson.n}.screen-${screen.n}`;
      controls[path] = lessonShape ? lessonScreenControls() : campaignScreenControls();
    }
  }

  return { preset: productPreset, controls };
}
