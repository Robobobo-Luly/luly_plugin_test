---
name: luly-style
description: Step 5 of the Luly authoring pipeline. Generate a fresh 22-token color palette matched to the brief's tone, audience, topic, and product preset; pick fontHeading and fontBody from the closed list of supported fonts; write theme.json as a full direct theme spec (no presets, no resolver). Use after lessons are filled; before controls / metadata stages.
---

# Luly — Step 5: Workspace theme

Colors are **NOT picked from a preset palette**. The agent generates the full 22-token palette per request — choosing hues, lightness, and contrast that actually fit the brief's tone, audience, and topic.

Fonts are **restricted to the closed list below** — these are the only fonts the CMS actually renders.

## Process

### 1. Load prior stages

Read:
- `tmp/luly-agent/brief.json`
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json` (for context)
- `tmp/luly-agent/format-profile.json`

If any is missing, stop and direct the user to the appropriate prior skill.

### 2. Generate a fresh color palette

From the brief, infer a colour direction (don't ask):

- **Light vs dark background** — pick based on tone: warm/friendly/playful → light cream/white; sharp/tech/crypto → dark navy/slate; corporate/financial → very light gray; high-contrast/a11y → pure white.
- **Primary brand color** — pick a hue from a palette that fits the topic + tone. Examples: language learning → warm orange/teal; finance → navy/forest; crypto → cyan/violet; lifestyle → soft coral/sage. Do NOT default to blue every time.
- **Secondary** — a complementary or analogous hue, used sparingly.
- **Neutrals** — `surface`, `onSurface`, `border`, `disabled` — soft tints of the background.
- **Text** — `textColor` (high contrast against background), `mutedTextColor` (~60% strength), `disabledTextColor` (~30%), `textOnPrimary` (contrast against primary — usually pure white or pure dark).
- **Semantics** — `success`/`successLight` (green family), `failure`/`failureLight` (red family), `warning`/`warningLight` (amber/orange).

All values are **6- or 8-char hex strings** (no 3-char shorthand, no `rgb()`, no named colors).

### Contrast targets (mandatory — check before emitting)

| Pair | Target | Notes |
|---|---|---|
| `textColor` vs `background` | **≥ 7:1 (AAA)** | Body copy must be confidently readable. |
| `textOnPrimary` vs `primary` | **≥ 4.5:1 (AA)** | If `primary` is light, `textOnPrimary` must be dark; vice-versa. |
| `mutedTextColor` vs `background` | **≥ 4.5:1 (AA)** | Same hue as textColor, blended ~70% toward background. |
| `surface` vs `background` | 5–15% lightness shift | Don't make them identical — surface must read as a raised panel. |
| `border` vs `background` | subtle but visible | ~10–20% darker on light themes; lighter on dark themes. |
| `headerText` vs `headerBackground` | **≥ 4.5:1 (AA)** | Logo + menu links sit on the header bar. Pick them as a pair. |
| `footerText` vs `footerBackground` | **≥ 4.5:1 (AA)** | "Powered by Luly" + legal links + social icons all share `footerText`. |

If your draft fails any of these (mentally estimate luminance), iterate the hex values before writing the file. A perfectly tonal palette that fails contrast is a worse outcome than a slightly less elegant palette that passes.

### Worked palette anchors

These are reference palettes that pass the contrast targets. Generate fresh per request — don't copy verbatim — but use them as anchors for what "right" looks like.

| Vibe | background | surface | primary | primaryLight | textColor | mutedTextColor | textOnPrimary | success |
|---|---|---|---|---|---|---|---|---|
| Warm friendly | `#FFF8F0` | `#FFEAD5` | `#E85A3C` | `#FFD9C2` | `#2C1810` | `#7A5A40` | `#FFFFFF` | `#10B981` |
| Dark tech | `#0B0F1A` | `#161B2A` | `#22D3EE` | `#0E3A47` | `#E6E9EF` | `#94A3B8` | `#001017` | `#34D399` |
| Corporate | `#F8FAFC` | `#FFFFFF` | `#1E3A8A` | `#DBEAFE` | `#0F172A` | `#475569` | `#FFFFFF` | `#15803D` |
| Minimal | `#FFFFFF` | `#F5F5F5` | `#111111` | `#E0E0E0` | `#0A0A0A` | `#525252` | `#FFFFFF` | `#16A34A` |
| Playful pastel | `#FFFBF5` | `#FFF1E0` | `#F472B6` | `#FCE7F3` | `#1F2937` | `#6B7280` | `#FFFFFF` | `#34D399` |

#### The 22 required color tokens

