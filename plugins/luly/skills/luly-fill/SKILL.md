---
name: luly-fill
description: Stage 4 of the Luly authoring pipeline. Write all screen content (onboarding + sections × screens) as a single content.md with per-screen YAML-style headers and Markdown bodies. Absorbs the old luly-fill-lesson + luly-fill-onboarding stages. Reads theme.md for HEX values used in image captions.
---

# Luly — Stage 4: Fill content

One file. All screens. Per-screen YAML-style header for structured fields (block type, image, quiz choices, form fields, etc.), Markdown body for prose. Screens separated by `---`. Onboarding and sections are uniform — both are just "ordered groups of screens" in this doc.

## Process

### 1. Load prior stages

Read:
- `<workdir>/intake.md` — for tone, audience, brand voice
- `<workdir>/plan.md` — for preset, frontmatter, sections, screen synopses
- `<workdir>/theme.md` — **REQUIRED** for HEX values used in image captions

If any is missing, stop and tell the user to run the missing stage first.

### 2. Compute the allowed block formats

From plan frontmatter (`mode`, `quizzes`, `forms`):

| Always allowed | text, image-richtext, image |
| If `mode: responsive` | + layout |
| If `quizzes: on` | + quiz-text, question |
| If `forms: on` | + form, email-form, form-text |
| If a video URL is in materials | + video |

Don't emit a block whose format is outside this set.

### 3. For each screen in plan order

For every screen the plan declares (onboarding first if present, then sections in order):

1. Pick **one** block format from the allowlist that fits the screen synopsis.
2. Write a `## Onboarding · Screen N — title` or `## Section M · Screen N — title` header.
3. Below the header, write a YAML-style block of structured fields (type, image, choices, etc.).
4. After a blank line, write the Markdown body (the actual copy).
5. End the screen with `---` on its own line.

Mirror the screen count from the plan exactly — no adding, no dropping.

### 4. Block format catalog

| Format | Required header fields | Body |
|---|---|---|
| `text` | `type: text` | Markdown content (pure rich text) |
| `image-richtext` | `type: image-richtext`<br>`image: <see SVG illustration rules below>`<br>`position: left` or `right`<br>`caption: "<see caption rules below>"` | Markdown content |
| `image` | `type: image`<br>`url: <see SVG illustration rules below>`<br>`alt: <alt text>`<br>`caption: "<…>"` (optional) | (none) |
| `video` | `type: video`<br>`url: <url>`<br>`poster: <url>` (optional)<br>`caption: "<…>"` (optional) | (none) |
| `quiz-text` | `type: quiz-text`<br>`text: "<setup copy beside the quiz>"`<br>`question: "<the question>"`<br>`choices:` bulleted list (≥2)<br>`correct: <id>` | (none — copy lives in `text`) |
| `question` | `type: question`<br>`question: "<the question>"`<br>`choices:` bulleted list (≥2)<br>`correct: <id>` | (none) |
| `form-text` | `type: form-text`<br>`fields:` bulleted list (≥1)<br>`submitLabel: <text>`<br>`successContent: "<markdown thank-you>"` | Markdown headline + body before form |
| `form` / `email-form` | `type: form` (or `email-form`)<br>`fields:` bulleted list (≥1)<br>`submitLabel: <text>` (optional)<br>`successMessage: <text>` (optional) | (none) |
| `layout` | `type: layout`<br>`ratio: "50:50"` | (none — responsive mode only) |

**Single-component vs composite:** never emit a composite (`image-richtext`, `quiz-text`, `form-text`) with one half empty. If the body would be empty, use the single-component variant (`image`, `question`, `form`) instead.

### 5. Choices / Fields list syntax

Both `choices:` and `fields:` use indented bulleted lists. Example:

```
choices:
  - id: a
    text: Solana only
  - id: b
    text: Solana, Ethereum, Bitcoin and more
  - id: c
    text: Ethereum only
```

Quiz `correct` value must match one of the choice IDs. Choice IDs must be unique within the quiz.

Form fields:

```
fields:
  - id: email
    label: Email
    type: email
    required: true
  - id: consent
    label: ""
    type: checkbox
    required: true
    checkboxLabel: "I agree to the"
    links:
      - text: Privacy Policy
        url: https://example.com/privacy
```

Field types: `text | email | number | tel | textarea | select | checkbox`. (Note: no `url` type.) For `checkbox`, `checkboxLabel` is plain text (never Markdown); `links` is an optional array.

### 5b. SVG illustrations — default inline visual (new)

For every image-bearing block (`image-richtext`, `image`), design a **minimal SVG illustration** inline. The data URI goes in the `image:` (or `url:` for `image` blocks) field. The caption stays separately as the prompt for a future image-gen step.

This gives you both: a real visible illustration today + a high-quality image-gen prompt for later.

**Design rules for the inline SVG:**

- **viewBox: `0 0 256 256`** for inline / square illustrations. Use `0 0 320 200` for wider hero-style images if the layout needs it.
- **2–5 simple shapes maximum.** Rect, circle, ellipse, line, simple paths. No fancy gradients required (one optional `<linearGradient>` is fine).
- **Theme HEX only.** Pull from `theme.md` palette — usually `background`, `primary`, `secondary`, and one accent. Don't invent hex codes.
- **No text inside the SVG.** The caption is the text. Image = pure visual.
- **No `<script>`, no `xlink:href`, no `<image href>` external references, no `<style>` blocks.** Self-contained markup.
- **Coherent across the lesson** — same illustration style across screens in a section. E.g., if you use rounded rectangles + diagonal lines for screen 1, keep that vocabulary for screen 2.

