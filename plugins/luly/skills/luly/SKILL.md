---
name: luly
description: |
  Create a Luly product end-to-end from a single natural-language prompt. Use when the user asks to create / make / build / generate / set up / draft a Luly academy, course, marketing campaign, waitlist, sales proposal, interactive pitch, or any "add a course / lesson to my academy" task. Also triggers on phrases like "I need a flow that ...", "build me a landing for ...", "make a quick training on ...". Run the full authoring pipeline internally in one conversation, defaulting aggressively, asking the user only when something is genuinely ambiguous. Output a single importable JSON file at tmp/luly-agent/<key>.luly.json. This is the primary user-facing skill — the per-stage /luly-* skills are internal building blocks the user does not invoke.
---

# Luly — one-prompt orchestrator

The user types ONE thing. You run the whole pipeline and hand them back a JSON file ready to import into the CMS. **You never tell the user to type `/luly-brief`, `/luly-plan`, or any other per-stage command.** You execute every stage inline, in this conversation, by reading per-stage skill files and running their validator scripts directly via Bash.

The user wants a result. Get them one with minimum interruption.

## When to trigger

Auto-trigger on any of these intents:
- "create / build / make / generate / set up / draft / I need / I want" + ("flow", "course", "academy", "campaign", "marketing", "waitlist", "landing", "training", "proposal", "pitch", "onboarding", "lesson plan")
- "add a course / lesson to ..."
- An explicit `/luly` invocation

When you trigger, immediately start working. Don't ask "ok shall I begin?" — they already asked.

## When NOT to trigger

- The user is asking how something works ("what does /luly-plan do?") — answer the question, don't run the pipeline.
- The user is in the middle of using a per-stage skill — let them finish.
- The user is reviewing existing output — answer their question.

---

## Pipeline

You run stages in this order. For each stage:

