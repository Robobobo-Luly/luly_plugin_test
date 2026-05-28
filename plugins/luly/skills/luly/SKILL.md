---
name: luly
description: |
  Create a Luly product end-to-end from a single natural-language prompt. Use when the user asks to create / make / build / generate / set up / draft a Luly academy, course, marketing campaign, waitlist, sales proposal, interactive pitch, or any "add a course / lesson to my academy" task. Also triggers on phrases like "I need a flow that ...", "build me a landing for ...", "make a quick training on ...". Run the 5-stage authoring pipeline internally in one conversation, defaulting aggressively. Output: tmp/luly-agent/<key>.luly.json ready to import into the Luly CMS.
---

# Luly — one-prompt orchestrator (v0.2)

The user types one thing. You run the 5-stage pipeline and hand back a JSON file ready for CMS import. **You never tell the user to type any `/luly-*` slash command** — you execute every stage inline.

## Writing guidelines (read once, apply everywhere)

Before generating any user-facing content (intake, plan, fill, non-section content, validator), read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and follow it. Those guidelines are authoritative — if a per-stage skill rule conflicts with them, the global guidelines win. Keep them in mind for every screen, title, description, quiz, and recap you write.

## Product matrix (per-preset shape, controls, tags, counts)

`${CLAUDE_PLUGIN_ROOT}/guidelines/products.md` is the single reference for how the six presets differ — structural shape, controls per node type, tags policy, quiz/form defaults, recommended counts, asset slots. Each per-stage skill links to relevant sections. When a preset rule changes, update products.md first and let the skills point at it — don't fork rules into individual skill files.

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
2. Follow its instructions to produce the artifact in your `<workdir>` (the per-run subdir from Step 0). Per-stage skills reference paths like `<workdir>/intake.md` — substitute the actual path.
3. Emit one progress line, then move on.

After all 5 stages, run the assemble script with the workdir as its argument:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly assemble "<workdir>"
```

It reads all markdown artifacts + optional SVGs, parses, computes controls, compiles Markdown to TipTap, applies the theme, stamps slugs and ranks, validates, and writes the final JSON.

### Stage table

| # | Skill | Output |
|---|---|---|
| 1 | `luly-intake` | `intake.md` |
| 2 | `luly-plan` | `plan.md` |
| 2.5 | `luly-meta` | `meta.md` (title, description, tags, hub-logo decision) |
| 3 | `luly-style` | `theme.md` |
| 4 | `luly-fill` | `content.md` (+ `recaps/section-N-recap.md` per section) |
| 4.5 | `luly-validate` | `validate-report.md` — guideline compliance (auto-fix mechanical issues; ask user on substantive ones) |
| — | `assemble` (script) | `<key>.luly.json` |

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
| maxImages | "with illustrations / with visuals / draw images / illustrated / max images" → on | off — image blocks ship caption-only and use the flow-level `mediaPlaceholderUrl` placeholder |

## When to ask the user

Ask only if all three are true:
1. A slot is genuinely missing.
2. No reasonable default exists.
3. The choice meaningfully changes the output.
4. Ambiguity about the target company name (i.e. there are several companies with that name) 

Examples worth asking:
- Two preset candidates equally plausible ("make a sales pitch for X" → `interactive-proposal` or `campaign-simple`?).
- Topic missing entirely.

Don't ask: tone, count, theme, locale, form copy specifics, image choices.

One question per pause, then resume.

## Step 0 — create a fresh per-run workdir (mandatory)

**Before stage 1**, derive a short kebab-case label from the user's prompt (e.g. "phantom academy" → `phantom-academy`, "solana summit waitlist" → `solana-summit-waitlist`) and create a fresh subdirectory under `tmp/luly-agent/` for this run. If a directory with that label already exists, append ` (1)`, ` (2)`, etc. until you find a name that doesn't collide.

Use Bash:

```bash
# Substitute the kebab-case topic label you derived
BASE="tmp/luly-agent/phantom-academy"
WORKDIR="$BASE"
n=1
while [ -d "$WORKDIR" ]; do
  WORKDIR="$BASE ($n)"
  n=$((n+1))
done
mkdir -p "$WORKDIR"
echo "$WORKDIR"
```

The output path is your **workdir for this run** — pass it as the `<workdir>` placeholder when reading each per-stage skill and when running the assembler. Every artifact for this generation lives inside that directory. Old runs in sibling directories stay untouched.

If the user explicitly asks to **resume** a partial generation against a specific existing dir, use that dir as the workdir instead of creating new.

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
