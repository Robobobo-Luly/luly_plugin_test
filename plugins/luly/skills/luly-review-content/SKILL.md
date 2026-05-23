---
name: luly-review-content
description: Optional Step 8 reviewer of the Luly authoring pipeline. Reads the brief, the plan, and all lesson-*.json files and produces a Markdown review report at <workdir>/review-content.md flagging voice drift across lessons, brief misalignment, weak quizzes, synopsis mismatches, and questionable block-format choices. Pure quality lift — does not modify any other artifact, does not auto-fix. Run after /luly-fill-lesson has filled every lesson the plan requires; always optional.
---

# Luly content reviewer

You are reviewing the generated lesson content for quality. **You do not modify any lesson file** and you do not re-run any stage. Your only output is a Markdown report at `<workdir>/review-content.md`.

## Process

### 1. Load prior stages

Read:
- `<workdir>/brief.json`
- `<workdir>/product-type.json`
- `<workdir>/plan.parsed.json`
- `<workdir>/format-profile.json`
- all `<workdir>/lesson-*.json`

If `brief.json` or `plan.parsed.json` is missing, stop and tell the user to run the earlier skills first. If no `lesson-*.json` files exist at all, stop with the same message.

If only some lessons are filled (e.g., plan has 3 lessons, only `lesson-1.json` exists), proceed but mention in the report that the review covers only the filled lessons.

### 2. Review against each criterion below

For every lesson you have content for:

- **Brief alignment** — does the lesson serve `brief.intent` for `brief.audience` in the declared `brief.tone`?
- **Voice consistency across lessons** — first-person vs second-person, formal vs casual, jargon level. Flag any lesson whose voice drifts from the others. (This is the tone-consistency check folded in.)
- **Synopsis fidelity** — each screen's generated content should obviously match its planned synopsis from `plan.parsed.json`. Flag mismatches.
- **Block-format choice** — is `richtext` used where `image-richtext` would carry more weight? Are three consecutive `richtext` blocks killing rhythm? Are quizzes positioned at points where they add value?
- **Quiz quality** — are quiz `choices` substantive (not "yes/no" trivial), are the `correctAnswer`s actually correct given the screen content, are any answers given away verbatim in the same lesson?
- **Factual sanity** — flag any claim that looks made up, contradicted within the lesson, or contradicted by the brief.
- **Markdown content readability** — flag content that's too wall-of-text, missing headings, or over-formatted (every word emphasised).

### 3. Write the report

Write `<workdir>/review-content.md` in exactly this format:

```markdown
# Content review

## Verdict
**<pass | warn | fail>** — N findings (X high, Y warn, Z info)

## Findings

### [high|warn|info] <one-line title>
<location: e.g. "Lesson 2, screen 3, block 0" or "across lessons">
<what's wrong + concrete suggested fix, including which skill to re-run if needed>

### [high|warn|info] ...

## Recommendations
- <pattern-level suggestion>
- <another>
```

Severity rules:
- **`[high]`** — wrong, broken, or actively harmful. E.g., quiz answer is wrong; factual error; voice drift severe enough that re-running stage 4 is warranted.
- **`[warn]`** — quality issue the user should know about but might accept.
- **`[info]`** — nice-to-have improvement; "consider…" territory.

Verdict mapping (compute, don't ask):
- 1+ high → **fail**
- 1+ warn, no high → **warn**
- only info, or zero findings → **pass**

If there are zero findings, the Findings section reads `_None._` and the Recommendations section may be omitted.

### 4. Report to user

Tell the user:
- The report is at `<workdir>/review-content.md`.
- The verdict (pass / warn / fail) and finding counts.
- If `fail` or `warn`: name the one or two highest-priority fixes from the report so the user can prioritise without reading the whole file.

## Hard rules

- Read-only on all prior stage artifacts. Do not modify `lesson-*.json`.
- Write only to `<workdir>/review-content.md`. Overwrite any prior report.
- Do not auto-fix issues. Your job is to surface them; the user decides what to re-run.
- Do not run any other skill in this conversation.
- The verdict must be computed mechanically from the severity counts — do not "round up" to pass just because most issues are minor.
