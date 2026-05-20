---
name: luly-fill-lesson
description: Step 5 of the Luly authoring pipeline (runs AFTER theme + icon stages). For a single lesson, read brief + product-type + plan + format-profile + theme, write the lesson's screens and blocks as JSON. Image captions reference real HEX values from theme.json (and brand.colors). Content fields hold Markdown — Stage 9 compiles them to TipTap at assemble time. Run once per lesson; default behaviour processes the next un-filled lesson. Use after /luly-style has produced theme.json.
---

# Luly — Step 4: Fill one lesson

This is the first heavy LLM step. One lesson per invocation, focused
context, no styles, no controls. See `docs/flow-json-schema.html` § Step 4.

## Process

### 1. Load prior stages

Read:
- `tmp/luly-agent/brief.json` — for tone, audience, and `brand.colors` / `brand.voice` if present
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json`
- `tmp/luly-agent/format-profile.json`
- `tmp/luly-agent/theme.json` — **REQUIRED for caption HEX values**. The pipeline is ordered so theme always exists by the time fill-lesson runs.

If any is missing, stop and direct the user to the appropriate prior skill. Specifically: if `theme.json` is missing, run `/luly-style` first — content captions depend on it.

### 2. Pick the lesson

- **Explicit:** if user invoked with a number (e.g. "lesson 2" or `/luly-fill-lesson 2`), use that.
- **Default:** find the lowest `n` in `plan.parsed.json.lessons` for which `tmp/luly-agent/lesson-<n>.json` does **not** exist. Process that one.
- **Already complete:** if every lesson already has a file, tell the user the stage is done. Do not overwrite without explicit user instruction.

### 3. Compute the allowed block formats

From `format-profile.json`:

| Always | text, image-richtext, image |
| If `allowMedia` | + video |
| If `allowQuiz` | + quiz-text, question |
| If `allowLayout && screenMode = "responsive"` | + layout |
| If `allowForm` | + form, email-form, form-text |

You must not emit any block whose format is outside this set.

**Where to put form blocks:** for any campaign-style preset (anything except
academy), the **final screen of the last lesson** is the natural place for
a `form-text` lead-capture block. Look at the plan's screen synopses — if
the last one mentions "signup", "email capture", "join", "thank-you", that's
the form-text screen.

**Onboarding screens are not this skill's job.** If the plan has an
`## Onboarding` section (typically academy presets), those screens are filled
by `/luly-fill-onboarding`, not this skill. Skip them here.

### 4. Generate the lesson

Use `brief.tone`, `brief.intent`, `brief.audience`, and **this lesson's outline only** (from `plan.parsed.json.lessons[n-1]`).

For each screen in the plan:
- Mirror the screen count exactly — no adding, no dropping.
- Pick the single best block format from the allowlist given the synopsis. **Prefer `image-richtext` with a placeholder image** for any narrative screen — it gives the user a visual hook and lets a future image-gen step fill in real illustrations. Fall back to `text` (pure rich-text, no image) only when an image is genuinely irrelevant. **Never emit `richtext` as a format name — the renderer doesn't recognise it.**

**Composite vs single-component formats** — several formats come in pairs: a composite that pairs the primary thing with a text panel, and a single-component variant. Only use the composite when you will actually fill **both** halves. Picking a composite with an empty side produces a visible blank panel.

| Goal | Pick | Avoid |
|---|---|---|
| Pure quiz screen, no setup text | `question` | `quiz-text` with empty text |
| Quiz with a sentence of setup/context | `quiz-text` (set `text` field) | `quiz-text` with empty text |
| Pure narrative (no visual) | `text` | `image-richtext` with empty `content` |
| Narrative with an image | `image-richtext` (image + content both filled) | composite with one half empty |
| Pure form (no copy) | `form` / `email-form` | `form-text` with empty `content` |
| Form preceded by a headline / pitch | `form-text` (both filled) | composite with one half empty |
- Write the `content` and `question` fields as **plain Markdown**:
  use headings, bullets, emphasis. Do NOT produce TipTap JSON, do NOT stringify, do NOT escape.
