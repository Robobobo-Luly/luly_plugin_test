---
name: luly-fill
description: Stage 4 of the Luly authoring pipeline. Write all screen content (onboarding + sections × screens) as a single content.md with per-screen YAML-style headers and Markdown bodies. Absorbs the old luly-fill-lesson + luly-fill-onboarding stages. Reads theme.md for HEX values used in image captions.
---

# Luly — Stage 4: Fill content

One file. All screens. Per-screen YAML-style header for structured fields (block type, image, quiz choices, form fields, etc.), Markdown body for prose. Screens separated by `---`. Onboarding and sections are uniform — both are just "ordered groups of screens" in this doc.

**Before writing any screen body**, read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and apply it. 
Key non-negotiables: stories are 3–4 sentences, fit one mobile screen, never end bullets or headings with punctuation, American English, no emojis, no rhetorical questions, no long compound sentences. 
Quizzes: one per lesson, 2–3 questions, three options, only one correct, shuffle correct-answer position across questions.

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

### 3. Generate one section at a time, with carry-forward recap

A `## Template courses` block in plan.md (if present) is NOT a section — skip it entirely. Those are content-less course shells the assembler builds from a default scaffold; never write content for them.

The plan is processed in order: onboarding first (if present), then Section 1, Section 2, ... in plan order. Each section is generated as **its own focused pass** rather than streamed alongside the others. This keeps tone consistent, makes per-section retries cheap, and lets each pass enforce its own per-lesson rules (one quiz per lesson, 2–3 questions, etc.).

For each section:

**(a) Read context.** Always: intake.md, plan.md, theme.md, writing-guidelines.md. Plus the **most recent recap file** (see (d)) if one exists from the previous section.

**(b) Generate the section's screens.** For each screen in this section's plan entry:
1. Pick **one** block format from the allowlist that fits the screen synopsis.
2. Write a `## Onboarding · Screen N — title` or `## Section M · Screen N — title` header.
3. Below the header, write a YAML-style block of structured fields (type, image, choices, etc.).
4. After a blank line, write the Markdown body. Do not use tables. Pattern: a single `# H1` title → intro sentence → optional bullets → optional closing line. Stick to one H1 + paragraphs; reserve `##`+ for long-form, article-like products only (writing-guidelines.md §8). No emojis. Each story 3–4 sentences (per writing-guidelines.md §3); split into two screens if longer.
5. End the screen with `---` on its own line.

Screen count can deviate slightly — if a story would be too long, split into two screens rather than cramming.

**(c) Append to content.md.** Write the section's screens to `<workdir>/content.md` in plan order. Use `>> Append` semantics — do NOT overwrite earlier sections when generating later ones. (Tactically: read content.md if it exists, append the new section, write the whole thing back. Or use shell `>>`.)

**(d) Write a recap.** After completing the section, write `<workdir>/recaps/section-N-recap.md` — **3 sentences maximum** capturing:
- Key terms introduced (e.g. "DEX", "AERO", "epoch")
- Tone / voice settled on (e.g. "warm, plain-spoken, second person")
- Recurring metaphors or analogies used (e.g. "two buckets that price each other")

The next section's pass reads this recap and respects it: don't redefine terms, keep tone consistent, reuse metaphors.

**(e) Move to the next section.** Repeat from (a).