**How to inline it in content.md:**

After designing the SVG, base64-encode it via Bash and paste the resulting `data:image/svg+xml;base64,...` URI as the `image:` (or `url:`) value.

Bash command pattern:

```bash
SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#FFFFFF"/><circle cx="128" cy="128" r="64" fill="#AB9FF2"/></svg>'
echo -n "$SVG" | base64
```

The output is the base64 string. Prepend `data:image/svg+xml;base64,` and paste as the value:

```
## Section 1 · Screen 1 — What is Phantom?
type: image-richtext
image: data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI0ZGRkZGRiIvPjxjaXJjbGUgY3g9IjEyOCIgY3k9IjEyOCIgcj0iNjQiIGZpbGw9IiNBQjlGRjIiLz48L3N2Zz4=
position: right
caption: "Stylised multi-chain wallet icon, flat vector illustration, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"

**Phantom** is a multi-chain self-custodial wallet...
```

**Composition hints for what to draw:**

- Match the topic at a metaphorical level: wallet topic → wallet/coin shape; security topic → shield; networks → connected dots; etc.
- When unsure, default to abstract geometric composition using the theme palette. Branded color is more important than literal subject.
- Reuse the same metaphor from the card cover / course icon when sensible — visual coherence across the product.

**If you genuinely can't design a meaningful SVG** (very abstract screen, no obvious visual), fall back to: `image: /assets/placeholder-image.svg` — the canonical placeholder. Don't ship an empty white square.

### 6. Image captions — HEX from theme, no vague color words

Read the palette from `theme.md`. Every image caption MUST follow this format:

```
"<subject>, <style direction>, using palette <#HEX> primary, <#HEX> background[, more HEX], <aspect>"
```

- **HEX clause is mandatory.** Pull from `theme.md` — at minimum `primary` and `background`. Use the actual values from theme.
- **Banned in captions:** `purple`, `blue`, `green`, `red`, `orange`, `violet`, `navy`, `teal`, `pink`, `yellow`, `dark`/`light`/`warm`/`cool` (as color descriptors), `soft gradient`, `muted palette`, `brand colors` (when not followed by HEX). Use only HEX strings.
- **Style direction** is about *technique* (3–6 mood words): `flat vector illustration`, `soft hand-drawn line art`, `playful cartoon style`, `minimal geometric composition`, etc. Keep consistent across screens in a section.
- **Aspect** is optional — append `1:1 aspect ratio` for square inline blocks, `16:9` for wide hero blocks, omit when unsure.

Example: `"Friendly ghost mascot waving from inside a smartphone, flat vector illustration with soft glow, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"`.

### 7. Write `content.md`

Path: `<workdir>/content.md`. Overwrite.

Worked example (Phantom academy with onboarding + 2 sections):

```markdown
## Onboarding · Screen 1 — Welcome
type: image-richtext
image: /assets/placeholder-image.svg
position: left
caption: "Friendly ghost mascot waving from inside a smartphone, flat vector illustration, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"

Welcome to **Phantom Academy** — your guide to shipping with Phantom across multiple chains.

---

## Onboarding · Screen 2 — How the academy works
type: text

Each section is a few short screens. Tap **Next** to move through. Quizzes help the lessons stick.

---

## Section 1 · Screen 1 — What is Phantom?
type: image-richtext
image: /assets/placeholder-image.svg
position: right
caption: "Stylised multi-chain wallet interface with subtle ghost mark, flat vector illustration, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"

**Phantom** is a multi-chain self-custodial wallet — Solana, Ethereum, Bitcoin, Polygon, Base, and Sui all in one app.

---

## Section 1 · Screen 2 — Quick check
type: quiz-text
text: "Pick the right answer:"
question: "Which chains does Phantom support?"
choices:
  - id: a
    text: Solana only
  - id: b
    text: Solana, Ethereum, Bitcoin and more
  - id: c
    text: Ethereum only
correct: b

---

## Section 2 · Screen 1 — Sending crypto
type: text

To send crypto with Phantom, tap **Send**, paste an address, pick the asset, confirm. Phantom handles the network fee in the background.

---

## Section 2 · Screen 2 — Staking
type: image-richtext
image: /assets/placeholder-image.svg
position: left
caption: "Validator nodes with reward indicator, flat vector illustration, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"

**Staking** lets you earn rewards by locking SOL with a validator. Phantom shows estimated APY before you commit.
```

### 8. Self-checks before saving

- Every image-bearing block has a `caption` field.
- Every caption contains at least one HEX color (`#XXXXXX`).
- No banned vague color words.
- Quiz `correct` values match a choice ID.
- Form field types are within the allowed set.
- Screen count matches plan exactly.
- Screens use `---` separator on their own line.

### 9. Hand off

Tell the user where `content.md` is. Next: assemble (the orchestrator runs the `assemble` script).

## Hard rules

- Single file: `<workdir>/content.md`.
- Markdown only. Per-screen header is plain key/value lines (YAML-style), not real YAML/JSON.
- Body content is plain Markdown (will be compiled to TipTap at assemble time — don't pre-compile).
- Block format names: use the catalog above verbatim. NEVER emit `richtext` as a format name — that's not registered. Use `text`.
- HEX values in captions come from `theme.md` — don't invent.
- Do not run any other skill in this conversation.