1. **Read the per-stage skill file** at `${CLAUDE_PLUGIN_ROOT}/skills/luly-<name>/SKILL.md` first — that file is the source of truth for what to write and how.
2. Follow its instructions to produce the artifact in `tmp/luly-agent/`.
3. Run its validator script (where one exists) via Bash: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-<name>` or the script the skill specifies.
4. If the validator fails: try ONE mechanical fix (typo, missing field). If it still fails, print the error verbatim and stop.
5. Emit one progress line, then move on.

### Stage table

| # | Skill | Output file | Skip when |
|---|---|---|---|
| 0 | `luly-brief` | `brief.json` | (always run) |
| 1 | `luly-product-type` | `product-type.json` | (always run) |
| 2 | `luly-plan` | `plan.md` (+ `plan.parsed.json` sidecar) | (always run) |
| 3 | `luly-format` | `format-profile.json` | (always run) |
| 4 | `luly-style` | `theme.json` | (always run) |
| 4b | `luly-icon` | `card-cover.svg` + `course-icon.svg` | preset ∈ {`campaign-simple`, `waitlist`, `interactive-proposal`} |
| 5 | `luly-fill-lesson` | `lesson-<N>.json` per lesson | (always run) |
| 5a | `luly-fill-onboarding` | `onboarding.json` | `plan.parsed.json.onboarding` is empty (typically only academy preset has onboarding) |
| 6 | `luly-overrides` | `overrides.json` | user didn't explicitly ask for per-screen variation |
| 7 | `apply-controls` (script) | `controls.json` | (always run; deterministic) |
| 8 | review agents | — | (skipped by default; user can run `/luly-review-content` or `/luly-review-style` manually) |
| 9 | `assemble` (script) | `<key>.luly.json` | (always run; final) |

**Why this order:** `theme.json` is produced before any content, so image captions in stage 5 can reference real HEX values from the theme. `luly-icon` runs right after style so the SVGs use the resolved palette. Content (stage 5) then knows both the brand and the theme.

### Routing rules per preset

| Preset | luly-icon (4b) | luly-fill-onboarding (5a) |
|---|---|---|
| `academy` | yes | yes (plan declares onboarding) |
| `academy-course` | yes | no (no onboarding) |
| `campaign-course` | yes | no |
| `campaign-simple` | **no** (no hub) | no |
| `waitlist` | **no** | no |
| `interactive-proposal` | **no** | no |

If a stage is skipped, don't emit a progress line for it.

### Progress reporting

After each completed (or skipped) stage, print one line in this exact shape:

```
<stage label>             ✓ <one-line summary>
```

Don't paragraph. Don't explain. Status lines only. At the end, print the final file path + the import instruction.

---

## Slot extraction (parse the user's prompt once)

For each slot below, extract from the prompt if present; otherwise use the default. **Do not ask the user about a slot you can default.**

| Slot | Look for | Default |
|---|---|---|
| preset | preset signals (see below). Default to `campaign-simple` for marketing/promo/landing/lead-gen prompts unless the user explicitly mentions multi-step / drip / nurture / X-lesson / weekly series. Topic nouns like "german courses" describe the subject, NOT the structure. | `campaign-simple` if marketing-ish; ask only if genuinely between two |
| topic | the noun phrase ("german courses", "crypto basics", "Phantom") | required — ask once if missing |
| audience | "for beginners / pros / mixed / mobile users / B2B / ..." | "general audience" |
| tone | "funny / serious / friendly / professional / technical / minimal / playful / ..." | inferred from preset; campaign defaults to "friendly, concrete"; academy defaults to "clear, supportive" |
| has-quizzes | "quizzes / tests / questions" → on; "no quiz" → off | preset default |
| has-form | "form / signup / waitlist / capture emails" → on; "no form" → off | preset default |
| form copy hints | "first 50 users discount", "early access", "join the beta" — preserve verbatim for stage 5 | use generic copy |
| locales | "in german, english, spanish" — set locales | `["en"]` |
| brand | a specific company is named ("Phantom academy", "Wallet onboarding", "Base campaign") → trigger brand research in stage 0 (see `luly-brief`) | absent → freeform |

### Preset signals

| Preset | When to pick | Default tree |
|---|---|---|
| `academy` | "academy", "school", "learning hub", "training program" | flow → onboarding + hub → 1 course → lessons → screens |
| `academy-course` | "add a course to (the) academy", "extend the X academy" | course-only top level (no flow wrapper) |
| `campaign-course` | **explicit** "multi-step", "drip", "nurture sequence", "X-lesson series", "weekly campaign" | flow → hub → course → multiple lessons |
| `campaign-simple` | default for "marketing campaign", "promo", "launch", "landing", "ad campaign", "lead-gen" | flow → hub → course → 1 lesson |
| `waitlist` | "waitlist", "early access", "email signup", "lead capture" | same as campaign-simple, form-focused |
| `interactive-proposal` | "sales proposal", "pitch deck", "demo for client X" | same as campaign-simple, pitch-structured |

**Single-lesson → never `campaign-course`.** If the plan in stage 2 would emit 1 lesson with N screens, the preset MUST be one of `campaign-simple` / `waitlist` / `interactive-proposal` / `academy-course`. Switch BEFORE writing `product-type.json`.

---

## When to ask the user

Ask only if all three are true:
1. A slot is genuinely missing from the prompt.
2. No reasonable default exists.
3. The choice meaningfully changes the output.

Examples worth asking:
- Two preset candidates equally plausible ("make a sales pitch for X" → `interactive-proposal` or `campaign-simple`?).
- Topic missing entirely.

Don't ask: tone, lesson count, theme, locale, form copy specifics, image choices. Trust the defaults and per-preset ranges; the user can iterate after import.

One question per pause, then resume.

---

## Hand-off

When stage 9 succeeds, end with this format:

```
✓ Done.

File: tmp/luly-agent/<key>.luly.json
- Type: <flow | course>
- Lessons: N · Screens: M · Blocks: K

To use it: open the CMS at {your tenant}.luly.io/cms, click Import, select that file.
For `academy-course` output specifically: use the "import under existing flow" path to attach it to your existing academy hub.
```

Don't propose further work unless the user asks.

---

## Hard rules

- **Never tell the user to type any `/luly-*` slash command.** You run the pipeline; they don't.
- **Default aggressively.** Slot missing? Use the default. Don't interrogate.
- **One progress line per stage.** Status, not narrative.
- **Validators are gates.** Every artifact must pass its validator before moving on. One mechanical retry, then surface the error and stop.
- **Per-stage skills are source of truth.** When the per-stage skill says something different from your prior knowledge, the skill wins. Read the skill file before each stage; don't rely on memorized rules.
- **Do not run `luly-overrides`** unless the user explicitly asked for per-screen variation.
- **Do not run review agents** by default. Faster default is no review.
- **Do not invoke other skills via the Skill tool.** Call validator/assembler scripts directly via Bash.

---

## Failure protocol

If a step fails after one mechanical retry:
1. Print the validator's error message verbatim.
2. Tell the user which file is at fault and how to inspect it (`cat tmp/luly-agent/<file>`).
3. Stop. Do not proceed to later stages.

If the user fixes the file manually, re-run the failing validator and continue from there.
