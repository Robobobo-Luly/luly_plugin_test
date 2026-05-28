# Luly product matrix

Single reference for what each of the six presets is, what shape it takes, and what content it expects. Every skill (intake / plan / meta / style / fill) should link here rather than re-listing per-preset rules. Update this file when a preset rule changes — don't fork it into individual skills.

## Preset menu

| Preset | One-line purpose |
|---|---|
| `academy` | Multi-course learning hub. Top-level hub → onboarding (optional) → courses → lessons → screens. |
| `academy-course` | One additional course attached to an existing academy hub. Same shape as one branch of `academy`. |
| `campaign-course` | Lesson-driven marketing flow (course wrapper, no hub). Single course → lessons → screens. |
| `campaign-simple` | Linear marketing flow — sequence of screens, no course/lesson grouping. |
| `waitlist` | Lead-capture flow ending in an email form. Screens build the pitch; last screen is the form. |
| `interactive-proposal` | Sales / pitch deck delivered as a flow. Sequence of screens, often ending with a CTA. |

## Structural shape

| Preset | Hub | Onboarding | Course wrapper | Lessons | Sections (in plan.md) | Screens per section |
|---|---|---|---|---|---|---|
| `academy` | ✓ | optional | ✓ (multiple) | ✓ | 2–8 | 3–8 |
| `academy-course` | — | optional | ✓ (one — the new one) | ✓ | 2–8 | 3–8 |
| `campaign-course` | — | optional | ✓ (one) | ✓ | 2–6 | 3–8 |
| `campaign-simple` | — | — | — | — | 1 | 4–10 |
| `waitlist` | — | — | — | — | 1 | 3–8 |
| `interactive-proposal` | — | — | — | — | 1 | 4–10 |

Rule: if your plan has 1 section, the preset must be `campaign-simple`, `waitlist`, or `interactive-proposal`. Multi-section presets need ≥ 2 sections.

## Controls per node type

What `applyControls` (`controls-presets.ts`) emits for each preset / node type. "—" means the node type doesn't exist for that preset.

| Preset | Hub | Course | Lesson | Lesson screen | Onboarding screen | Campaign screen |
|---|---|---|---|---|---|---|
| `academy` | invisible click → clicked course | invisible click + visible `Learn` (bottomCenter) → first_lesson | invisible auto: cameFromChild→parent, else→first_child | topRight close-icon→parent · `Previous` (hidden on isFirstScreen) · `Next` (last screen → finishLesson + parent_next_sibling) | per multi-screen rules: Skip/Previous on left, Next/Continue on right | — |
| `academy-course` | — | invisible click + visible `Learn` | invisible auto | same as academy lesson screen | optional, same as academy | — |
| `campaign-course` | — | invisible click + visible `Learn` | invisible auto | same as academy lesson screen | optional, same as academy | — |
| `campaign-simple` | — | — | — | — | — | `Previous` (hidden on first) · `Next` (hidden on last). Form/CTA on last screen acts as exit. |
| `waitlist` | — | — | — | — | — | same as campaign-simple |
| `interactive-proposal` | — | — | — | — | — | same as campaign-simple |

**Forward/back invariants:**
- Hub never has visible buttons — entry is by clicking a course card.
- Every screen with `requires_click: true` controls must have at least one action attached (`goto` / `finishLesson` / `externalLink`).
- The last screen of a lesson MUST have a `Next` that runs `finishLesson` + `goto parent_next_sibling`.
- The last screen of a campaign-*-simple/waitlist/interactive-proposal must have a way to exit — usually the form submit or a `Previous`. `Next` is hidden on the last screen by `isNotLastScreen`.
- First screen of any lesson/section hides `Previous` (via `isNotFirstScreen` guard) — falling back to parent feels misleading.

## Tags

| Preset | Where tags render | Tag count |
|---|---|---|
| `academy` | On each course card in the hub catalog (`HubCourseCard.tsx` → `course.body.tags`) | 3–5 per course |
| `academy-course` | Same, on the course node being added | 3–5 |
| `campaign-course` | Course node optionally; default off (no hub catalog renders them) | 3–5 if set |
| `campaign-simple` / `waitlist` / `interactive-proposal` | None | — |

`luly-meta` writes `tags:` into `meta.md`; the assembler stamps `body.tags` onto the relevant course node (or the flow, for academy where the meta also describes the first course).

## Quizzes

