---
name: luly-fill
description: Stage 4 of the Luly authoring pipeline. Write all screen content (onboarding + sections × screens) as a single content.md. Each screen holds one or more blocks (separated by `+++`); blocks can nest inside containers / sections / sliders. Per-block YAML-style headers + Markdown bodies. Reads theme.md for HEX values used in image captions.
---

# Luly — Stage 4: Fill content

One file. All screens. Each screen is an ordered list of **blocks**. A block has a YAML-style header (block `type` + structured fields) and, for text, a Markdown body. Multiple blocks in one screen are separated by a line containing only `+++`. Screens are separated by a line containing only `---`. Onboarding and sections are uniform — both are just "ordered groups of screens".

**Before writing any screen body**, read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and apply it.
Key non-negotiables: stories are 3–4 sentences, fit one mobile screen, never end bullets or headings with punctuation, American English, no emojis, no rhetorical questions, no long compound sentences.
Quizzes: one per lesson, 2–3 questions, three options, only one correct, shuffle correct-answer position across questions.

## The block model (read this first)

Luly screens are composed of blocks, mirroring the CMS editor. There are **leaf** blocks (render content) and **container** blocks (hold other blocks).

- **Leaves:** `text`, `image`, `video`, `animation`, `question`, `form`, `email-form`, `button`.
- **Containers:** `container` (responsive row/column with per-child `flex`), `section` (full-bleed band that stacks blocks), `slider` (carousel of slides).
- **Preset sugar** (strongly preferred for the common "X beside text" layout): `media-text`, `quiz-text`, `form-text`, `quiz-media`. Writing one of these as a single block automatically expands to a `container` with two correctly-sized children — you do NOT hand-write the container.

**Most screens are simple:** a single `text` leaf, or a single sugar preset (`media-text`). Reach for explicit `container` / `section` / `slider` only when the design genuinely calls for it (a landing band, a multi-pane row, a carousel). Don't over-compose.

### Writing multiple / nested blocks

Within a screen, separate blocks with `+++`. To nest blocks inside a container, give the container an `as:` id and point each child at it with `parent:`:

```
## Section 1 · Screen 2 — Two ways to earn
type: container
as: row
layout: row
gap: 64

+++

type: image
parent: row
flex: 3
caption: "Two labelled coin stacks, flat vector, using palette #2660F5 primary, #EBE9E7 background, 1:1 aspect ratio"

+++

type: text
parent: row
flex: 4

## Stake or provide liquidity
Both put idle tokens to work. Staking secures the network; liquidity powers swaps.
```

A `section` band works the same way (children stack vertically), as does a `slider` (children are slides). Top-level blocks (no `parent:`) render in document order.

## Process

### 1. Load prior stages

Read:
- `<workdir>/intake.md` — for tone, audience, brand voice
- `<workdir>/plan.md` — for preset, frontmatter, sections, screen synopses
- `<workdir>/theme.md` — **REQUIRED** for HEX values used in image captions

If any is missing, stop and tell the user to run the missing stage first.

### 2. Compute the allowed block formats

From plan frontmatter (`mode`, `quizzes`, `forms`):

| Always allowed | text, image, media-text, container, section, slider, button |
| If `quizzes: on` | + question, quiz-text |
| If `forms: on` | + form, email-form, form-text |
| If a video URL is in materials | + video, animation |

Don't emit a block whose format is outside this set. (`container` / `section` / `slider` are always available, but use them only when the layout needs them — see "don't over-compose".)

### 3. Generate one section at a time, with carry-forward recap

A `## Template courses` block in plan.md (if present) is NOT a section — skip it entirely. Those are content-less course shells the assembler builds from a default scaffold; never write content for them.

The plan is processed in order: onboarding first (if present), then Section 1, Section 2, ... in plan order. Each section is generated as **its own focused pass** rather than streamed alongside the others. This keeps tone consistent, makes per-section retries cheap, and lets each pass enforce its own per-lesson rules (one quiz per lesson, 2–3 questions, etc.).

For each section:

**(a) Read context.** Always: intake.md, plan.md, theme.md, writing-guidelines.md. Plus the **most recent recap file** (see (d)) if one exists from the previous section.

