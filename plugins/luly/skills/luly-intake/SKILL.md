---
name: luly-intake
description: Stage 1 of the Luly authoring pipeline. Read the user's natural-language prompt, do brand research when a specific company is named, pick the preset, generate a key, and write a single intake.md capturing intent, audience, tone, brand, materials, and preset choice. Replaces the old brief + product-type + brand-research stages with one markdown artifact.
---

# Luly — Stage 1: Intake

You write a single markdown document that the rest of the pipeline reads as context. Inline self-checks for the few things that genuinely matter (HEX format, preset enum, key shape).

**Before you write anything user-facing**, read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and apply it (sentence-case titles, American English, no emojis, no rhetorical questions, etc.).

## Process

### 1. Read the user's prompt

The orchestrator passes you the user's one-line request. Pull any URLs they attached for context if a quick read would help disambiguate intent or topic.

### 2. Brand research (when applicable)

**Trigger:** the prompt names a specific company by brand (e.g. "Phantom academy", "Wallet onboarding", "Base campaign"). Skip entirely for generic / non-branded products.

When triggered, **before writing the file**, extract from the company's actual sources:

- **Colors as HEX** — find them in CSS variables on the site, important to get background color, logo colors, the primary colors, i.e. the colors they use for CTA, brand colors, you name it, also check for surface colors, text colors,  **Never invent hex codes.** If you can't find a value, omit the key.
- **Logo URL** — absolute URL to the canonical logo (prefer SVG, transparent background). if you found url logo, especially csv, save it in base64 and pass further as a string to be used in images, icons etc
- **Fonts** — what they use (from CSS, brand book).
- **Voice** — one sentence summarizing how they speak.

The site's HTML is the most logical source — the brand's own CSS is authoritative in a way that secondary write-ups aren't. Don't give up on the first failed attempt. If one fetch path is blocked, try another (e.g. a real-browser request) before falling back. Other good sources: published brand books, brand kits, design-system pages.

Trust user-supplied material over what you scrape.

#### What counts as "reliably identified"

Brand colors are considered reliably identified when **both** of the following come from an authoritative source (the brand's own CSS bundle, manifest, brand book, or material the user pasted):

- A verified `primary` HEX
- A verified `background` HEX

A logo URL alone, a single color, or a guess derived from the company name or category does NOT count. When in doubt, treat it as unreliable.

#### When brand research fails or is unreliable — ask the user

If the prompt named a brand but you could not reliably identify the colors, **pause and ask the user before writing intake.md**. Use the `AskUserQuestion` tool with these three options:

1. **Proceed with default Luly styling** — neutral palette, no brand color claims. Intake ships without a `Colors:` block; stage 3 uses the default Luly palette.
2. **Try a topic-themed palette** — generate a palette inspired by the *topic / category* (not the brand name), preview the HEX values, user confirms. Write those into the `Colors:` block as an explicit topic palette (not as brand colors).
3. **Provide extra materials** — the user pastes a brand-book URL, a screenshot, exact HEX codes, or any reference. Then re-run extraction.

Include in the third option a brief note on how the user can gather these themselves: open the site in a browser → inspect a primary button → copy its `background-color`; check the company's press / brand assets page; look for `<meta name="theme-color">` in page source; or screenshot the homepage.

Whichever option the user picks, record it in the intake.md `Brand` section under a `Brand research result:` line — one of `verified`, `topic-themed`, `default-luly`, or `user-supplied` — so downstream stages can act deterministically.

If the prompt did NOT name a brand (generic / non-branded), skip this entirely and proceed without colors.

### 3. Pick the preset

| Preset | When to pick                                                                              |
|---|-------------------------------------------------------------------------------------------|
| `academy` | "academy", "school", "learning hub", "training program"                                   |
| `academy-course` | "create a course", "multi step"                                                           |
| `campaign-course` | same as acedemy course but if forms / rewards / user feedback is implied                  |
| `campaign-simple` | default for "marketing campaign", "promo", "launch", "landing", "ad campaign", "lead-gen" |
| `waitlist` | "waitlist", "early access", "email signup", "lead capture"                                |
| `interactive-proposal` | "sales proposal", "pitch deck", "demo for client X"                                       |

**Single-section → never `academy course or campaign-course`.** If the plan would emit 1 section, the preset must be `campaign-simple` / `waitlist` / `interactive-proposal`.

### 4. Generate a key

Kebab-case, `[a-z0-9-]`, 3-50 chars, no leading/trailing/double hyphens. Derived from the topic. User can rename in CMS later.

### 5. Write `intake.md`

Path: `<workdir>/intake.md`. Overwrite. Shape:

```markdown
# Intake — <key>

## Intent
<one-paragraph expansion of what the user wants. Be specific.>

## Audience
<one sentence>

## Tone
<one sentence — friendly, technical, playful, etc. Infer from preset if user was vague.>

## Preset
<one of the 6 presets>
Rationale: <one line>

## Brand (optional — only include this section when a specific company is named)
Company: <name>
Brand research result: <verified | topic-themed | default-luly | user-supplied>
Website: <url, optional>
Docs: <url, optional>
Colors:
- primary: #HEX
- background: #HEX
  surface: #HEX (optional)
- secondary: #HEX     (optional)
- accent: #HEX        (optional)
- text: #HEX          (optional)
Logo: <absolute url, optional>, base64 coded svg (if found)
Fonts for Header and paragraph: Header - "Inter", paragraph - Inter Tight (optional)
Voice: <one line, optional>

## Materials
- <url> — <one-line digest>
- <url> — <one-line digest>

## Academy name (academy preset only)
<the academy / hub label, e.g. "Phantom Academy">

## Course author (optional — academy / academy-course / campaign-course only)
<name>
```

### 6. Self-checks before saving

- Every color value under `Colors:` is a 6- or 8-char hex with `#` prefix.
- `Preset:` value is exactly one of the 6 allowed strings.
- Key on the H1 line matches `^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$`.
- For `academy` preset: an `## Academy name` section is present.
- For `academy-course` / `campaign-course`: `## Course author` may be omitted (it's optional).
- Do not invent any HEX you didn't actually find in sources.

### 7. Hand off

Tell the user one line: where the intake is + what the next stage is. The orchestrator then proceeds to `/luly-plan`.

## Hard rules

- Markdown only. No JSON.
- One file: `<workdir>/intake.md`.
- Overwrite without prompting.
- At most one clarifying question, only if a slot is genuinely ambiguous AND no default works.
- Do not run any other skill in this conversation.
