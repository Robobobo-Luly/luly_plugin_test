---
name: luly-product-type
description: Step 1 of the Luly authoring pipeline. Read brief.json, pick one of five product presets (academy / campaign-simple / campaign-course / waitlist / interactive-proposal), generate a product key, write product-type.json. Use after /luly-brief has written tmp/luly-agent/brief.json and before any later stage.
---

# Luly — Step 1: Product type

See `docs/flow-json-schema.html` § Step 1 for context. This skill makes the
first hard decision in the pipeline: which of five product presets fits the
brief, and what product key to use.

## Process

### 1. Load the brief

Read `tmp/luly-agent/brief.json`. If it does not exist, stop and tell the user
to run `/luly-brief` first.

### 2. Propose a preset

Match the brief's `intent` (and `audience` if useful) to one of these signals:

| Signals | Preset | User-facing name |
|---|---|---|
| "academy", "school", "learning hub", "training program" | `academy` | Academy |
| "add a course to my academy", "extend the X academy", "another course for…" | `academy-course` | Course (added to existing academy) |
| "marketing", "launch", "promo", "landing", "ad campaign", "lead-gen" — **default for any plain "marketing campaign"** | `campaign-simple` | **Basic campaign** |
| **EXPLICIT** "drip campaign", "multi-step campaign with lessons", "X-lesson nurture flow", "weekly series" — REQUIRES explicit multi-lesson cue | `campaign-course` | **Advanced campaign** |
| "waitlist", "early access", "email signup", "lead capture" | `waitlist` | Waitlist |
| "proposal", "pitch", "sales deck", "demo", personalised pitch | `interactive-proposal` | Interactive proposal |

### Academy preset — two distinct names

For `academy` preset, the artifact has **two name slots**:

- `academyName` (REQUIRED for academy): the workspace + hub title (e.g. "Blockchain Academy"). Generated from the user's brief.
- The plan.md H1 (next stage, separate): the **first course's name** (e.g. "What is Blockchain").

Without `academyName` the flow / hub / course will all collapse to the same string (which is the bug we're avoiding). Extract BOTH names from the user's prompt when you set this artifact up.

Optional fields you may add (academy / academy-course / campaign-course):
- `academyDescription` — one-line tagline; lands on flow.description. Only for `academy`.
- `courseAuthor` — author or brand name from the brief; lands on course.body.author. Empty by default.

### Hard rule: basic vs advanced campaign

**Single-lesson campaign → `campaign-simple` (basic). Always.**

`campaign-course` (advanced) is **only valid** when the user explicitly mentions multi-lesson structure ("drip", "nurture sequence", "5-lesson series", "multi-step weekly", "course-shaped marketing flow"). If they didn't say it, do not pick it.

Two checks before locking in the preset:

1. **Topic-noun trap.** Words like "courses", "lessons", "catalog", "training" inside the brief's topic phrase are subject matter, not structural cues. "Campaign for my German courses" → `campaign-simple`. "Promo for our course catalog" → `campaign-simple`. The campaign itself is single-funnel; "courses" describes what's being promoted.
2. **One-lesson check.** If the plan that comes next would be 1 lesson, the preset MUST be one of `campaign-simple`, `waitlist`, `interactive-proposal`, or `academy-course`. It can NEVER be `campaign-course`. Adjust the preset BEFORE writing this artifact.

`academy-course` is the **add-to-existing** flow: the user has an academy already and wants to extend it with one more course. The output is a **course-only JSON** (no flow wrapper, no hub, no theme) — they import it under their existing academy via the CMS Import → "import into existing flow" path. If the user is creating a brand new academy from scratch, use `academy` instead.

Pick the single best match. Show the proposal as one line, e.g.:

> Suggested preset: **`waitlist`** — collects emails on a single page; matches the brief's "early access signup".

Confirm with one question, offering the other four labels as alternatives.

### 3. Generate a product key

From the brief's intent, generate a kebab-case key:

- 3–50 characters
- only lowercase ASCII letters, digits, and single hyphens
- no leading, trailing, or double hyphens

E.g. "Onboard new crypto wallet users" → `crypto-wallet-onboarding`.

Show the key. Let the user override before continuing.

### 4. Write a rationale

One sentence saying why this preset fits — use the user's own framing where
you can.

### 5. Write the file

Write `tmp/luly-agent/product-type.json`:

```json
{
  "preset":    "<one of: academy | academy-course | campaign-simple | campaign-course | waitlist | interactive-proposal>",
  "key":       "<kebab-case key>",
  "rationale": "<one sentence>",
  "academyName": "<academy preset only — workspace + hub title, REQUIRED>",
  "academyDescription": "<academy preset only, optional — one-line tagline>",
  "courseAuthor": "<academy / academy-course / campaign-course only, optional — author or brand>"
}
```

For `academy` preset, include `academyName` (the user-facing name of the academy itself). The plan.md H1 will be the first course's name — they are different. For non-academy presets, omit the academy-specific fields entirely.

If the file already exists, overwrite it without prompting.

### 6. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-product-type
```

Report the result. If validation fails, fix the file and re-run. Do not move
on until it passes.

### 7. Hand off

Tell the user:
- The file is at `tmp/luly-agent/product-type.json`.
- The validator printed the derived identity tuple — let them sanity-check it.
- Next stage is `/luly-plan` (once it ships).

## Hard rules

- Read-only on `brief.json`. Never modify it.
- Write only to `tmp/luly-agent/product-type.json`.
- Do not invent new presets. Five exist; pick one.
- Do not store `productType` / `flowType` / `product` / `campaignType` /
  `template` in the artifact — those are derived from `preset` by the
  validator and the assembler.
- Do not run any other skill in this conversation.
