---
name: luly-meta
description: Stage 2.5 of the Luly authoring pipeline. Generate the non-section content — course title, description, tags, and hub-logo decision. Runs between Plan and Style. Output is a single meta.md the assembler prefers over plan-derived fields.
---

# Luly — Stage 2.5: Meta (title / description / tags / hub logo)

Plan defines the structure; Fill writes the lessons. Neither of them is the right place to craft the marketing-level title, the one-sentence description, the catalog tags, or the decision about which logo (if any) to show on the academy hub. This stage does that.

**Before writing**, read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and apply it — especially §7 "Course information":
- Course title: 3–4 words, sentence case, **does not contain the project / brand name**.
- Course description: one short sentence capturing the course overview.

## Process

### 1. Load prior stages

Read:
- `<workdir>/intake.md` — for topic, audience, tone, brand (if any)
- `<workdir>/plan.md` — for preset, section titles, scope

If either is missing, stop and tell the user.

### 2. Generate the four fields

**Course title (3–4 words, no project name, sentence case).**
- Capture the course's promise, not the brand: ✓ "Getting started with onboarding", "Your first swap" — ✗ "Phantom Academy onboarding 101", "Aerodrome guide".
- If the topic IS the brand (e.g. user explicitly asked for "Phantom academy"), the academy *name* carries the brand — the *course* title still should not.

**Course description (one short sentence).**
- 8–18 words. Tells a stranger what they'll get out of it.
- No marketing fluff. No promises. No exclamation points.

**Tags (3–5, lowercase, kebab-case).**
- Pick from the topic, audience, and category. Examples: `defi`, `wallet-setup`, `beginners`, `base-chain`, `liquidity-pools`.
- Stay general enough to group with related courses. Avoid hyper-specific tags that no other course would ever share.
- (Note: there is no fixed taxonomy yet — that's tracked in TODO.md. For now, free-form is fine; consistency comes later.)
- Tags render on course cards in the hub catalog. They apply to `academy`, `academy-course`, and `campaign-course` presets — for `campaign-simple` / `waitlist` / `interactive-proposal` they're harmless but unused (no card UI renders them). See `${CLAUDE_PLUGIN_ROOT}/guidelines/products.md` for the per-preset breakdown.

**Academy fields (academy preset only).**
- `academyName` — already present from intake; reuse verbatim. Don't reinvent.
- `academyDescription` — one short sentence about the academy as a whole (vs. one course inside it). 8–18 words.

**Hub-logo decision (academy preset only).**
- If intake.md has `Brand research result: verified` AND a logo URL is present AND the URL points to a real image asset (SVG, PNG, or JPG; not a placeholder string; not a 404), choose `hub-logo: brand-logo`.
- Otherwise choose `hub-logo: placeholder`. The assembler falls back to the flow-level `iconPlaceholderUrl`. **Do not auto-generate an SVG hub logo.**

### 3. Write `meta.md`

Path: `<workdir>/meta.md`. Overwrite. Shape:

```markdown
## Course
title: <3–4 words, sentence case, no brand name>
description: <one short sentence>
tags: [tag-1, tag-2, tag-3]

## Academy (academy preset only)
name: <from intake>
description: <one short sentence>
hub-logo: <brand-logo | placeholder>
```

For non-academy presets, omit the `## Academy` block entirely.

### 4. Self-checks before saving

- Title word count is 3–4.
- Title does not contain the brand / project name (check against intake.md's `Brand → Company` if present).
- Title has no trailing punctuation, no emojis, sentence case.
- Description is one sentence, no trailing punctuation other than a period.
- Tags is a 3–5 element list, kebab-case, lowercase.
- For academy preset: `## Academy` block present with all three keys.
- For other presets: `## Academy` block absent.

### 5. Hand off

Tell the user `meta.md` is written. Next stage: `/luly-style`.

## Hard rules

- Single file: `<workdir>/meta.md`.
- Title and description respect writing-guidelines.md §7 verbatim.
- Never invent a logo URL or auto-generate a hub logo SVG. Decision is binary: real brand logo (from verified intake) or placeholder.
- Do not run any other skill in this conversation.
