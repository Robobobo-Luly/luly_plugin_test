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
- `background` from brand → theme `background` (derive `surface` as a near-tint)
- `secondary` from brand → theme `secondary`
- `text` from brand → theme `textColor`
- `accent` from brand → route to whichever token best fits (often `secondary` or `successLight`)
- Other brand colors → derive `primaryLight`, `border`, `disabled` from the brand palette via lightness shifts
- Header/footer/semantic tokens — generate to harmonize with the brand

Never override the brand's primary because you think a different color looks better.

If no brand colors, generate a fresh palette matched to the tone/audience/topic.

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

Path: `<workdir>/theme.md`. Overwrite.

```markdown
## Palette
- background: #FFFFFF
- surface: #FAFAFA
- primary: #AB9FF2
- primaryLight: #E8E2FB
- secondary: #5F4FE3
- onSurface: #FAFAFA
- textColor: #0B0B0F
- mutedTextColor: #555560
- disabledTextColor: #B0B0B5
- textOnPrimary: #FFFFFF
- headerBackground: #FFFFFF
- headerText: #0B0B0F
- footerBackground: #FAFAFA
- footerText: #555560
- border: #E5E5E5
- disabled: #F5F5F5
- success: #10B981
- successLight: #E8F8EF
- failure: #DC2626
- failureLight: #FBE6E6
- warning: #F59E0B
- warningLight: #FFE8C2

## Fonts
- heading: "Inter", sans-serif
- body: "Inter", sans-serif
- buttonBorderRadius: 12px
```

All 22 color tokens are required. The four commonly-forgotten ones — `headerBackground`, `headerText`, `footerBackground`, `footerText` — pick them as contrast pairs.

### 5b. Clean SVG logo (when brand is present)

If `intake.md` declares a brand with a `Logo:` URL — or even just a company name with no clean logo URL — design a **clean SVG version of the company's logo / wordmark**. This becomes the app header logo (replaces the default Luly mark) AND can be referenced from the card-cover and course-icon visuals for coherence.

What "clean SVG version" means:
- If the brand's actual SVG is simple and clean (under ~2KB, no rasters, no scripts), you may copy and minimize it.
- Otherwise design a simplified version: a recognisable silhouette + the wordmark if it's iconic. Phantom = the ghost. Apple = the apple shape. Etc.
- If you can't reasonably approximate (obscure brand, no usable source), skip this step — header falls back to default Luly mark, no harm done.

Constraints:
- **viewBox proportional to a wordmark or square mark** — typical wordmark `0 0 200 60`, square mark `0 0 64 64`.
- **Use theme palette HEX values** (or the brand's actual logo colors if they're already in the palette).
- **No `<script>`, no `<image href>` external refs, no `<style>` blocks.** Self-contained.
- **No XML declaration / doctype.** Just `<svg …> … </svg>`.

Write to `<workdir>/logo.svg`. Assemble base64-inlines it into `flow.body.headerLogo` + `hub.body.hubLogo` and sets `flow.body.headerLogoLink` to `"/"`.

### 6. Visuals — preset gate

**Skip visuals entirely** if the preset is `campaign-simple`, `waitlist`, or `interactive-proposal`. Those have no hub catalog so the SVGs would never render. Do not write `card-cover.svg` or `course-icon.svg` for those presets.

Otherwise (academy / academy-course / campaign-course), continue to step 7.

### 7. Design two SVGs

Same visual concept across both for coherence. Pick one metaphor that fits the course topic:

| Topic hint | Visual metaphor |
|---|---|
| Phantom wallet | Stylised ghost outline |
| Solana ecosystem | Diagonal motion line / chevron pair |
| Language course | Speech bubble with quote glyph |
| DeFi yield | Coin stack / upward arrow |
| Security | Shield with keyhole |
| API tutorial | Stylised brackets `{ }` with connecting line |

When unsure, default to abstract geometry from the palette. Abstract + brand colors reads as "branded course."

Universal constraints (apply to both):
- No external references (no `<image href>`, no `xlink:href`).
- No `<script>` tags. No event handlers.
- Inline styles only — no `<style>` blocks.
- Use only colors from `theme.md`.
- At least 2 distinct shapes per SVG.
- Pretty-printed with 2-space indent.
- No XML declaration, no doctype. Just `<svg …> … </svg>`.

### 7a. Card cover — 10:3

- **`viewBox="0 0 640 192"`** — wide 10:3 aspect.
- Use the full canvas. Background fill mandatory.
- Typography allowed (course title, academy name, tagline) — the cover is wide enough.
- File: `<workdir>/card-cover.svg`.

### 7b. Course icon — 1:1

- **`viewBox="0 0 256 256"`** — square.
- **No text** — rendered at ~32px on the card; detail is wasted past that.
- Single subject centered, with breathing room (reads as a mark, not a tile).
- Same concept as the card cover — coherence.
- File: `<workdir>/course-icon.svg`.

### 8. Worked example — Phantom academy

Theme: purple `#AB9FF2`, dark bg `#0B0B0F`, text white `#FFFFFF`.

**Card cover (10:3):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 192" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0B0F"/>
      <stop offset="1" stop-color="#1A1530"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.5" r="0.4">
      <stop offset="0" stop-color="#AB9FF2" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#AB9FF2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="192" fill="url(#bg)"/>
  <circle cx="160" cy="96" r="150" fill="url(#glow)"/>
  <!-- Ghost silhouette -->
  <path d="M160 30 C 200 30 230 60 230 100 L 230 150 L 215 135 L 200 150 L 185 135 L 170 150 L 155 135 L 140 150 L 125 135 L 110 150 L 95 135 L 95 100 C 95 60 125 30 160 30 Z" fill="#AB9FF2"/>
  <ellipse cx="138" cy="93" rx="7" ry="10" fill="#0B0B0F"/>
  <ellipse cx="178" cy="93" rx="7" ry="10" fill="#0B0B0F"/>
  <text x="290" y="85" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="28" font-weight="700">What is Phantom?</text>
  <text x="290" y="125" fill="#AB9FF2" font-family="Inter, sans-serif" font-size="16" font-weight="500" letter-spacing="2">PHANTOM ACADEMY</text>
</svg>
```

**Course icon (1:1):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#AB9FF2" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#AB9FF2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="256" height="256" rx="48" ry="48" fill="#0B0B0F"/>
  <circle cx="128" cy="128" r="100" fill="url(#glow)"/>
  <path d="M128 64 C 170 64 200 96 200 138 L 200 200 L 184 184 L 168 200 L 152 184 L 136 200 L 120 184 L 104 200 L 88 184 L 72 200 L 56 184 L 56 138 C 56 96 86 64 128 64 Z" fill="#AB9FF2"/>
  <ellipse cx="108" cy="128" rx="8" ry="11" fill="#0B0B0F"/>
  <ellipse cx="148" cy="128" rx="8" ry="11" fill="#0B0B0F"/>
</svg>
```

### 9. Hand off

Tell the user where the three artifacts are. Next stage: `/luly-fill`.

## Hard rules

- Read-only on intake.md and plan.md.
- Write only to `theme.md` + (for hub presets) `card-cover.svg` + `course-icon.svg`.
- All 22 color tokens present and valid hex.
- Fonts from the closed list, verbatim.
- Card cover viewBox `0 0 640 192`. Course icon viewBox `0 0 256 256`.
- Card cover may use text; course icon may not.
- Same visual concept for both.
- Do not run any other skill in this conversation.
