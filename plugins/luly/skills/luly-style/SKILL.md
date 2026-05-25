---
name: luly-style
description: Stage 3 of the Luly authoring pipeline. Generate the 22-token color palette + fonts, and design two SVG visuals (wide card cover + square course icon) when the preset has a hub catalog. Output is theme.md plus two .svg files. Absorbs the old luly-icon stage.
---

# Luly — Stage 3: Theme & visuals

One agent, three artifacts: a palette/fonts markdown, a wide card cover SVG, a square course icon SVG. The visuals use the resolved palette so they're brand-coherent.

## Process

### 1. Load prior stages

Read:
- `<workdir>/intake.md` — for brand colors (if present), tone, audience
- `<workdir>/plan.md` — for preset, course title, section titles (visual concept hints)

### 2. Honor brand colors when present

If `intake.md` has a `Colors:` block, **anchor the theme to those values verbatim**:

- `primary` from brand → theme `primary`
- `background` from brand → theme `background` (derive `surface` as a near-tint if not presented as a specific separate value)
- `secondary` from brand → theme `secondary`
- `text` from brand → theme `textColor`
- `accent` from brand → route to whichever token best fits (often `secondary` or `successLight`)
- Other brand colors → derive `primaryLight`, `border`, `disabled` from the brand palette via lightness shifts
- Header/footer/semantic tokens — generate to harmonize with the brand

Never override the brand's primary because you think a different color looks better.

If no brand colors, **use the default Luly palette in step 5 verbatim**. Do not invent a topic-themed palette from the brand name or category — when the brand is unknown, neutral beats confidently-wrong.

### 3. Pick fonts

`fontHeading` and `fontBody` MUST come from this closed list (verbatim CSS family strings):

```
"Inter", sans-serif
"Inter Tight", sans-serif
"SF Pro Display", -apple-system, sans-serif
"Roboto", sans-serif
"Matter", sans-serif
"Nunito", sans-serif
"Poppins", sans-serif
"Open Sans", sans-serif
"Montserrat", sans-serif
"Lato", sans-serif
```

Same-font pairs (Inter/Inter) are fine. For more character: Montserrat/Inter, Nunito/Open Sans, Poppins/Lato.

### 4. Contrast targets (mandatory)

| Pair | Target |
|---|---|
| `textColor` vs `background` | ≥ 7:1 (AAA) |
| `textOnPrimary` vs `primary` | ≥ 4.5:1 (AA) |
| `mutedTextColor` vs `background` | ≥ 4.5:1 (AA) |
| `surface` vs `background` | 5–15% lightness shift (distinguishable) |
| `headerText` vs `headerBackground` | ≥ 4.5:1 |
| `footerText` vs `footerBackground` | ≥ 4.5:1 |

A perfectly tonal palette that fails contrast is worse than a slightly less elegant palette that passes.

### 5. Write `theme.md`

Path: `<workdir>/theme.md`. Overwrite. Every line under `## Palette` and `## Fonts` MUST be a bulleted entry in the form `- key: value` — the parser ignores anything else. Color values are 6- or 8-char hex (`#RRGGBB` or `#RRGGBBAA`); no `rgba(...)`.

**Default Luly palette** — use verbatim when intake has no `Colors:` block:

```markdown
## Palette
- background: #FFFFFF
- surface: #F9F9F9
- primary: #0000FF
- primaryLight: #EEEEFF
- secondary: #01080E
- onSurface: #FAFAFA
- textColor: #141414
- mutedTextColor: #141414B2
- disabledTextColor: #999999
- textOnPrimary: #FFFFFF
- headerBackground: #FFFFFF
- headerText: #141414
- footerBackground: #01080E
- footerText: #FFFFFF
- border: #E9ECF1
- disabled: #E6E6E6
- success: #2CC95F
- successLight: #F4FCF7
- failure: #FF3549
- failureLight: #FFF2F6
- warning: #FF8000
- warningLight: #FFD9B3
- edit: #0000FF
- shadow: #0000001A

## Fonts
- heading: "Inter", sans-serif
- body: "Inter", sans-serif
- buttonBorderRadius: 12px
```

When intake DOES have brand colors, follow the rules in step 2 to override the relevant tokens (primary, background, secondary, text, accent) — keep the rest of this default palette as-is unless contrast targets force a change. All color tokens are required.


### 6. Hand off

Tell the user where the artifacts are. Next stage: `/luly-fill`.

## Hard rules

- Read-only on intake.md and plan.md.
- Write only to `theme.md` + (for hub presets) `card-cover.svg` + `course-icon.svg`.
- All color tokens present and valid hex.
- Fonts from the closed list, verbatim.
- Do not run any other skill in this conversation.
