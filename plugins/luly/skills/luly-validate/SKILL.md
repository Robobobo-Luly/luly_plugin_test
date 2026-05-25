---
name: luly-validate
description: Final stage of the Luly authoring pipeline (before assemble). Read the writing guidelines, check every generated artifact against them, auto-fix mechanical violations, and report substantive ones for the user to decide. Runs after fill, before assemble.
---

# Luly — Stage 4.5: Validate against writing guidelines

You do a guideline-compliance pass over the generated content. You **do not** invent new content. You either fix mechanical violations in place or surface substantive ones to the user.

## Process

### 1. Load the guidelines and artifacts

Read:
- `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` — the rulebook.
- `<workdir>/meta.md` — title, description, tags. (Optional file — skip checks if absent.)
- `<workdir>/content.md` — all screens.
- `<workdir>/plan.md` — for cross-referencing screen counts.

### 2. Mechanical checks — auto-fix in place

These are unambiguous, low-risk fixes. Edit the file directly without asking.

| Check | Rule (writing-guidelines.md ref) | Fix |
|---|---|---|
| Trailing period on a bullet line | §4 | Strip the trailing `.` |
| Trailing punctuation on a heading (`#`, `##`, `###`) | §4 | Strip the trailing `.`, `:`, `;`, `!`, `?` |
| Title not sentence case (e.g. "Getting Started With Aerodrome") | §2 | Convert to sentence case |
| Trailing whitespace on any line | hygiene | Strip |
| Emoji anywhere in any screen body or title | §1 | Remove the emoji |
| Smart quotes (`"` `"` `'` `'`) where straight quotes would do | hygiene | Convert to ASCII quotes |

After each auto-fix, log it in a temporary `<workdir>/validate-report.md` under a `## Auto-fixed` section: one line per fix, format `[file:line] <what was fixed>`.

### 3. Substantive checks — report, don't auto-fix

These need judgment. List each violation in `validate-report.md` under a `## Manual review needed` section, then **ask the user** how to proceed (accept as-is, or stop and let the user revise).

| Check | Rule | What to write in the report |
|---|---|---|
| Story body is not 3–4 sentences | §3 | `[Section N · Screen N] body is K sentences (expected 3–4)` |
| Story body is entirely a bullet list | §3 | `[Section N · Screen N] body is bullets-only — needs prose framing` |
| Lesson has zero quizzes or more than one quiz | §6 | `[Section N] has K quiz blocks (expected 1)` |
| Quiz has fewer than 2 or more than 3 questions | §6 | `[Section N quiz] has K questions (expected 2–3)` |
| Quiz question has !=3 options | §6 | `[Section N · Screen N quiz] has K options (expected 3)` |
| Correct-answer positions not shuffled across a lesson's quizzes (e.g. all `correct: a`) | §6 | `[Section N quiz] correct positions are [a, a, a] — shuffle expected` |
| Rhetorical question in any body (`?` ending a sentence that isn't a quiz/form prompt) | §1 | `[Section N · Screen N] contains rhetorical question: "<excerpt>"` |
| Body contains "..." or em-dash-heavy sentences (long compound) | §1 | `[Section N · Screen N] long compound sentence: "<excerpt>"` |
| Course title >4 words OR contains the brand/project name | §7 | `[meta.md] title is "<…>" — too long / contains brand name` |
| Course description is not one sentence (multiple sentences or empty) | §7 | `[meta.md] description is K sentences (expected 1)` |
| British English spellings (e.g. "colour", "organise") | §1 | `[Section N · Screen N] British spelling: "<word>" — use American` |

### 4. Cross-checks against plan.md

- Section count in content.md matches plan.md.
- Each section's screen count is within ±1 of the plan (off-by-one allowed for split screens per fill's rule).
- Mismatch beyond ±1 → log in report, ask user.

### 5. Write the report

Final shape of `<workdir>/validate-report.md`:

```markdown
# Validation report — <key>

Generated: <iso date>

## Summary
- Auto-fixed: N issues
- Manual review needed: M issues
- Cross-check status: <ok | mismatch>

## Auto-fixed
- [file:line] <description>
- ...

## Manual review needed
- [Section N · Screen N] <description>
- ...
```

If M = 0 and the cross-checks pass, the report still gets written but with an empty "Manual review needed" section.

### 6. Hand off

If M = 0: tell the user "Validation passed — N mechanical fixes applied" and move to assemble.

If M > 0: tell the user "Validation found M issues that need a decision" and use `AskUserQuestion`:
1. **Accept as-is, proceed to assemble** — log decision in report.
2. **Stop here, let me revise** — exit; user re-runs fill (whole or per-section) to fix.

Don't try to rewrite the content yourself for substantive issues. The author's choices matter; you're just the guard at the gate.

## Hard rules

- Read writing-guidelines.md every run. Don't cache rules from memory.
- Auto-fix only the mechanical table in §2. Anything ambiguous is a report-only item.
- Never delete a screen or quiz. Never add content. Editing == fixing in place, not authoring.
- Write `<workdir>/validate-report.md` exactly once per run, overwrite if present.
- Do not run any other skill in this conversation.