**Subagent option (orchestrator's choice):** the orchestrator MAY spawn an Agent subagent per section using the Agent tool, passing it the workdir + prior recap. This isolates context per section. If you do this, each subagent still produces the screens for one section and writes its recap file before returning. Default is a single agent processing sections sequentially.

### 4. Block format catalog

| Format | Required header fields | Body |
|---|---|---|
| `text` | `type: text` | Markdown content (pure rich text) |
| `image-richtext` | `type: image-richtext`<br>`image: <see SVG illustration rules below>`<br>`position: left` or `right`<br>`mobile: top` or `bottom` (optional)<br>`caption: "<see caption rules below>"` | Markdown content |
| `image` | `type: image`<br>`url: <see SVG illustration rules below>`<br>`alt: <alt text>`<br>`caption: "<…>"` (optional) | (none) |
| `video` | `type: video`<br>`url: <url>`<br>`poster: <url>` (optional)<br>`caption: "<…>"` (optional) | (none) |
| `quiz-text` | `type: quiz-text`<br>`text: "<setup copy beside the quiz>"`<br>`question: "<the question>"`<br>`choices:` bulleted list (≥2)<br>`correct: <id>` | (none — copy lives in `text`) |
| `question` | `type: question`<br>`question: "<the question>"`<br>`choices:` bulleted list (≥2)<br>`correct: <id>` | (none) |
| `form-text` | `type: form-text`<br>`fields:` bulleted list (≥1)<br>`submitLabel: <text>`<br>`successContent: "<markdown thank-you>"` | Markdown headline + body before form |
| `form` / `email-form` | `type: form` (or `email-form`)<br>`fields:` bulleted list (≥1)<br>`submitLabel: <text>` (optional)<br>`successMessage: <text>` (optional) | (none) |
**Single-component vs composite:** never emit a composite (`image-richtext`, `quiz-text`, `form-text`) with one half empty. If the body would be empty, use the single-component variant (`image`, `question`, `form`) instead.

**Responsive layout — desktop position + mobile stack order:**
- **Mobile always stacks image on top by default.** The screen's identity sits above the text on mobile, not below it — that's the read most users expect from learning + marketing flows on phones, and matches the convention across wallets, landings, and academies. The plugin emits `imagePositionMobile: top` automatically when the `mobile:` header is absent.
- `position: left` / `position: right` controls the **desktop** orientation only. Pick one per story arc and keep it consistent — toggling within a section reads as visual noise. Recommended default for stories: `position: right` (text leads on desktop — calmer reading rhythm). Combined with the mobile default, that gives text-first desktop and image-first mobile.
- Override the mobile default with `mobile: bottom` only when there's a specific reason text should lead on mobile (rare — usually a screen where the visual is decorative rather than identity-carrying). Don't override casually.
- **Don't hand-author block margins/spacing.** The renderer applies consistent per-block spacing by default (top 16 / bottom 0); the per-block `margin*` / `margin*Mobile` fields are a polishing lever for the agentic-edit scope, not for generation. Leave them unset so screens space uniformly.

**Block-shape consistency across story screens (mandatory):** within a single story arc (onboarding sequence, lesson, or a section's screens), all narrative screens should use the **same block shape** — either every story screen is `image-richtext` (image + text together) or every story screen is `text`. Don't intermix: a story that shows an illustration on screen 1 and then drops to text-only on screen 2 reads as a regression. Default to `image-richtext` for story content unless the user explicitly wants a stripped-down text-only feel, or the topic genuinely doesn't lend itself to per-screen illustration.

Forms (`form`, `form-text`, `email-form`) and quizzes (`question`, `quiz-text`) are exempt from this rule — they're functional screens, not story beats, so a single-component `question` or `form` is fine even when neighboring story screens use `image-richtext`. A composite `quiz-text` / `form-text` is also fine if it adds context, but mixing single-component and composite within the same form sequence still feels inconsistent — pick one shape per form sequence.

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

### 5a. Markdown content — what the renderer actually supports

Every Markdown body (`content` field on `text`, `image-richtext`, `form-text`; `text` on `quiz-text`) is compiled to TipTap JSON at assemble time. The renderer supports more than vanilla Markdown — use the full feature set.

**Block elements:**

| Markdown | Renders as |
|---|---|
| `# H1` / `## H2` / `### H3` / `#### H4` | Headings (4 levels max; `#####` and beyond ignored) |
| Blank line | Paragraph break |
| `- item` or `* item` | Bullet list (default disc style) |
| `- [ ] item` or `- [x] item` | **Check-style bullet list** — entire list renders with checkmark icons. If any item in the list uses `[ ]`/`[x]`, the whole list goes check-style. Checked vs unchecked state is purely visual (no interactive checkboxes). |
| `1. item` | Numbered list |
| `> quoted line` | Blockquote. Consecutive `>` lines collapse into one block; a `>` on its own creates a paragraph break inside the same quote. |

**Inline marks:**

| Markdown | Renders as |
|---|---|
| `**bold**` | Bold |
| `*italic*` or `_italic_` | Italic |
| `` `code` `` | Inline code |
| `[label](https://url)` | Hyperlink |
| `{{term \| description}}` | **Definition tooltip** — `term` renders inline with an underlined / hover-styled trigger; clicking it shows the popover with `description` as the body. The popover title defaults to `term` itself. |
| `{{term \| title \| description}}` | Same as above but with a custom popover **title** (heading) distinct from the inline trigger text. |

**Definition tooltips are the high-value feature for educational content.** Use them freely whenever a domain term, acronym, or concept would benefit from an inline definition without breaking reading flow. Examples:

- `When you send crypto, it's signed by your {{private key | A secret cryptographic key only you control; whoever has it controls your funds}}.`
- `Most wallets store assets on a {{Layer 1 | Base blockchain | A base-layer blockchain like Bitcoin, Ethereum, or Solana that records all transactions directly}}.`
- `Phantom supports {{SPL tokens | Solana's token standard, equivalent to Ethereum's ERC-20}} natively.`

A few per screen is reasonable for technical content; one or two is fine for friendlier topics. Don't tooltip basic words readers already know (`wallet`, `phone`, `email`). Tooltip the things that would prompt a reader to open a new tab to search.

**Not supported (don't write):**

- **Tables.** `| col | col |` won't render. Use a check-bullet list with bold key + value (`- [ ] **Latency:** sub-second`) instead.
- **Inline images** inside body Markdown — `![alt](url)` is not rendered. If you need a picture beside the text, use the `image-richtext` block format (image + content side by side).
- **Underline, spoilers, inline icons, inline buttons, font weight, custom color, text alignment.** These exist in the CMS toolbar for human edits but agent-written content shouldn't reach for them.
- **Inline SVGs** inside body Markdown. Use the `image-richtext` block (with the SVG approach below) when you need a visual; don't inline SVG markup into prose.

### 5b. Images — placeholder by default, SVG only on opt-in

**Default behavior (do this unless the orchestrator passed `maxImages: true`):**

Image-bearing blocks (`image-richtext`, `image`) ship **without an inline SVG**. Omit the `image:` (or `url:`) field entirely — the assembler stamps the flow-level `mediaPlaceholderUrl` (`/assets/placeholders/media.svg`) at render time and the CMS uses it whenever a block has no image set.

The `caption:` field is still **mandatory** for every image-bearing block. It serves two purposes:
1. Alt-text / accessible label today.
2. The prompt for a future image-generation pass (real raster or AI image-gen), which will replace the placeholder later.

So even though you're not drawing anything, write the caption as if briefing an illustrator. Caption format rules in §6 still apply (HEX from theme, no vague color words).

Example (default mode):

```
## Section 1 · Screen 1 — What is Phantom
type: image-richtext
position: right
caption: "Stylised multi-chain wallet icon, flat vector illustration, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"

**Phantom** is a multi-chain self-custodial wallet...
```

**Opt-in: "max images" mode** — the orchestrator (or user) explicitly asks for visuals on every image-bearing screen. Only in this mode do you design and inline an SVG illustration:

- Write each SVG to a sibling file under `<workdir>/images/`, e.g. `images/s1-s1.svg`, `images/s2-s3.svg`.
- Reference it from content.md by relative path: `image: images/s1-s1.svg`. The assembler inlines it as a base64 data URI at compile time (same `loadInlineSvg()` pattern already used for `logo.svg`).
- Do **not** base64-encode SVGs inline in content.md — it makes diffs unreadable and bloats the artifact.

Design rules for opt-in SVGs:

- viewBox `0 0 256 256` for square inline illustrations; `0 0 320 200` for wide hero-style images.
- Stick to `theme.md` palette — pull verbatim HEX values.
- Simple, clean shapes. If the concept is too complex, abstract it into a minimalist composition.
- Match the topic at a metaphorical level when possible (wallet → wallet shape, security → shield, network → connected dots).
- Visual coherence across the lesson — same style vocabulary across screens in a section.

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

### 7. Artifact layout

Final state of `<workdir>` after a complete fill run:

- `content.md` — all sections concatenated in plan order (the assembler reads this).
- `recaps/section-1-recap.md`, `recaps/section-2-recap.md`, ... — one per section. Not consumed by the assembler; kept for traceability, per-section retries, and as context fed to the next section.
- `images/` (only when `maxImages: true`) — per-screen SVG files referenced by relative path from content.md.

Start with a clean `content.md` (overwrite if a stale one exists from a prior run), then append section by section. On a fresh workdir, the file is created on first append.

### 8. Self-checks before finishing each section

After each section is appended:

- Every image-bearing block has a `caption` field.
- Every caption contains at least one HEX color (`#XXXXXX`).
- No banned vague color words.
- Quiz `correct` values match a choice ID.
- Form field types are within the allowed set.
- Section's screen count roughly matches the plan (off-by-one for split screens is OK).
- Screens use `---` separator on their own line.
- The section's recap file exists and is 3 sentences or fewer.

### 9. Hand off

After the final section + recap are written, tell the user where `content.md` is. Next: assemble (the orchestrator runs the `assemble` script).

## Hard rules

- Final aggregated artifact: `<workdir>/content.md`.
- Generated section-by-section, with per-section recap in `<workdir>/recaps/`.
- Markdown only. Per-screen header is plain key/value lines (YAML-style), not real YAML/JSON.
- Body content is plain Markdown (will be compiled to TipTap at assemble time — don't pre-compile).
- Block format names: use the catalog above verbatim. NEVER emit `richtext` as a format name — that's not registered. Use `text`.
- HEX values in captions come from `theme.md` — don't invent.
- Do not run any other skill in this conversation.