**(b) Generate the section's screens.** For each screen in this section's plan entry:
1. Decide the screen's block shape. Default to **one** block: a `text` leaf for prose, or a `media-text` preset when the screen carries a visual. Use an explicit `container` / `section` / `slider` only when the design needs it.
2. Write a `## Onboarding · Screen N — title` or `## Section M · Screen N — title` header.
3. Below it, write the block(s). Each block is a YAML-style header (`type:` + fields) and, for `text`, a blank line then the Markdown body. Separate multiple blocks with `+++`; nest with `as:` / `parent:`.
4. Markdown body pattern: a single `# H1` title → intro sentence → optional bullets → optional closing line. No tables. Reserve `##`+ for long-form, article-like products only (writing-guidelines.md §8). No emojis. Each story 3–4 sentences (writing-guidelines.md §3); split into two screens if longer.
5. End the screen with `---` on its own line.

Screen count can deviate slightly — if a story would be too long, split into two screens rather than cramming.

**(c) Append to content.md.** Write the section's screens to `<workdir>/content.md` in plan order. Use `>> Append` semantics — do NOT overwrite earlier sections when generating later ones. (Read content.md if it exists, append the new section, write the whole thing back. Or use shell `>>`.)

**(d) Write a recap.** After completing the section, write `<workdir>/recaps/section-N-recap.md` — **3 sentences maximum** capturing key terms introduced, tone/voice settled on, and recurring metaphors. The next section's pass reads this and respects it.

**(e) Move to the next section.** Repeat from (a).

