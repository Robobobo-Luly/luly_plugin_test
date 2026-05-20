---
name: luly-fill-lesson
description: Step 4 of the Luly authoring pipeline. For a single lesson, read brief + format-profile + plan, write the lesson's screens and blocks as JSON. Content fields hold Markdown — Stage 9 compiles them to TipTap at assemble time. Run once per lesson; default behaviour processes the next un-filled lesson. Use after /luly-format has produced format-profile.json.
---

# Luly — Step 4: Fill one lesson

This is the first heavy LLM step. One lesson per invocation, focused
context, no styles, no controls. See `docs/flow-json-schema.html` § Step 4.

## Process

### 1. Load prior stages

Read:
- `tmp/luly-agent/brief.json`
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json`
- `tmp/luly-agent/format-profile.json`

If any is missing, stop and direct the user to the appropriate prior skill.

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
- For image-bearing blocks (`image-richtext`, `image`, `video`), set the `caption` field to a one-sentence description of the illustration. This caption is visible to the user under the image in the CMS, AND it's the prompt a future image-gen step will consume to produce a real asset. Example: `"caption": "Flat illustration of two cartoon characters learning German, friendly warm style"`.
- Keep block bodies minimal — only the fields below.

### Block format catalog (stage-4 fields only)

| format | Required fields |
|---|---|
| `text` | `content` (Markdown) — canonical pure-rich-text block (RichTextRenderer). |
| `image-richtext` | `imageUrl` (use `/assets/placeholder-image.svg` when no real asset is available — the canonical CMS placeholder, renders cleanly), `imagePosition` (`left`\|`right`), `content` (Markdown), optional `caption` (1-sentence description of the illustration — doubles as the visible caption shown under the image in the CMS AND the prompt a future image-gen step uses to produce the real illustration — e.g. *"flat illustration of two people learning German at a cafe, friendly warm style"*). |
| `image` | `url`, `alt` |
| `video` | `url` (optional `poster`) |
| `quiz-text` | `question` (Markdown), `choices` (≥2 `{id,text}`, unique ids), `correctAnswer` (one of the ids), `text` (Markdown — context/setup copy beside the quiz; REQUIRED when using this format. For pure quiz screens use `question` instead) |
| `question` | `question` (Markdown), `choices` (≥2 `{id,text}`, unique ids), `correctAnswer` (one of the ids) — pure quiz, no surrounding copy |
| `form` / `email-form` | `fields` (≥1 `{id,label,type,required?,placeholder?}`); optional `submitLabel`, `successMessage`. `type` ∈ `text \| email \| url \| tel \| number \| textarea \| checkbox` |
| `form-text` | `content` (Markdown — headline + body before the form), `fields` (as above; checkbox fields may add `checkboxLabel` and `links: [{url,text}]`), `submitLabel`, `successContent` (Markdown — thank-you screen). Use this format for lead capture in campaigns/waitlists — it's the canonical shape in real templates. |
| `layout` | `ratio` (e.g. `"50:50"`). Responsive mode only. |

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
