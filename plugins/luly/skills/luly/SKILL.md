---
name: luly
description: |
  Create a Luly product end-to-end from a single natural-language prompt. Use when the user asks to create / make / build / generate / set up / draft a Luly academy, course, marketing campaign, waitlist, sales proposal, interactive pitch, or any "add a course / lesson to my academy" task. Also triggers on phrases like "I need a flow that ...", "build me a landing for ...", "make a quick training on ...". Run the 5-stage authoring pipeline internally in one conversation, defaulting aggressively. Output: tmp/luly-agent/<key>.luly.json ready to import into the Luly CMS.
---

# Luly — one-prompt orchestrator (v0.2)

The user types one thing. You run the 5-stage pipeline and hand back a JSON file ready for CMS import. **You never tell the user to type any `/luly-*` slash command** — you execute every stage inline.

## When to trigger

Auto-trigger on:
- "create / build / make / generate / set up / draft / I need / I want" + ("flow", "course", "academy", "campaign", "marketing", "waitlist", "landing", "training", "proposal", "pitch", "onboarding", "lesson plan")
- "add a course / lesson to ..."
- An explicit `/luly` invocation

Start working immediately. Don't ask "shall I begin?" — they already asked.

## When NOT to trigger

- The user is asking how something works — answer the question.
- The user is mid-stage in a per-stage skill — let them finish.
- The user is reviewing existing output — answer their question.

## Pipeline

For each stage:

1. **Read the per-stage skill file** at `${CLAUDE_PLUGIN_ROOT}/skills/luly-<name>/SKILL.md` — that file is the source of truth.
2. Follow its instructions to produce the artifact in `tmp/luly-agent/`.
3. Emit one progress line, then move on.

After all 5 stages, run the assemble script:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly assemble
```

It reads all 4 markdown artifacts + 2 SVGs (if present), parses, computes controls, compiles Markdown to TipTap, applies the theme, stamps slugs and ranks, validates, and writes the final JSON.

### Stage table

| # | Skill | Output | Skip when |
|---|---|---|---|
| 1 | `luly-intake` | `intake.md` | (always run) |
| 2 | `luly-plan` | `plan.md` | (always run) |
| 3 | `luly-style` | `theme.md` (+ `card-cover.svg` + `course-icon.svg`) | SVGs skipped when preset ∈ {`campaign-simple`, `waitlist`, `interactive-proposal`} |
| 4 | `luly-fill` | `content.md` | (always run) |
| — | `assemble` (script) | `<key>.luly.json` | (always run; final) |

### Progress reporting

After each stage, print one line in this exact shape:

```
<stage label>             ✓ <one-line summary>
```

Status, not narrative. At the end, print the final file path + the import instruction.

## Slot extraction (parse the user's prompt once)

Extract from the prompt if present; otherwise default. **Don't ask about a slot you can default.**

| Slot | Look for | Default |
|---|---|---|
| topic | the noun phrase ("german courses", "Phantom") | required — ask once if missing |
| brand | a specific company is named → triggers brand research in stage 1 (luly-intake) | absent → freeform |
| explicit count | "5 lessons", "10 screens" — pass to luly-plan | none (plan picks from preset range) |
| depth signal | "quick / intro" or "deep dive / comprehensive" — preserve as natural-language signal | none |
| audience | "for beginners / pros / mixed / mobile users / B2B" | "general audience" |
| tone | "funny / serious / friendly / professional / technical / playful" | inferred from preset |
| has-quizzes | "quizzes / questions" → on; "no quiz" → off | preset default |
| has-form | "form / signup / waitlist / capture emails" → on; "no form" → off | preset default |
| form copy hints | "first 50 users discount", "early access" — preserve verbatim for stage 4 | use generic copy |
| locales | "in german, english, spanish" | `[en]` |

### Preset selection signals

| Preset | When to pick |
|---|---|
| `academy` | "academy", "school", "learning hub", "training program" |
| `academy-course` | "add a course to (the) academy", "extend the X academy" |
| `campaign-course` | **explicit** "multi-step", "drip", "nurture sequence", "X-lesson series" |
| `campaign-simple` | default for "marketing campaign", "promo", "launch", "landing", "ad campaign", "lead-gen" |
| `waitlist` | "waitlist", "early access", "email signup", "lead capture" |
| `interactive-proposal` | "sales proposal", "pitch deck", "demo for client X" |

**Single-section → never `campaign-course`.** If the plan would emit 1 section, the preset must be `campaign-simple` / `waitlist` / `interactive-proposal` / `academy-course`.

## When to ask the user

Ask only if all three are true:
1. A slot is genuinely missing.
2. No reasonable default exists.
3. The choice meaningfully changes the output.

Examples worth asking:
- Two preset candidates equally plausible ("make a sales pitch for X" → `interactive-proposal` or `campaign-simple`?).
- Topic missing entirely.

Don't ask: tone, count, theme, locale, form copy specifics, image choices.

One question per pause, then resume.

## Migrating from v0.1.x

If `tmp/luly-agent/` contains old artifacts (`brief.json`, `product-type.json`, `format-profile.json`, `lesson-*.json`, etc.), they're ignored by v0.2. Clear the directory before running a fresh v0.2 generation, or accept that the new generation will overwrite only the new artifacts and leave the old ones alongside.

## Hand-off

When assemble succeeds, end with:

```
✓ Done.

File: tmp/luly-agent/<key>.luly.json
- Type: <flow | course>
- Sections: N · Screens: M · Blocks: K

To use it: open the CMS, click Import, select that file.
For `academy-course` output specifically: use the "import under existing flow" path to attach it to your existing academy hub.
```

Don't propose further work unless the user asks.

## Hard rules

- Never tell the user to type any `/luly-*` slash command. You run the pipeline; they don't.
- Default aggressively.
- One progress line per stage.
- Per-stage skills are source of truth. Read each before doing that stage.
- The assemble script is the only validator — there are no per-stage validator gates in v0.2.
- Don't invoke other skills via the Skill tool. Run the assemble script via Bash.
