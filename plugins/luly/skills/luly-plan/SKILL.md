---
name: luly-plan
description: Step 2 of the Luly authoring pipeline. Read brief.json and product-type.json, draft a Markdown course or campaign outline (course title, lesson titles, screen synopses), iterate with the user, write plan.md. Use after /luly-product-type has run and before any content-writing stages. The cheap human-readable iteration gate.
---

# Luly — Step 2: Markdown plan

This is the cheap iteration gate. Get the structure right here — actual screen
copy comes in Step 4. See `docs/flow-json-schema.html` § Step 2 for context.

## Process

### 1. Load prior stages

Read `tmp/luly-agent/brief.json` and `tmp/luly-agent/product-type.json`.

- If `brief.json` is missing → tell the user to run `/luly-brief` and stop.
- If `product-type.json` is missing → tell the user to run `/luly-product-type` and stop.

### 2. Pick the markdown shape from the preset

- preset `academy` or `campaign-course` → **with-lessons** shape (H1 course title, then `## Lesson N — title` sections each holding screens)
- preset `campaign-simple`, `waitlist`, `interactive-proposal` → **screens-only** shape (H1 campaign title, then `- Screen N: ...` bullets directly under H1)

For an `academy` preset, plan **one course only** — the first one the academy
will hold. Adding more courses later is a separate flow.

### 3. Lesson and screen counts

Pick within each preset's range, honoring any explicit signal in the brief.

| Preset | Lessons | Screens per lesson |
|---|---|---|
| `academy` | 2–8 | 3–5 |
| `academy-course` | 2–8 | 3–5 |
| `campaign-course` | 2–6 | 3–5 |
| `campaign-simple` | 1 | 4–7 |
| `waitlist` | 1 | 3–5 |
| `interactive-proposal` | 1 | 5–8 |

If your plan would emit 1 lesson, the preset must be `campaign-simple`, `waitlist`, or `interactive-proposal`.

### 4. Draft the markdown

Use **exactly** these line formats — the validator regexes are strict:

- Course title: `# <title>` (exactly one H1) — for `academy` preset this is the **first course's name** (e.g. "What is Blockchain"), NOT the academy name; the academy name lives in `product-type.academyName`. For all other presets the H1 is the flow / workspace / campaign name.
- **Onboarding section (academy preset only, optional)**: `## Onboarding` followed by `- Screen N: <synopsis>` bullets (N sequential 1..K). The section is a sibling of the lesson sections and must come before the first `## Lesson`. Use 2–3 onboarding screens for `academy`: "Welcome", "What you'll learn", optionally "Get started". **Do NOT add an onboarding section for any other preset — including `academy-course`, which adds a course to an existing academy that already has its own onboarding.**
- Lesson heading: `## Lesson N — <title>` (em-dash or hyphen, N starts at 1, sequential)
- Screen bullet: `- Screen N: <one-line synopsis>` (N sequential within its lesson, onboarding section, or under H1)

Optional one-line intro paragraph between H1 and the first lesson, bullet, or
onboarding section is allowed — it's preserved in the parsed sidecar as `intro`.

Synopses are one short line each — no full screen copy. That's Step 4's job.

Example (with-lessons, academy preset — note onboarding):

```markdown
# Crypto Wallet Academy

3 lessons. Beginners. Stories format.

## Onboarding
- Screen 1: Welcome — what you'll learn here
- Screen 2: How progress works

## Lesson 1 — Your first wallet
- Screen 1: What a wallet is, in 30 seconds
- Screen 2: Custodial vs self-custody
- Screen 3: Quiz — which one do you have?
```

Example (with-lessons, non-academy — no onboarding):

```markdown
# Crypto Wallet Basics

3 lessons. Beginners. Stories format.

## Lesson 1 — Your first wallet
- Screen 1: What a wallet is, in 30 seconds
- Screen 2: Custodial vs self-custody
- Screen 3: Quiz — which one do you have?
```

Example (screens-only):

```markdown
# Early Access — Mako Wallet

7-screen waitlist flow.

- Screen 1: Hero pitch
- Screen 2: The problem we solve
- Screen 3: What you'll get
- Screen 4: Social proof
- Screen 5: Email capture
- Screen 6: Referral bonus
- Screen 7: Thank-you + share
```

### 5. Show and iterate

Show the draft to the user. Ask: "Add / remove / rename anything?" Iterate
until they explicitly approve. Don't tune wording for the synopses — keep them
short and signal-only.

### 6. Write and validate

Write `tmp/luly-agent/plan.md`. Overwrite any existing file without prompting.

Then run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-plan
```

The validator writes a parsed sidecar at `tmp/luly-agent/plan.parsed.json`
which downstream stages consume. Report the one-line summary (shape, lesson
count, screen count) back to the user.

If validation fails, fix the markdown and re-run.

### 7. Hand off

Tell the user:
- The plan is at `tmp/luly-agent/plan.md`.
- The parsed sidecar is at `tmp/luly-agent/plan.parsed.json`.
- Next stage is `/luly-format` (when it ships).

## Hard rules

- Read-only on `brief.json` and `product-type.json`.
- Write only to `tmp/luly-agent/plan.md`. Do **not** write `plan.parsed.json`
  by hand — the validator owns it.
- Do not invent new line formats. The three regexes are the contract.
- Do not write actual screen copy. Synopses are signal, not content.
- Do not run any other skill in this conversation.
