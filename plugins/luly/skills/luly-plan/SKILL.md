---
name: luly-plan
description: Stage 2 of the Luly authoring pipeline. Read intake.md, write plan.md — a single markdown doc with frontmatter (preset, key, format toggles) plus a section/screen outline. Absorbs the old format-profile stage via the frontmatter block.
---

# Luly — Stage 2: Plan

You write the structure: which sections, how many screens per section, what each screen is about. Format toggles (story vs responsive, quizzes on/off) live in the frontmatter so they ride along with the plan.

**Before writing**, read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and apply it — especially sentence-case titles, no trailing punctuation in headings, and the quiz rules (one quiz per lesson, 2–3 questions, three options).

## Process

### 1. Load intake

Read `<workdir>/intake.md`. Pay attention to preset, key, intent, audience, tone, brand voice if present. If intake is missing, stop and tell the user to run `/luly-intake` first.

### 2. Decide section + screen counts

The per-preset ranges (sections, screens-per-section, quiz/form defaults, recommended counts) live in `${CLAUDE_PLUGIN_ROOT}/guidelines/products.md` ("Recommended counts at a glance" + "Structural shape"). Read that table and pick within the listed range based on topic depth, audience, and any explicit count signal from the prompt.

If your plan would have 1 section, the preset must be `campaign-simple`, `waitlist`, or `interactive-proposal` (see products.md "Structural shape").

Onboarding section — for `academy` preset only — typically 1–3 screens, sibling of the hub.

Onboarding section also possible for courses, as well as completion section, but not necessary, in case if the intro 
to course would add clear value, same for completion

### 3. Write `plan.md`

Path: `<workdir>/plan.md`. Overwrite.

```markdown
---
preset: <from intake>
key: <from intake>
academyName: <from intake — academy preset only>
mode: story                      # story | responsive
quizzes: on                      # on | off
forms: off                       # on | off
locales: [en]
---

# <H1 — the course title>

<optional one-line intro paragraph>

## Onboarding              (academy preset only)
- Screen 1 — <synopsis>
- Screen 2 — <synopsis>

## Section 1 — <title>
- Screen 1 — <synopsis>
- Screen 2 — <synopsis>
- Screen 3 — <synopsis>

## Section 2 — <title>
- Screen 1 — <synopsis>
...

## Template courses        (optional — see below)
- <Course title> | <one-line description>
- <Course title> | <one-line description>
```

**Template courses (opt-in, academy only).** Default: don't emit this section — the academy gets one authored course as usual. Add `## Template courses` ONLY when the user asks for several / placeholder / template courses, or clearly lists multiple course topics for the academy. Each line is `Title | one-line description`; these become content-less course shells (the user fills them later in the CMS — they use a default lesson scaffold and the product theme, no custom backgrounds). If the user wants onboarding + only template courses (no authored course), write the `## Onboarding` section and the `## Template courses` list but **omit the `## Section N` blocks** — the authored course is then skipped.

**H1 meaning:**
- `academy` → H1 is the **first course's** title (e.g. "What is Phantom?"). The academy name itself goes in the `academyName` frontmatter field.
- `academy-course` → H1 is the course being added to an existing academy.
- All other presets → H1 is the flow / campaign title.

Synopses are ONE LINE each — what the screen is about, not the actual copy.

### 4. Self-checks

- Frontmatter contains all required fields: `preset`, `key`, `mode`, `quizzes`, `forms`, `locales`.
- `mode` is `story` or `responsive`. `quizzes` / `forms` are `on` or `off`. `locales` is a list (e.g. `[en]` or `[en, de]`).
- Section count is within the preset's range.
- Each section has ≥ 1 screen.
- Screen bullets use the exact form `- Screen N — <synopsis>` (em-dash or hyphen).
- `## Onboarding` appears ONLY for the `academy` preset, before the first `## Section`.
- Single-section plans use one of `campaign-simple` / `waitlist` / `interactive-proposal`.

### 5. Show and iterate (optional)

For interactive use, you can show the plan and ask the user "Add / remove / rename anything?" before saving. For the orchestrator's one-prompt flow, skip iteration — write directly.

### 6. Hand off

Tell the user where the plan is. Next stage: `/luly-style`.

## Hard rules

- Single file: `<workdir>/plan.md`.
- Markdown only. The assembler parses this directly at stage 5; no separate parsed sidecar.
- Synopses are signal, not content. Stage 4 writes the actual copy.
- Section count must respect the preset's range.
- Do not run any other skill in this conversation.
