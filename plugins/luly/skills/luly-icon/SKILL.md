---
name: luly-icon
description: Step 5b of the Luly authoring pipeline. Design a creative SVG course-card icon as raw SVG markup, using the resolved theme palette (and brief.brand.colors when present) plus the course topic for visual concept. Output is stored as inline SVG text (not a URL or external file), embedded into course.body.cardImageSvg at assemble time. Run after /luly-style and before /luly-controls.
---

# Luly — Step 5b: Course icon

You're designing the course **card icon** that shows up on the hub. It is rendered inline (as SVG markup, not as an image URL) inside the hub course card.

## Why an agent and not an algorithm

The previous version generated icons algorithmically — solid gradient + 2-letter initials. Flat, generic, didn't reflect the course's topic. You can do better: a 2-shape composition that nods to the topic + uses the brand palette.

## Process

### 1. Load prior artifacts

Read:
- `tmp/luly-agent/brief.json` — pay attention to `brand.colors` if present, and the `intent` + `audience` for topical cues
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json` — `courseTitle` + lesson titles for what the course is about
- `tmp/luly-agent/theme.json` — the resolved palette you must use

If `theme.json` is missing, stop and tell the user to run `/luly-style` first.

### 2. Pick a visual concept (don't ask)

From the course title + audience, pick a **single visual metaphor** the icon will represent. Examples:

| Course topic | Visual metaphor |
|---|---|
| Phantom wallet onboarding | A stylised ghost outline (Phantom's mascot) |
| Solana ecosystem academy | A diagonal motion line / chevron pair |
| German language course | Speech bubble with a quote glyph |
| DeFi yield strategies | A coin stack or upward arrow over coins |
| Crypto security basics | A shield with a keyhole |
| API integration tutorial | Stylised brackets `{ }` with a connecting line |

When in doubt, default to **abstract geometry** (two overlapping circles, a triangle split by a line, etc.) rather than literal icons that might miss the topic. Abstract + brand colors always reads as "branded course."

### 3. Pick the palette

Use the **resolved theme.json values directly** — never invent colors:
- **Background**: theme `primary` (the brand hero color)
- **Accent shape**: theme `secondary`
- **Foreground / line / text**: theme `textOnPrimary`
- Optional 4th color: `primaryLight` (10–20% tint of primary) or `surface`

If `brief.brand.colors` is set, those are already reflected in `theme.json` (the style skill anchors theme to brand). Just read `theme.json`.

### 4. Design the SVG

Constraints (must hit all):

- **`viewBox="0 0 640 360"`** — the renderer expects a 16:9 card. Other ratios will distort.
- **No external references** — no `<image href="...">`, no `<use href="external">`, no `xlink:href` to outside. Self-contained markup only. The renderer inlines this directly into the DOM.
- **No `<script>` tags. No event handlers.** This SVG is rendered with `dangerouslySetInnerHTML`; nothing executable.
- **Inline styles only, no `<style>` blocks** — to avoid CSS leaking from / into other cards on the hub.
- **Use only the theme colors** chosen in step 3. No off-palette hex values.
- **Composition**: at least 2 distinct shapes + a typographic element (the course title fragment or initials) for visual hierarchy.
- Keep the markup readable — pretty-printed with 2-space indent so it's debuggable.
- **No leading XML declaration** (no `<?xml … ?>`), no `<!DOCTYPE>`. Just `<svg …> … </svg>`.

### 5. Worked examples (use as anchors — don't copy verbatim)

**Phantom academy** (brand: purple `#AB9FF2`, dark bg `#0B0B0F`, text white `#FFFFFF`):

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
  <path d="M180 80
           C 230 80 270 120 270 170
           L 270 260
           L 250 240 L 230 260 L 210 240 L 190 260 L 170 240 L 150 260 L 130 240
           L 90 260
           L 90 170
           C 90 120 130 80 180 80 Z"
        fill="#AB9FF2"/>
  <!-- Ghost eyes -->
  <ellipse cx="155" cy="165" rx="10" ry="14" fill="#0B0B0F"/>
  <ellipse cx="205" cy="165" rx="10" ry="14" fill="#0B0B0F"/>
  <!-- Title block on the right -->
  <text x="320" y="170" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="32" font-weight="700">Getting Started</text>
  <text x="320" y="210" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="32" font-weight="700">with Phantom</text>
  <text x="320" y="260" fill="#AB9FF2" font-family="Inter, sans-serif" font-size="18" font-weight="500">Phantom Academy</text>
</svg>
```

**Generic warm-friendly course** (theme: orange `#E85A3C`, cream `#FFF8F0`, secondary `#FFD9C2`):

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
  <path d="M80 80 L240 80 Q280 80 280 120 L280 200 Q280 240 240 240 L160 240 L120 290 L130 240 L80 240 Q40 240 40 200 L40 120 Q40 80 80 80 Z"
        fill="#FFF8F0" stroke="#2C1810" stroke-width="3"/>
  <text x="160" y="180" fill="#E85A3C" font-family="Inter, sans-serif" font-size="80" font-weight="800" text-anchor="middle" dominant-baseline="central">A1</text>
  <!-- Title on right -->
  <text x="320" y="170" fill="#2C1810" font-family="Inter, sans-serif" font-size="32" font-weight="700">German for</text>
  <text x="320" y="210" fill="#2C1810" font-family="Inter, sans-serif" font-size="32" font-weight="700">Beginners</text>
</svg>
```

### 6. Write the file

Write the SVG markup to:

```
tmp/luly-agent/course-icon.svg
```

Overwrite any existing file. Pretty-printed, no trailing whitespace.

### 7. Validate

Sanity-check the file:
- Starts with `<svg ` (no XML declaration before it).
- Ends with `</svg>` on its own line.
- Contains `viewBox="0 0 640 360"` literally.
- All color hex values you used exist in `theme.json`.
- No `<script>`, no `xlink:href`, no `<image>` referencing external URLs.

Run the validator (informational only — does basic syntactic checks):

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-icon
```

If the validator script doesn't exist yet, skip — manual check is sufficient.

### 8. Hand off

Tell the user:
- The course icon is at `tmp/luly-agent/course-icon.svg`.
- Next stage is `/luly-controls` (when running manually).

## Hard rules

- Read-only on prior artifacts.
- Write only to `tmp/luly-agent/course-icon.svg`.
- Use only colors from `theme.json` (and by extension `brief.brand.colors` if present).
- Self-contained SVG only — no external references, no scripts, no event handlers.
- 16:9 viewBox `0 0 640 360` is mandatory.
- Do not run any other skill in this conversation.