| Preset | Default | Recommended count | Block format |
|---|---|---|---|
| `academy` | on | 1 quiz per lesson, 2–3 questions | `quiz-text` (composite) or `question` (single) |
| `academy-course` | on | same as academy | same |
| `campaign-course` | on | same as academy | same |
| `campaign-simple` | off | 0–1 (rare; only if the campaign is a quiz funnel) | `question` |
| `waitlist` | off | 0 (waitlists capture, they don't test) | — |
| `interactive-proposal` | off | 0 (rare) | — |

Quiz rules apply everywhere (writing-guidelines.md §6):
- One quiz per lesson (academy/course presets), 2–3 questions, three options each, only one correct, shuffle correct-answer position across questions.
- Quiz screens use the same `Next` as story screens — quizzes do not block progression (`autoSubmit` decides this, default `false`).

## Forms

| Preset | Default | Form purpose | Block format |
|---|---|---|---|
| `academy` | off (rare) | optional capture inside a lesson — usually unnecessary | `form-text` or `form` |
| `academy-course` | off | same | same |
| `campaign-course` | off (sometimes on for lead capture at the end) | optional CTA capture | same |
| `campaign-simple` | optional | inline CTA capture (newsletter signup, contact) | `form-text` |
| `waitlist` | **on** (the whole point) | email + optional name/role on the last screen | `email-form` (preferred) or `form` |
| `interactive-proposal` | optional | "book a call" / "request follow-up" at the end | `form-text` |

## Recommended block-format mix

Story content (onboarding, lesson screens, campaign screens) — see `luly-fill/SKILL.md` for the consistency rule. Within one story arc, all narrative screens should use the same shape. Default to `image-richtext`; switch to `text` only when the topic doesn't lend itself to per-screen illustration.

Functional screens (forms, quizzes) are exempt from the consistency rule.

## Asset slots and where each logo goes

| Slot | Used by presets | What it expects |
|---|---|---|
| `flow.body.headerLogo` / `headerLogoSvg` | all | The brand's **lockup** (icon + wordmark) where available; falls back to icon-only or to the Luly mark. Sized to ~24px mobile / 32px desktop — wordmark stays legible. |
| `hub.body.hubLogo` (academy preset only) | `academy` | Same as headerLogo. Lockup preferred. If only icon-only is available, that's acceptable. |
| `course.body.iconSvg` / `iconUrl` | `academy`, `academy-course`, `campaign-course` | **Icon only** (no wordmark). Square, 256×256 viewBox. Generated SVG is the default; brand icon only if a clean icon-only variant exists. |
| `course.body.cardImageSvg` / `cardImageUrl` | `academy`, `academy-course`, `campaign-course` | Course card hero. 16:9 viewBox `0 0 1600 900`. Always generated SVG. |
| `flow.body.mediaPlaceholderUrl` | all | Soft branded SVG used when a block has no image. Generated by style stage. |
| `flow.body.cardPlaceholderUrl` | hub-bearing presets | 16:9 placeholder for courses with no card image. |
| `flow.body.iconPlaceholderUrl` | hub-bearing presets | 1:1 placeholder for courses with no icon. Used when `hub-logo: placeholder`. |

## Recommended counts at a glance

| Preset | Sections | Screens/section | Quizzes/lesson | Forms | Tags/course |
|---|---|---|---|---|---|
| `academy` | 2–8 | 3–8 | 1 (2–3 Qs) | optional | 3–5 |
| `academy-course` | 2–8 | 3–8 | 1 (2–3 Qs) | optional | 3–5 |
| `campaign-course` | 2–6 | 3–8 | 1 (2–3 Qs) | optional | 3–5 |
| `campaign-simple` | 1 | 4–10 | rare | optional | — |
| `waitlist` | 1 | 3–8 | — | **required** (last screen) | — |
| `interactive-proposal` | 1 | 4–10 | — | optional | — |

## How to extend this doc

When a new preset rule, control-shape change, or asset slot is introduced:
1. Add a row / column here first. The skills should reflect this table, not the other way around.
2. Update the relevant skill SKILL.md to link to this doc (don't duplicate the rule).
3. If the change affects `applyControls`, update `controls-presets.ts` and the "Controls per node type" table in lockstep.
4. If the change affects assemble-time validation, update `assemble.ts`'s post-controls audit (the function that walks the tree checking forward/back invariants) so it reflects the new rule.
