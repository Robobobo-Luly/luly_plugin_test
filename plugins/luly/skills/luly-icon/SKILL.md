---
name: luly-icon
description: Step 5b of the Luly authoring pipeline. Design TWO inline-SVG artifacts for the course — a 16:9 card cover (cardImageSvg) and a 1:1 course icon (iconSvg) — using the resolved theme palette (and brief.brand.colors when present) plus the course topic. Output is stored as inline SVG text, embedded into course.body at assemble time. Run after /luly-style and before /luly-controls.
---

# Luly — Step 4b: Course visuals (card cover + course icon)

You design **two** SVG visuals for the course. Both are inlined into the course node as raw markup — no URLs, no data URIs, no external assets.

## Preset gate — when this skill applies

Read `tmp/luly-agent/product-type.json` first. If `preset` is one of `campaign-simple`, `waitlist`, or `interactive-proposal`, **stop immediately** — do not write any SVG files. Those presets have no hub catalog so the card cover + icon never render. Just print one line ("course visuals — skipped, no hub for this preset") and exit.

This skill runs only for `academy`, `academy-course`, and `campaign-course`.

| Artifact | Field on course.body | File you write | Aspect | viewBox | Where it shows |
|---|---|---|---|---|---|
| **Card cover** | `cardImageSvg` | `tmp/luly-agent/card-cover.svg` | 16:9 wide | `0 0 640 360` | The full-width image at the top of every course card on the hub |
| **Course icon** | `iconSvg` | `tmp/luly-agent/course-icon.svg` | 1:1 square | `0 0 256 256` | The small avatar next to the author name on the card + on the course page |

Both are agent-authored — the algorithmic version was replaced because it produced flat, generic visuals. You can do better with topical concepts + the brand palette.

## Process

### 1. Load prior artifacts

Read:
- `tmp/luly-agent/brief.json` — pay attention to `brand.colors` and `brand.voice` if present, and the `intent` + `audience` for topical cues
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json` — `courseTitle` + lesson titles for what the course is about
- `tmp/luly-agent/theme.json` — the resolved palette you must use

If `theme.json` is missing, stop and tell the user to run `/luly-style` first.

### 2. Pick a visual concept (don't ask)

From the course title + audience, pick a **single visual metaphor** the visuals will represent. Examples:

| Course topic | Visual metaphor |
|---|---|
| Phantom wallet onboarding | A stylised ghost outline (Phantom's mascot) |
| Solana ecosystem academy | A diagonal motion line / chevron pair |
| German language course | Speech bubble with a quote glyph |
| DeFi yield strategies | A coin stack or upward arrow over coins |
| Crypto security basics | A shield with a keyhole |
| API integration tutorial | Stylised brackets `{ }` with a connecting line |

**Use the same concept for both the card cover and the icon** — the icon is the icon version of the cover. Visual coherence > variety.

When in doubt, default to **abstract geometry** (two overlapping circles, a triangle split by a line, etc.) rather than literal icons that might miss the topic. Abstract + brand colors always reads as "branded course."

### 3. Pick the palette

Use the **resolved theme.json values directly** — never invent colors:
- **Background**: theme `primary` (the brand hero color)
- **Accent shape**: theme `secondary`
- **Foreground / line / text**: theme `textOnPrimary`
- Optional 4th color: `primaryLight` (10–20% tint of primary) or `surface`

If `brief.brand.colors` is set, those are already reflected in `theme.json` (the style skill anchors theme to brand). Just read `theme.json`.

### 4. Design — universal constraints (apply to both files)

- **No external references** — no `<image href="...">`, no `<use href="external">`, no `xlink:href` to outside. Self-contained markup only. Both files are inlined directly into the DOM via `dangerouslySetInnerHTML`.
- **No `<script>` tags. No event handlers.** Nothing executable.
- **Inline styles only, no `<style>` blocks** — to avoid CSS leaking from / into other elements.
- **Use only the theme colors** chosen in step 3. No off-palette hex values.
- **Composition**: at least 2 distinct shapes. The card cover may include typography (course title / academy name); the icon should be visual-only (no text — too small to read).
- Pretty-printed with 2-space indent so it's debuggable.
- **No leading XML declaration** (no `<?xml … ?>`), no `<!DOCTYPE>`. Just `<svg …> … </svg>`.

### 4a. Card cover — 16:9

Constraints specific to the card cover:

- **`viewBox="0 0 640 360"`** — wide 16:9. Other ratios will distort in the hub card.
- Use the full canvas. Background fill is mandatory.
- **Typography is allowed** here — the cover is large enough to carry a course title / academy name / tagline.
- **File:** `tmp/luly-agent/card-cover.svg`

### 4b. Course icon — 1:1

Constraints specific to the icon:

- **`viewBox="0 0 256 256"`** — square 1:1. Rendered at ~32px on the card, so detail is wasted past that — keep it bold and readable at thumbnail size.
- **No text** — too small to read at the rendered size. Pure visual mark.
- Single subject centered. No edge-to-edge fills if avoidable — leave breathing room so the icon reads as a "mark" rather than a tile.
- Same concept as the card cover (e.g., if cover has a ghost, icon is the ghost head). Coherence over independent design.
- **File:** `tmp/luly-agent/course-icon.svg`

### 5. Worked examples (use as anchors — don't copy verbatim)

#### Phantom academy — card cover (16:9)

Theme: purple `#AB9FF2`, dark bg `#0B0B0F`, text white `#FFFFFF`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0B0F"/>
      <stop offset="1" stop-color="#1A1530"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#AB9FF2" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#AB9FF2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <circle cx="180" cy="180" r="200" fill="url(#glow)"/>
  <!-- Ghost silhouette -->
  <path d="M180 80 C 230 80 270 120 270 170 L 270 260 L 250 240 L 230 260 L 210 240 L 190 260 L 170 240 L 150 260 L 130 240 L 90 260 L 90 170 C 90 120 130 80 180 80 Z" fill="#AB9FF2"/>
  <!-- Ghost eyes -->
  <ellipse cx="155" cy="165" rx="10" ry="14" fill="#0B0B0F"/>
  <ellipse cx="205" cy="165" rx="10" ry="14" fill="#0B0B0F"/>
  <!-- Title on the right -->
  <text x="320" y="170" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="32" font-weight="700">Getting Started</text>
  <text x="320" y="210" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="32" font-weight="700">with Phantom</text>
  <text x="320" y="260" fill="#AB9FF2" font-family="Inter, sans-serif" font-size="18" font-weight="500">Phantom Academy</text>
