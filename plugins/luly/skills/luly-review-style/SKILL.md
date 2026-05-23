---
name: luly-review-style
description: Optional Step 8 reviewer of the Luly authoring pipeline. Reads the brief, product-type, theme.json, and (if present) overrides.json. Produces a Markdown review report at <workdir>/review-style.md flagging theme-brief mismatch, contrast / a11y problems, font choices that fight each other, override sprawl, and button-shape vs tone mismatches. Pure quality lift — does not modify any styling artifact, does not auto-fix.
---

# Luly style reviewer

You are reviewing the workspace theme and per-screen overrides. **You do not modify any file** and you do not re-run any stage. Your only output is a Markdown report at `<workdir>/review-style.md`.

## Process

### 1. Load prior stages

Read:
- `<workdir>/brief.json`
- `<workdir>/product-type.json`
- `<workdir>/theme.json`
- `<workdir>/overrides.json` if it exists (it's optional)
- `<workdir>/plan.parsed.json` (used only to count screens for override-sprawl ratio)

If `theme.json` is missing, stop and tell the user to run `/luly-style` first.

### 2. Resolve the theme

Apply `theme.overrides` (if present) on top of `theme.preset`'s defaults, using the token list in `docs/flow-json-schema.html` § Step 5 (the 18 required color tokens and the style/layout tokens). You don't need to run a script — reason about the final values in your head from the preset name and the listed overrides.

### 3. Review against each criterion below

- **Brief alignment** — does the resolved theme match `brief.tone`? `"friendly, warm"` + `dark-tech` preset is a mismatch. Severity scales with how badly the mood clashes.
- **Contrast** — eyeball the contrast ratio for the highest-traffic pairs and flag any that look like they'd fail WCAG AA (4.5:1 body, 3:1 large text). Pairs to check:
  - `textColor` vs `background`
  - `mutedTextColor` vs `background`
  - `textOnPrimary` vs `primary`
  - `textColor` vs `surface`
- **Font coherence** — `fontHeading` and `fontBody` should complement each other. Flag pairs that fight (two heavy serifs, two display fonts, body font more elaborate than heading).
- **Override sprawl** — if `overrides.json` exists, count overridden screens. If overridden screens > 50% of all screens, flag as brand-inconsistency risk.
- **Button shape vs tone** — sharp corners (0–4px `buttonBorderRadius`) suit tech / brutalist tone; soft corners (12+px) suit lifestyle / warm. Pill (24+px or `9999px`) suits playful. Flag obvious mismatches.
- **Style-token consistency** — flag any override that breaks visible coherence (e.g., very small `buttonHeight` paired with very large `containerBorderRadius`).

### 4. Write the report

Write `<workdir>/review-style.md` in exactly the same format as `luly-review-content`:

```markdown
# Style review

## Verdict
**<pass | warn | fail>** — N findings (X high, Y warn, Z info)

## Findings

### [high|warn|info] <one-line title>
<location: e.g. "theme.colors", "override on lesson-1.screen-1">
<what's wrong + concrete suggested fix, naming which skill to re-run if needed>

## Recommendations
- <pattern-level suggestion>
```

Severity rules:
- **`[high]`** — would make the product unreadable or break brand (failing contrast for body text; preset clashes wildly with brief tone).
- **`[warn]`** — quality issue the user should know about (font pair is off; one contrast pair on edge).
- **`[info]`** — nice-to-have ("consider lighter `surface` for breathing room").

Verdict mapping is mechanical: any high → **fail**; any warn (no high) → **warn**; else → **pass**.

If there are zero findings, the Findings section reads `_None._` and Recommendations can be omitted.

### 5. Report to user

Tell the user:
- The report is at `<workdir>/review-style.md`.
- The verdict and finding counts.
- If `fail` / `warn`: name the one or two highest-priority issues so the user can prioritise without reading the whole file.

## Hard rules

- Read-only on all prior stage artifacts. Do not modify `theme.json` or `overrides.json`.
- Write only to `<workdir>/review-style.md`. Overwrite any prior report.
- Do not propose specific hex codes unless the user explicitly asks. Flag the issue and recommend a direction (e.g. "lighten `mutedTextColor` toward `textColor`"), not a precise value.
- Do not auto-fix. Surface the issue; the user re-runs `/luly-style` if they want a change.
- Do not run any other skill in this conversation.
- The verdict must be computed mechanically from severity counts.