- Image URLs: use the canonical project placeholder `/assets/placeholder-image.svg` — it's a real SVG that renders cleanly in the CMS. Do NOT invent paths like `/placeholder/foo.svg` — those files don't exist and produce broken-image icons. Real per-block images come later via image-gen or manual upload.
- For image-bearing blocks (`image-richtext`, `image`, `video`), set the `caption` field to a one-sentence description of the illustration. This caption is visible to the user under the image in the CMS, AND it's the prompt a future image-gen step will consume to produce a real asset.

  **Caption requirements (every image caption — non-negotiable):**

  1. **Subject** — what's in the image, one short clause.

  2. **Visual style direction** — 3–6 mood words about *technique / texture / illustration mode*. Examples: `"flat vector illustration"`, `"soft hand-drawn line art"`, `"glowing cyberpunk render"`, `"minimal geometric composition"`, `"refined editorial illustration"`, `"playful cartoon style"`. Be consistent across all captions in the same lesson.

  3. **Color anchors — ALWAYS use literal HEX, NEVER color words.**

     > ⛔ **Banned in captions:** vague color words like `"purple"`, `"blue"`, `"green"`, `"red"`, `"orange"`, `"violet"`, `"navy"`, `"teal"`, `"pink"`, `"yellow"`, `"black"`, `"white"`, `"dark"` (as a color), `"light"` (as a color), `"warm tones"`, `"cool tones"`, `"soft gradient"` (without HEX), `"muted palette"` (without HEX), `"brand colors"` (without HEX).
     > ✅ **Required:** every color mention in a caption is a 6-char HEX string with `#` prefix (e.g. `#AB9FF2`).

     **Source of HEX values** — both `theme.json` and `brief.brand.colors` are available at this stage. Use them in this priority:

     1. **`theme.json.colors` is the canonical source** — it's the resolved palette the rendered UI will actually use. Always reference these. Map:
        - `theme.colors.primary` → caption primary
        - `theme.colors.background` → caption background
        - `theme.colors.secondary` → caption accent / secondary
        - `theme.colors.textColor` → caption text color (rare; only if the prompt explicitly describes text inside the image)
     2. **`brief.brand.colors`** — these are already reflected in `theme.json` (the style stage anchors theme to brand), so reading from `theme.json` is enough. If the brand block specifies a color the theme doesn't surface (rare), reference the brand value directly.

     Format the color clause as: `using palette <#HEX> primary, <#HEX> background, <#HEX> accent` — roles are optional descriptors. Pick 2–3 most relevant colors; don't dump all 22 tokens.

     Because `theme.json` always exists at this point, **there is no "without colors" branch** — every caption gets HEX anchors.

  4. **Aspect ratio — optional, context-aware.** Don't reflexively append "1:1 aspect ratio" to every caption. Pick what fits the block's place in the layout:
     - **Square (1:1)** for thumbnails, small icons, and most inline image-richtext blocks where the image sits beside copy.
     - **Wide (16:9)** for hero-style image blocks that span the full screen width, or for any block clearly used as a banner.
     - **Tall (4:5 or 9:16)** only when the layout is mobile-only story mode and the image is full-bleed.
     - **Omit entirely** when you genuinely don't know — better to let the image-gen step pick than to lock in a wrong ratio.

     Pick once per lesson and stay consistent across that lesson's blocks. The card cover + course icon have their own dedicated step (`/luly-icon`) and ratios — those are not in scope here.

  **Caption format:**
  - With aspect: `"<subject>, <style direction>, using palette <#HEX> primary, <#HEX> background, <aspect> aspect ratio"`.
  - Without aspect: `"<subject>, <style direction>, using palette <#HEX> primary, <#HEX> background"`.

  The HEX clause is mandatory; the aspect clause is optional (see rule 4).

  **Worked examples:**

  ✅ Phantom inline image-richtext (brand has `#AB9FF2`, `#FFFFFF`, `#4A4A4A`; square thumbnail):
  ```
  "Friendly ghost mascot waving from inside a smartphone, flat vector illustration with soft glow, using palette #AB9FF2 primary, #FFFFFF background, #4A4A4A accent, 1:1 aspect ratio"
  ```

  ✅ Phantom hero banner block (wide):
  ```
  "Ghost mascot looking through a multi-chain wallet interface with gentle glow, flat vector illustration, using palette #AB9FF2 primary, #FFFFFF background, 16:9 aspect ratio"
  ```

  ✅ Generic lesson with HEX from theme (no brand block, theme generated as `#E85A3C` primary, `#FFF8F0` background):
  ```
  "Two cartoon characters chatting at a cafe with German books, warm pastel cartoon style, using palette #E85A3C primary, #FFF8F0 background"
  ```

  ❌ Wrong (uses banned vague color words):
  ```
  "Ghost mascot waving hello, soft purple gradient background, modern minimal style"
  ```
  Replace `"soft purple gradient background"` with `"using palette #AB9FF2 primary, #FFFFFF background"` — the HEX comes from `theme.json.colors`.

  ❌ Wrong (invents HEX not in `theme.json`):
  ```
  "Wallet icon, dark vector with deep #1A1A2E background"
  ```
  `#1A1A2E` doesn't exist in `theme.json.colors`. Use a real theme token (e.g. `theme.colors.background` or `theme.colors.surface`).

  ❌ Wrong (mandatory 1:1 on a hero banner that's wide in the layout):
  Forcing `1:1 aspect ratio` on a block the layout renders 16:9 wastes pixels. Match the block's actual aspect or omit.
- Keep block bodies minimal — only the fields below.

### Block format catalog (stage-4 fields only)

| format | Required fields |
|---|---|
| `text` | `content` (Markdown) — canonical pure-rich-text block (RichTextRenderer). |
| `image-richtext` | `imageUrl` (use `/assets/placeholder-image.svg` — the canonical CMS placeholder), `imagePosition` (`left`\|`right` — see rule below), `content` (Markdown), `caption` (**required for all image-bearing blocks** — one sentence in the format `"<subject>, <brief-derived style direction>, 1:1 aspect ratio"`; see caption rules above). |
| `image` | `url`, `alt` |
| `video` | `url` (optional `poster`) |
| `quiz-text` | `question` (Markdown), `choices` (≥2 `{id,text}`, unique ids), `correctAnswer` (one of the ids), `text` (Markdown — context/setup copy beside the quiz; REQUIRED when using this format. For pure quiz screens use `question` instead) |
| `question` | `question` (Markdown), `choices` (≥2 `{id,text}`, unique ids), `correctAnswer` (one of the ids) — pure quiz, no surrounding copy |
| `form` / `email-form` | `fields` (≥1; per-field schema below); optional `submitLabel`, `successMessage`. |
| `form-text` | `content` (Markdown — headline + body before the form), `fields` (per-field schema below), `submitLabel`, `successContent` (Markdown — thank-you screen). Use this format for lead capture in campaigns/waitlists — it's the canonical shape in real templates. |
| `layout` | `ratio` (e.g. `"50:50"`). Responsive mode only. |

#### Form field schema (used by `form`, `email-form`, `form-text`)

Each field is an object. **`type` must be exactly one of**: `text`, `email`, `number`, `tel`, `textarea`, `select`, `checkbox`. (Note: there is no `url` type — use `text` and validate downstream if needed.)

| Field key | Required | Applies to | Notes |
|---|---|---|---|
| `id` | yes | all | Stable kebab-case ID, unique within the form. |
| `label` | yes | all | Visible label above the input. For `checkbox` fields, leave as empty string `""` and use `checkboxLabel` instead — the renderer hides `label` on checkboxes. |
| `type` | yes | all | One of the seven listed above. |
| `required` | yes | all | Boolean. |
| `placeholder` | no | text / email / number / tel / textarea / select | Greyed hint inside the input. |
| `rows` | no | textarea | Visible rows, defaults to 3. |
| `options` | yes if `type:select` | select | Array of `{label, value}` — both strings. |
| `checkboxLabel` | yes if `type:checkbox` | checkbox | **Plain text only — never Markdown.** The renderer treats this as literal text and will not parse `[text](url)` syntax. For links, use the `links` array below. |
| `links` | no | checkbox | Array of `{text, url}` objects. The renderer appends each as a real `<a>` tag right after the checkbox label, joined with " and " when there are multiple. Use this for privacy-policy / terms / unsubscribe links. |

#### Checkbox encoding — right vs wrong

The renderer concatenates `checkboxLabel` + each `links[].text` (as a real link) + `' *'` if `required`. So you only need to write the **non-link** text in `checkboxLabel`; the link text comes from the `links` array.

❌ **Wrong — Markdown link inside `checkboxLabel`, link also duplicated:**
```json
{
  "id": "consent",
  "type": "checkbox",
  "label": "",
  "required": true,
  "checkboxLabel": "I want to hear about the opening and the 1¢ donor promo. I can unsubscribe any time. See our [Privacy Policy](https://example.com/privacy).",
  "links": [{"text": "Privacy Policy", "url": "https://example.com/privacy"}]
}
```
Renders as broken text + duplicate "Privacy Policy" link (your reported bug).

✅ **Right — plain text in `checkboxLabel`, the link in `links`:**
```json
{
  "id": "consent",
  "type": "checkbox",
  "label": "",
  "required": true,
  "checkboxLabel": "I want to hear about the opening and the 1¢ donor promo. I can unsubscribe any time. See our",
  "links": [{"text": "Privacy Policy", "url": "https://example.com/privacy"}]
}
```
Renders as: `[ ] I want to hear about the opening and the 1¢ donor promo. I can unsubscribe any time. See our Privacy Policy *` — where "Privacy Policy" is a real underlined link to the URL.

Two links example (terms + privacy):
```json
"links": [
  {"text": "Terms",          "url": "https://example.com/terms"},
  {"text": "Privacy Policy", "url": "https://example.com/privacy"}
]
```
Renders as: `… See our Terms and Privacy Policy *`.

**Hard rules:**
- `checkboxLabel` is never Markdown. No `[text](url)`, no `**bold**`, no escapes — plain string.
- Every hyperlink in a checkbox label MUST go in the `links` array. Do not include link text in `checkboxLabel`; the renderer appends it from `links`.
- End `checkboxLabel` with a trailing space or natural connector word ("See our", "I agree to the", "By submitting you accept the") — the renderer inserts a single space before each link.

### 5. Write the file

Write `tmp/luly-agent/lesson-<n>.json` (pretty-printed). Overwrite without prompting.

Shape:
```json
{
  "n": <lesson number>,
  "title": "<lesson title from plan, or null for screens-only synthesised lesson>",
  "screens": [
    {
      "n": 1,
      "title": "<short screen title>",
      "blocks": [ { "format": "...", ... } ]
    }
  ]
}
```

### 6. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-lesson tmp/luly-agent/lesson-<n>.json
```

Report the per-screen summary back to the user (the validator prints the block format on each screen).

If validation fails, fix the JSON and re-run.

### 7. Hand off

Tell the user:
- The lesson file is at `tmp/luly-agent/lesson-<n>.json`.
- Run `/luly-fill-lesson` again to process the next un-filled lesson, or `/luly-fill-lesson <m>` to redo a specific one.
- Once all lessons are filled, run `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-lesson --all` to batch-check before stage 5.

## Hard rules

- Read-only on prior stage artifacts.
- Write only to `tmp/luly-agent/lesson-<n>.json` for the lesson you picked.
- **One lesson per invocation.** Do not loop over multiple lessons in one conversation.
- **No `style`, no `controlStyle`, no `controls`, no slugs, no visual fields** (`aspectRatio`, `width`, `borderRadius`, `objectFit`, `objectPosition`, `loadingStyle`, `quizPosition`, `autoSubmit`, `shuffleChoices`, `showCorrectAnswer`, `mediaType`, etc.). These leak from earlier templates and the validator will reject them.
- **Content fields hold Markdown.** Not TipTap. Not stringified. Not escaped.
- **Block formats restricted** to the allowlist derived from format-profile.
- **Single locale only** (`format-profile.locales[0]`). Multi-locale is a future skill.
- Quiz `correctAnswer` MUST equal one of the choice `id` values; choice `id`s MUST be unique within a quiz.
- Do not run any other skill in this conversation.