</svg>
```

#### Phantom academy — course icon (1:1)

Same concept, simplified, no text, breathing room:

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
  <!-- Ghost silhouette, centered -->
  <path d="M128 64 C 170 64 200 96 200 138 L 200 200 L 184 184 L 168 200 L 152 184 L 136 200 L 120 184 L 104 200 L 88 184 L 72 200 L 56 184 L 56 138 C 56 96 86 64 128 64 Z" fill="#AB9FF2"/>
  <ellipse cx="108" cy="128" rx="8" ry="11" fill="#0B0B0F"/>
  <ellipse cx="148" cy="128" rx="8" ry="11" fill="#0B0B0F"/>
</svg>
```

#### Generic warm-friendly course — card cover (16:9)

Theme: orange `#E85A3C`, cream `#FFF8F0`, secondary `#FFD9C2`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E85A3C"/>
      <stop offset="1" stop-color="#FFD9C2"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <!-- Speech bubble -->
  <path d="M80 80 L240 80 Q280 80 280 120 L280 200 Q280 240 240 240 L160 240 L120 290 L130 240 L80 240 Q40 240 40 200 L40 120 Q40 80 80 80 Z" fill="#FFF8F0" stroke="#2C1810" stroke-width="3"/>
  <text x="160" y="180" fill="#E85A3C" font-family="Inter, sans-serif" font-size="80" font-weight="800" text-anchor="middle" dominant-baseline="central">A1</text>
  <text x="320" y="170" fill="#2C1810" font-family="Inter, sans-serif" font-size="32" font-weight="700">German for</text>
  <text x="320" y="210" fill="#2C1810" font-family="Inter, sans-serif" font-size="32" font-weight="700">Beginners</text>
</svg>
```

#### Generic warm-friendly course — course icon (1:1)

Same speech-bubble concept, no text:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" ry="48" fill="#FFF8F0"/>
  <!-- Speech bubble centered -->
  <path d="M64 56 L192 56 Q220 56 220 84 L220 148 Q220 176 192 176 L148 176 L116 208 L122 176 L64 176 Q36 176 36 148 L36 84 Q36 56 64 56 Z" fill="#E85A3C"/>
  <!-- Quote glyph as the visual mark -->
  <path d="M88 96 L96 96 L100 116 L92 116 Z M108 96 L116 96 L120 116 L112 116 Z" fill="#FFF8F0"/>
</svg>
```

### 6. Write both files

```
tmp/luly-agent/card-cover.svg
tmp/luly-agent/course-icon.svg
```

Overwrite any existing files. Pretty-printed, no trailing whitespace.

### 7. Validate (self-check)

For each file:
- Starts with `<svg ` (no XML declaration before it).
- Ends with `</svg>`.
- Card cover contains `viewBox="0 0 640 360"`. Icon contains `viewBox="0 0 256 256"`.
- All color hex values you used exist in `theme.json`.
- Icon has no `<text>` element.
- No `<script>`, no `xlink:href`, no `<image>` referencing external URLs.

Run the syntactic validator (informational only):

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-icon
```

If the validator script doesn't exist yet, skip — manual check is sufficient.

### 8. Hand off

Tell the user:
- Card cover at `tmp/luly-agent/card-cover.svg`.
- Course icon at `tmp/luly-agent/course-icon.svg`.
- Next stage is `/luly-controls` (when running manually).

## Hard rules

- Read-only on prior artifacts.
- Write only to `tmp/luly-agent/card-cover.svg` and `tmp/luly-agent/course-icon.svg`.
- Use only colors from `theme.json` (and by extension `brief.brand.colors` if present).
- Self-contained SVG only — no external references, no scripts, no event handlers.
- Card cover viewBox `0 0 640 360` (16:9). Icon viewBox `0 0 256 256` (1:1). Both mandatory.
- Card cover may use text. Icon must not — too small to read.
- Use the same visual concept for both — coherence over independence.
- Do not run any other skill in this conversation.