| Token | Role | Pick guidance |
|---|---|---|
| `background` | Main page background | Light or dark based on tone |
| `surface` | Cards, panels | A tint of background (lighter on light, slightly raised on dark) |
| `primary` | Brand colour — buttons, active states | The hero hue for the brand/topic |
| `primaryLight` | Selected-state backgrounds | A 10–20% tint of primary blended with background |
| `secondary` | Accent background — sticky bars, Connect-wallet pill | Complementary or analogous to primary. Not the footer anymore — that's its own token. |
| `onSurface` | Secondary surface (answer options, chips) | Slightly different shade of surface |
| `textColor` | Headings, main body text | High contrast against background (~AA contrast ratio) |
| `mutedTextColor` | Descriptions, subtitles | ~60% strength of textColor |
| `disabledTextColor` | Disabled labels, placeholders | ~30% strength |
| `textOnPrimary` | Text on primary buttons | Pure white on dark primary, pure dark on light primary |
| `headerBackground` | App header bar + mega-menu dropdown | Usually equals `background` for an integrated look, or a tinted variant for contrast |
| `headerText` | Header logo, menu links, burger glyph, mega-menu titles + items | Pick as a pair with `headerBackground` (≥ 4.5:1) |
| `footerBackground` | App footer bar | Often dark (sticky branded base) or matches `background` for a quiet footer |
| `footerText` | "Powered by Luly" + Luly mark, legal links, social icons (X, Telegram, LinkedIn) | Pick as a pair with `footerBackground` (≥ 4.5:1) |
| `border` | Card outlines, separators | Subtle — close to background |
| `disabled` | Disabled element bg | Neutral light/dark |
| `success` | Correct answer, success | Green family (e.g., `#10B981`) |
| `successLight` | Background behind correct answer | Pale tint of success |
| `failure` | Wrong answer, errors | Red family (e.g., `#EF4444`) |
| `failureLight` | Background behind wrong answer | Pale tint of failure |
| `warning` | Warnings | Amber/orange (e.g., `#F59E0B`) |
| `warningLight` | Background for warnings | Pale tint of warning |

### 3. Pick fonts from the closed supported list

`fontHeading` and `fontBody` must be **exactly** one of these CSS family strings (use the string verbatim, including outer quotes):

| Font | Use it for |
|---|---|
| `"Inter", sans-serif` | Default — clean, modern, neutral |
| `"Inter Tight", sans-serif` | Tighter spacing; tech / sharp brands |
| `"SF Pro Display", -apple-system, sans-serif` | Apple-ecosystem look, headings |
| `"Roboto", sans-serif` | Geometric, neutral; Android-ecosystem feel |
| `"Matter", sans-serif` | Modern grotesque, slightly distinctive |
| `"Nunito", sans-serif` | Friendly, rounded, warm |
| `"Poppins", sans-serif` | Geometric, friendly, mid-2010s startup look |
| `"Open Sans", sans-serif` | Humanist, very readable, neutral |
| `"Montserrat", sans-serif` | Confident, modern, slightly geometric headings |
| `"Lato", sans-serif` | Semi-rounded, warm, broadly readable body |

Pairing guidance:
- **Same-font pairs are fine** (e.g. Inter / Inter). Default.
- For more character: Montserrat heading + Inter body; Nunito heading + Open Sans body; Poppins heading + Lato body.
- Don't mix two heavy display fonts. Don't pick anything outside the list.

### 4. Optionally pick size tokens

Most flows don't need these — the renderer falls back to sane defaults. Only set them when the brand tone clearly calls for it:

- Sharp/tech → `buttonBorderRadius: "4px"`, `containerBorderRadius: "6px"`
- Warm/friendly → `buttonBorderRadius: "12px"`, `containerBorderRadius: "16px"`
- Pill/playful → `buttonBorderRadius: "9999px"`

Optional layout (maxWidth, padding) similarly defaults sanely.

### 5. Write the file

Write `tmp/luly-agent/theme.json` with the full theme:

```json
{
  "colors": {
    "background": "#...",
    "surface": "#...",
    "primary": "#...",
    "primaryLight": "#...",
    "secondary": "#...",
    "onSurface": "#...",
    "textColor": "#...",
    "mutedTextColor": "#...",
    "disabledTextColor": "#...",
    "textOnPrimary": "#...",
    "headerBackground": "#...",
    "headerText": "#...",
    "footerBackground": "#...",
    "footerText": "#...",
    "border": "#...",
    "disabled": "#...",
    "success": "#...",
    "successLight": "#...",
    "failure": "#...",
    "failureLight": "#...",
    "warning": "#...",
    "warningLight": "#..."
  },
  "style": {
    "fontHeading": "\"<one of the supported fonts>\", sans-serif",
    "fontBody": "\"<one of the supported fonts>\", sans-serif",
    "buttonBorderRadius": "12px"
  },
  "layout": {
    "maxWidth": "1200px"
  }
}
```

`layout` is optional; you can omit it entirely. `style.*` size fields beyond fontHeading/fontBody are optional too.

### 6. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-theme
```

The validator confirms:
- All 18 required color tokens present and valid hex.
- `fontHeading` and `fontBody` are in the supported list.
- Any optional size fields are valid CSS sizes.

On success, prints the resolved palette + fonts for sanity-check.

### 7. Hand off

Tell the user:
- `theme.json` is at `tmp/luly-agent/theme.json`.
- Next stage is `/luly-controls` (when running manually).

## Hard rules

- Read-only on prior stage artifacts.
- Write only to `tmp/luly-agent/theme.json`.
- All 22 required color tokens must be present and valid 6- or 8-char hex.
- `fontHeading` and `fontBody` MUST be one of the 10 supported CSS strings, **verbatim** — do not invent fonts.
- No `preset` field. No `overrides` block. Direct theme spec only.
- No `rgb()`, no 3-char `#FFF`, no named colors.
- Do not run any other skill in this conversation.
