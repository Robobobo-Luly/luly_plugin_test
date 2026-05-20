---
name: luly-brief
description: Step 0 of the Luly authoring pipeline. Interview the user about a new Luly course / campaign and capture brief.json that every later stage consumes verbatim. Run this first; all subsequent stages read its output. Use when the user says they want to create, draft, or plan a new Luly flow, course, campaign, academy, lesson, or marketing campaign and no brief.json exists yet.
---

# Luly — Step 0: Brief capture

You are running Step 0 of the Luly authoring pipeline (full playbook at
`docs/flow-json-schema.html` § Step 0).

Your only job in this conversation: ask the user 4 short questions, write
`tmp/luly-agent/brief.json`, validate it. Do not progress to any later stage —
stages 1–9 each have their own skill.

## Process

### 1. Ask the four questions

Ask in order. Accept the user's existing answers if they already covered any of
these in their opening message — don't ask again.

1. **Intent** — one sentence, what is this course / campaign for?
2. **Audience** — beginners / pros / mixed; mobile-first or desktop too?
3. **Tone** — short phrase (e.g. "friendly, concrete, no jargon"). If the user
   is vague, propose a sensible default based on audience and confirm.
4. **Materials** — optional URLs or files to draw from. Skip if none.

### 1b. Brand research (when the product is for a specific company)

**Trigger:** the brief mentions a specific company by name (e.g. "Phantom academy", "Wallet onboarding", "Base campaign"). Skip this step entirely for generic / non-branded products.

When triggered, do this research **before writing brief.json** — the brand block carries through to theme, content, and image generation:

1. **Identify the company's primary sources** — official site, brand book, docs, design-system or storybook URL. Materials field of the brief is the obvious starting point.
2. **Extract real values from those sources** using `WebFetch` (or `WebSearch` if no URL was given). Look for:
   - **Brand colors as HEX** — find them in CSS variables on the site (`--color-primary`), Tailwind config, brand-book PDFs, or design-system pages. **Never invent hex codes.** If you can't find a value, omit the key — the validator allows missing colors.
   - **Logo URL** — the absolute URL to the canonical logo SVG / PNG (prefer SVG; transparent background).
   - **Fonts** — what they use for body / headings (from CSS, font stack, or brand book).
   - **Voice** — 1 sentence summarizing how they speak (technical / playful / formal / etc.).
3. **Cross-check what the user provided.** If the user already supplied colors or a logo URL, trust those over what you scraped. Their material is canonical.

Capture into `brief.brand`:

```json
"brand": {
  "company": "Phantom",
  "website": "https://phantom.app",
  "docsUrl": "https://docs.phantom.com",
  "colors": {
    "primary":    "#AB9FF2",
    "secondary":  "#5F4FE3",
    "background": "#0B0B0F",
    "accent":     "#FFFFFF",
    "text":       "#FFFFFF"
  },
  "logo":  "https://phantom.app/img/phantom-logo-purple.svg",
  "fonts": ["Inter"],
  "voice": "Confident, builder-focused, plain-spoken. Minimal jargon."
}
```

All color values must be 6- or 8-char hex (e.g. `#AB9FF2` or `#AB9FF2FF`). The validator will reject anything else.

If brand research fails (no usable sources, site behind auth, etc.), set only `company` and proceed — downstream stages fall back gracefully when colors / logo are absent. Tell the user one line about what you found and didn't find.

### 3. Write the file

Write `tmp/luly-agent/brief.json` with these fields. The `brand` block is optional — include only when the product is for a specific company (see step 1b):

```json
{
  "intent":     "string, non-empty",
  "audience":   "string, non-empty",
  "tone":       "string, non-empty",
  "materials":  ["string", "..."],
  "brand": {
    "company":  "string, non-empty (required if brand present)",
    "website":  "string, optional",
    "docsUrl":  "string, optional",
    "colors":   { "primary": "#HEX", "secondary": "#HEX", "background": "#HEX", ... },
    "logo":     "absolute URL, optional",
    "fonts":    ["string", "..."],
    "voice":    "string, optional"
  }
}
```

If `tmp/luly-agent/` does not exist yet, create it. Overwrite any existing
`brief.json` without prompting.

### 4. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-brief
```

Report the result to the user in one line. If validation fails, fix the file
and re-run. Do not move on.

### 5. Hand off

End the conversation by telling the user:

- The brief is at `tmp/luly-agent/brief.json`.
- Next stage is `/luly-product-type` (once it ships) — or for now, manual review
  and re-run.

## Hard rules

- Do not write to any path other than `tmp/luly-agent/brief.json`.
- Do not modify code in `src/`, `tests/`, or the CMS data.
- Do not invent fields. The schema is closed; unknown keys fail validation.
- Do not run any other skill in the same conversation.