**Subagent option (orchestrator's choice):** the orchestrator MAY spawn an Agent subagent per section, passing it the workdir + prior recap. Each subagent produces one section's screens and writes its recap before returning. Default is a single agent processing sections sequentially.

### 4. Block format catalog

Leaves:

| Format | Header fields | Body |
|---|---|---|
| `text` | `type: text` | Markdown content (the prose) |
| `image` | `type: image`<br>`image: <see image rules §5b>` (omit for placeholder)<br>`alt: <alt text>`<br>`caption: "<see §6>"` | (none) |
| `video` | `type: video`<br>`url: <url>` | (none) |
| `animation` | `type: animation`<br>`url: <url>` | (none) |
| `question` | `type: question`<br>`question: "<the question>"`<br>`choices:` bulleted list (≥2)<br>`correct: <id>` | (none) |
| `form` / `email-form` | `type: form` (or `email-form`)<br>`fields:` bulleted list (≥1)<br>`submitLabel: <text>` (optional)<br>`successMessage: <text>` (optional) | (none) |
| `button` | `type: button`<br>`label: <button text>`<br>`target: <goto target>` (optional, default `next_sibling`) | (none) |

Preset sugar (expands to a `container` + two children — write it as ONE block):

| Format | Header fields | Body | Expands to |
|---|---|---|---|
| `media-text` | `type: media-text`<br>`image: <…>` (omit for placeholder)<br>`alt: <…>` · `caption: "<§6>"`<br>`position: left` or `right` (optional, default image-left) | Markdown (the text pane) | container[image flex 3, text flex 4] |
| `quiz-text` | `type: quiz-text`<br>`question:` · `choices:` · `correct:` | Markdown (context beside the quiz) | container[question flex 3, text flex 4] |
| `form-text` | `type: form-text`<br>`fields:` · `submitLabel:` (opt) · `successContent:` (opt) | Markdown (copy beside the form) | container[email-form flex 3, text flex 4] |
| `quiz-media` | `type: quiz-media`<br>`question:` · `choices:` · `correct:`<br>`image:` · `alt:` · `caption:` | (none) | container[question flex 4, image flex 3] |

Containers (use `as:` so children can `parent:` them):

| Format | Header fields | Children |
|---|---|---|
| `container` | `type: container`<br>`as: <id>`<br>`layout: row` or `column` (optional, default row)<br>`gap: <px>` (optional)<br>`align:` / `justify:` (optional)<br>`layoutMobile: row`/`column` · `gapMobile:` (optional) | Any blocks via `parent: <id>`; give each a `flex:` weight for row layouts |
| `section` | `type: section`<br>`as: <id>`<br>`verticalAlign: start`/`center`/`end` (optional)<br>`horizontalAlign: left`/`center`/`right` (optional) | Any blocks via `parent: <id>`; they stack vertically (full-bleed band) |
| `slider` | `type: slider`<br>`as: <id>`<br>`dots: true` · `arrows: true` · `autoplay: true` · `loop: true` (all optional) | Slides via `parent: <id>` (usually `text` or `media-text`) |

**Prefer the sugar.** For "image beside text", "quiz beside text", "form beside text", write the single sugar block — never hand-build the container + two children. Reserve explicit `container` for layouts the sugar can't express (3+ panes, custom flex, column stacks).

**Empty-pane rule:** never emit a sugar preset with one half empty. If the body would be empty, use the leaf instead (`image`, `question`, `form`).

**Block-shape consistency across story screens (mandatory):** within one story arc (onboarding sequence, lesson, a section's screens), keep the same shape — either every story screen is `media-text` (visual + text) or every story screen is `text`. Don't intermix (illustration on screen 1, text-only on screen 2 reads as a regression). Default to `media-text` for story content unless the user wants a stripped-down text-only feel or the topic doesn't lend itself to per-screen visuals. Functional screens (`question`, `form`, `quiz-text`, `form-text`) are exempt.

**Don't hand-author block margins/spacing.** The renderer applies consistent per-block spacing by default. The sugar already zeroes its children's margins. Leave `margin*` unset for normal generation — it's a polishing lever for the agentic-edit scope.

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

Quiz `correct` must match one of the choice IDs. Choice IDs must be unique within the quiz.

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

Field types: `text | email | number | tel | textarea | select | checkbox`. (No `url` type.) For `checkbox`, `checkboxLabel` is plain text (never Markdown); `links` is optional.

### 5a. Markdown content — what the renderer actually supports

Every Markdown body (the body of a `text` block, including the text pane of a `media-text` / `quiz-text` / `form-text` preset) is compiled to TipTap JSON at assemble time. Use the full feature set.

**Block elements:**

| Markdown | Renders as |
|---|---|
| `# H1` / `## H2` / `### H3` / `#### H4` | Headings (4 levels max; `#####`+ ignored) |
| Blank line | Paragraph break |
| `- item` or `* item` | Bullet list (default disc style) |
| `- [ ] item` / `- [x] item` | Check-style bullet list (visual only; if any item uses `[ ]`/`[x]`, the whole list goes check-style) |
| `1. item` | Numbered list |
| `> quoted line` | Blockquote (consecutive `>` collapse; a lone `>` makes a paragraph break inside the quote) |

**Inline marks:**

| Markdown | Renders as |
|---|---|
| `**bold**` | Bold |
| `*italic*` / `_italic_` | Italic |
| `` `code` `` | Inline code |
| `[label](https://url)` | Hyperlink |
| `{{term \| description}}` | Definition tooltip — `term` renders inline with a hover-styled trigger; click shows a popover with `description`. Title defaults to `term`. |
| `{{term \| title \| description}}` | Same, with a custom popover title distinct from the trigger. |

**Definition tooltips are the high-value feature for educational content.** Use them whenever a domain term, acronym, or concept benefits from an inline definition without breaking flow:

- `When you send crypto, it's signed by your {{private key | A secret cryptographic key only you control; whoever has it controls your funds}}.`
- `Most wallets store assets on a {{Layer 1 | Base blockchain | A base-layer blockchain like Bitcoin, Ethereum, or Solana that records transactions directly}}.`

A few per screen for technical content; one or two for friendlier topics. Don't tooltip basic words (`wallet`, `phone`, `email`). Tooltip what would send a reader to a new tab.

**Not supported (don't write):**

- **Tables** (`| col | col |`). Use a check-bullet list with bold key + value (`- [ ] **Latency:** sub-second`).
- **Inline images** (`![alt](url)`). For a picture beside text use the `media-text` preset.
- **Underline, spoilers, inline icons/buttons, font weight, custom color, text alignment** — CMS-toolbar features, not for agent-written content.
- **Inline SVGs** inside body Markdown. Use the `image` / `media-text` block (with the SVG approach below) instead.

### 5b. Images — placeholder by default, SVG only on opt-in

**Default (unless the orchestrator passed `maxImages: true`):**

Image-bearing blocks (`image`, `media-text`, `quiz-media`) ship **without an inline SVG**. Omit the `image:` field entirely — the assembler stamps the flow-level `mediaPlaceholderUrl` (`/assets/placeholders/media.svg`) and the CMS uses it whenever a block has no image set.

The `caption:` field is still **mandatory** for every image-bearing block. It serves two purposes: alt-text/accessible label today, and the prompt for a future image-generation pass. Write it as if briefing an illustrator. Caption format rules in §6 apply.

Example (default mode):

```
## Section 1 · Screen 1 — What is Phantom
type: media-text
position: right
caption: "Stylised multi-chain wallet icon, flat vector illustration, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"

**Phantom** is a multi-chain self-custodial wallet...
```

**Opt-in: "max images" mode** — the orchestrator/user explicitly asks for visuals on every image-bearing screen. Only then design and inline an SVG:

- Write each SVG to a sibling file under `<workdir>/images/`, e.g. `images/s1-s1.svg`.
- Reference it by relative path: `image: images/s1-s1.svg`. The assembler inlines it as a base64 data URI at compile time.
- Do **not** base64-encode SVGs inline in content.md.

Design rules for opt-in SVGs: viewBox `0 0 256 256` (square) or `0 0 320 200` (wide); stick to `theme.md` palette (verbatim HEX); simple clean shapes; metaphor-matched; coherent style across a section.

### 6. Image captions — HEX from theme, no vague color words

Read the palette from `theme.md`. Every image caption MUST follow:

```
"<subject>, <style direction>, using palette <#HEX> primary, <#HEX> background[, more HEX], <aspect>"
```

- **HEX clause mandatory.** Pull from `theme.md` — at minimum `primary` and `background`.
- **Banned in captions:** `purple`, `blue`, `green`, `red`, `orange`, `violet`, `navy`, `teal`, `pink`, `yellow`, `dark`/`light`/`warm`/`cool` (as color descriptors), `soft gradient`, `muted palette`, `brand colors` (without HEX). Use only HEX.
- **Style direction** = technique (3–6 mood words): `flat vector illustration`, `soft hand-drawn line art`, etc. Keep consistent across a section.
- **Aspect** optional — `1:1 aspect ratio` for square, `16:9` for wide.

Example: `"Friendly ghost mascot waving from inside a smartphone, flat vector illustration with soft glow, using palette #AB9FF2 primary, #FFFFFF background, 1:1 aspect ratio"`.

### 7. Artifact layout

Final state of `<workdir>` after a complete fill run:

- `content.md` — all sections concatenated in plan order (the assembler reads this).
- `recaps/section-1-recap.md`, ... — one per section. Not consumed by the assembler; kept for traceability and as context for the next section.
- `images/` (only when `maxImages: true`) — per-screen SVG files referenced by relative path.

Start with a clean `content.md` (overwrite a stale one), then append section by section.

### 8. Self-checks before finishing each section

- Every image-bearing block has a `caption` field.
- Every caption contains at least one HEX color (`#XXXXXX`).
- No banned vague color words.
- Quiz `correct` values match a choice ID.
- Form field types are within the allowed set.
- Every `parent:` references an `as:` id defined in the SAME screen, and that block is a container (`container` / `section` / `slider`).
- Section's screen count roughly matches the plan.
- Screens use `---` on their own line; blocks within a screen use `+++` on their own line.
- The section's recap file exists and is 3 sentences or fewer.

### 9. Hand off

After the final section + recap, tell the user where `content.md` is. Next: assemble (the orchestrator runs the `assemble` script).

## Hard rules

- Final aggregated artifact: `<workdir>/content.md`.
- Generated section-by-section, with per-section recap in `<workdir>/recaps/`.
- Markdown only. Per-block header is plain key/value lines (YAML-style), not real YAML/JSON.
- Body content is plain Markdown (compiled to TipTap at assemble time — don't pre-compile).
- Block format names: use the catalog above verbatim. NEVER emit `richtext` (use `text`) or the retired monolithic names `image-richtext` / `form-text` as a leaf — for "X beside text" use the `media-text` / `quiz-text` / `form-text` **preset sugar**, which expands to a real container.
- Screens separate with `---`; blocks within a screen separate with `+++`.
- HEX values in captions come from `theme.md` — don't invent.
- Do not run any other skill in this conversation.
