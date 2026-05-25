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

If intake also captured `ButtonBorderRadius` / `ContainerBorderRadius`, anchor the corresponding style tokens (`buttonBorderRadius`, `containerBorderRadius`) to those values verbatim. If only `ButtonBorderRadius` is present, derive `containerBorderRadius` as the same value or a slightly larger one (cards usually round a bit more than buttons). If neither is present, use the default Luly value below.

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
- containerBorderRadius: 16px
```

When intake DOES have brand colors, follow the rules in step 2 to override the relevant tokens (primary, background, secondary, text, accent) — keep the rest of this default palette as-is unless contrast targets force a change. All color tokens are required.


### 6. SVG asset dimensions (must match exactly)

When the preset has a hub catalog (`academy`, `academy-course`, `campaign-course`), also write these SVG files to `<workdir>`. **The viewBox dimensions below are not suggestions — the CMS renders each asset in a fixed-aspect frame and a mismatch produces visibly squished or letterboxed content.**

| File | viewBox | Aspect | Used for |
|---|---|---|---|
| `card-cover.svg` | `0 0 1600 900` | **16:9** | Course card hero (hub catalog + course header) |
| `course-icon.svg` | `0 0 256 256` | **1:1** | Course icon next to the author byline |
| `hub-logo.svg` | `0 0 256 256` | **1:1** | Academy hub logo — **only write when intake authorized real brand logo** (see step 7) |
| `logo.svg` | typically `0 0 256 64` or whatever matches the brand mark | brand-dependent | Header logo — copied from intake's brand discovery, do NOT redraw |

Other rules for these SVGs:
- Use the resolved palette HEX from this theme — no invented colors.
- Keep them small (≤ 4 KB each). Simple shapes, ≤ 1 gradient.
- No `<script>`, no external `<image href>`, no `xlink:href` to remote URLs.

### 7. Placeholder SVGs (every preset)

Generate three small branded SVGs into `<workdir>/placeholders/`:

| File | viewBox | Used for |
|---|---|---|
| `placeholders/media.svg` | `0 0 800 600` (4:3) | Empty image/video/animation blocks anywhere in the product |
| `placeholders/card.svg` | `0 0 1600 900` (16:9) | Empty course card hero when a course has no `cardImageUrl` |
| `placeholders/icon.svg` | `0 0 256 256` (1:1) | Empty course icon when a course has no `iconUrl` |

Each placeholder is a soft branded surface: solid `surface` background, a faint watermark (small wordmark, dot pattern, or simple geometric mark) in `primary` at low opacity. Don't put real text content — these are fallback canvases, not posters.

The assembler inlines each as a `data:image/svg+xml;utf8,...` URI on the matching `flow.body.{media,card,icon}PlaceholderUrl` field. If you don't write a file, the field is omitted and the CMS falls back to its built-in generic placeholder.

### 8. Hand off

Tell the user where the artifacts are. Next stage: `/luly-fill`.

## Hard rules

- Read-only on intake.md and plan.md.
- Write `theme.md` always; SVG assets per the table in step 6 / step 7.
- All color tokens present and valid hex.
- Fonts from the closed list, verbatim.
- SVG viewBox dimensions in step 6 are mandatory — wrong aspect = visible bug.
- Do not run any other skill in this conversation.
