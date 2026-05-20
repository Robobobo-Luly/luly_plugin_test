---
name: luly
description: |
  Create a Luly product end-to-end from a single natural-language prompt. Use when the user asks to create / make / build / generate / set up / draft a Luly academy, course, marketing campaign, waitlist, sales proposal, interactive pitch, or any "add a course / lesson to my academy" task. Also triggers on phrases like "I need a flow that ...", "build me a landing for ...", "make a quick training on ...". Run the full authoring pipeline internally (10 stages) in one conversation, defaulting aggressively, asking the user only when something is genuinely ambiguous. Output a single importable JSON file at tmp/luly-agent/<key>.luly.json. This is the primary user-facing skill — the per-stage /luly-* skills are internal building blocks the user does not invoke.
---

# Luly — one-prompt orchestrator

The user types ONE thing. You run the whole 10-stage pipeline and hand them back a JSON file ready to import into the CMS. **You never tell the user to type `/luly-brief`, `/luly-plan`, or any other per-stage command.** Those are your building blocks; you call their scripts directly via npm.

The user just wants a result. Get them one with minimum interruption.

## When to trigger

Auto-trigger on any of these intents:
- "create / build / make / generate / set up / draft / I need / I want" + ("flow", "course", "academy", "campaign", "marketing", "waitlist", "landing", "training", "proposal", "pitch", "onboarding", "lesson plan")
- "add a course / lesson to ..."
- An explicit `/luly` invocation

When you trigger, immediately start working. Don't ask "ok shall I begin?" — they already asked.

## When NOT to trigger

- The user is asking how something works ("what does /luly-plan do?") — answer the question, don't run the pipeline.
- The user is in the middle of using a per-stage skill — let them finish.
- The user is reviewing existing output — answer their question.

---

## The recipe

You execute these stages in order. Each writes a file under `tmp/luly-agent/` and runs the matching validator (npm script). Between stages, emit one concise progress line.

For each stage, the per-stage skill file in `.claude/skills/luly-<name>/SKILL.md` contains the deep rules — **read it only if you hit an edge case the catalog below doesn't cover.** The catalog below is sufficient for ~95% of prompts.

### Progress reporting

After each completed stage, print one line in this exact shape:
```
<stage label>             ✓ <one-line summary>
```

Don't paragraph. Don't explain. Status lines only. At the end, print the final file path + the import instruction.

---

## Inline catalogs (everything you need to know inline)

### 6 product presets

| Preset | User-facing name | When to pick | Tree shape | Defaults |
|---|---|---|---|---|
| `academy` | Academy | "academy", "school", "learning hub", "training program" | flow → onboarding + hub → 1 course → lessons → screens | quizzes on · forms off · onboarding 2 screens |
| `academy-course` | Course (add to existing academy) | "add a course to (the) academy", "extend the X academy", "another course for …" | course-only top level (no flow wrapper) | quizzes on · forms off · no onboarding |
| `campaign-course` | **Advanced campaign** | requires **EXPLICIT** "multi-step", "drip", "nurture sequence", "X-lesson series", "weekly campaign", "course-style campaign" cues | flow → hub → course → multiple lessons → screens | quizzes on · forms on |
| `campaign-simple` | **Basic campaign** | default for any "marketing campaign", "promo", "launch", "landing", "ad campaign", "lead-gen flow" — single-funnel | flow → hub → course → 1 lesson → screens | quizzes on · forms on |
| `waitlist` | Waitlist | "waitlist", "early access", "email signup", "lead capture" | same as campaign-simple, focus on form | quizzes off · forms on |
| `interactive-proposal` | Interactive proposal | "sales proposal", "pitch deck", "demo for client X" | same as campaign-simple, structured pitch | quizzes off · forms on |

### Hard rule for basic vs advanced campaign (read carefully)

**Single-lesson campaign → `campaign-simple` (basic). Always.** `campaign-course` (advanced) is only valid when the user explicitly asked for multi-lesson structure with phrasing like "drip campaign", "nurture sequence", "5-lesson series", "multi-step weekly campaign", "course-shaped marketing flow".

Two reinforcing checks you MUST run before locking in the preset:

1. **Topic-noun trap.** If the prompt says "campaign for my **X courses**" or "campaign for my **course catalog**", the word "courses"/"catalog" is the subject matter, NOT a structural cue. Do not let it pull you toward `campaign-course`. The result should be `campaign-simple` unless the user separately mentions multi-step structure.
2. **One-lesson check.** If your plan in stage 2 would be 1 lesson with N screens, your preset MUST be one of `campaign-simple`, `waitlist`, `interactive-proposal`, or `academy-course`. It must NOT be `campaign-course`. If you find yourself about to emit one lesson under `campaign-course`, switch the preset to `campaign-simple` (or whichever single-lesson preset fits best) BEFORE writing the product-type artifact.

### Block format catalog (per screen)

For each screen, pick ONE block format (sometimes 2 if both make sense):

| Format | Use for | Required body fields (stage-4 view) |
|---|---|---|
| `text` | plain narrative copy (canonical name — the renderer dispatches on `text`, NOT `richtext`) | `content` (Markdown) |
| `image-richtext` | hero or info screen with an image | `imageUrl`, `imagePosition` (left/right), `content` (Markdown); optional `caption` (one-sentence description that's both the visible caption under the image AND the prompt a future image-gen step uses to produce a real illustration) |
| `image` | standalone image | `url`, `alt`; optional `caption` |
| `video` | video clip | `url` (optional `poster`, `caption`) |
| `quiz-text` | multiple-choice quiz **with a context / setup text panel beside it**. Only use when there's real surrounding copy. | `question` (Markdown), `choices: [{id, text}]` (≥2, unique ids), `correctAnswer` (one of the ids), `text` (Markdown — the surrounding copy; REQUIRED for this format — if there's nothing to say, use `question` instead) |
| `question` | pure multiple-choice quiz, no surrounding copy | `question` (Markdown), `choices: [{id, text}]` (≥2, unique ids), `correctAnswer` (one of the ids) |
| `form-text` | lead-capture screen (campaigns/waitlists/proposals) | `content` (Markdown — pre-form headline + copy), `fields: [{id, type, label, required?, placeholder?, checkboxLabel?, links?}]`, `submitLabel`, `successContent` (Markdown — thank-you screen) |
| `layout` | responsive split-screen (rare, responsive mode only) | `ratio` (e.g. `"50:50"`) |

**Important — block format name pitfalls:**
- The renderer's plain-text block format is named `text` (it dispatches on `text` → `RichTextRenderer`). Do **NOT** emit `richtext` as a format — that name is not registered and the renderer will show "Unsupported block format". When you have a narrative-only screen, use either `text` (no image) or `image-richtext` (with a placeholder image).

**Single-component vs composite — pick the right format per screen.**

Several formats come in two variants: a **single-component** version and a **composite** version that pairs the primary thing with a text block. Use the composite ONLY when you'll actually fill **both** halves. Never emit a composite with an empty side — that produces a blank panel next to the primary content.

| Goal | Pick | Don't pick |
|---|---|---|
| Pure narrative screen (no image / video) | `text` | `image-richtext` with placeholder + empty `content` |
| Pure image screen (no copy) | `image` | `image-richtext` with empty `content` |
| Narrative with an accompanying image | `image-richtext` (both filled) | — |
| Pure quiz screen, no setup text | `question` | `quiz-text` with empty `text` |
| Quiz with a one-line setup or context blurb | `quiz-text` with `text` set | `quiz-text` with empty `text` |
| Pure lead-capture form, no surrounding copy | `form` or `email-form` | `form-text` with empty `content` |
| Form preceded by a pitch/headline | `form-text` (both filled) | — |

Rule of thumb: if you find yourself about to write a composite format with one half empty or trivially "&nbsp;" / `""`, **switch to the single-component variant of that format**.

**Form field types:** `text | email | url | tel | number | textarea | checkbox`. For `checkbox` type: `checkboxLabel` is the text rendered next to the box; `links` is an array of `{url, text}` for clickable links inside the label (e.g. Privacy Policy).

Content (`content` / `question` / `successContent`) is **Markdown**, not TipTap. Stage 9 compiles to TipTap. Do NOT pre-compile.

### Theme: agent generates colors; fonts from closed list

Colors are NOT picked from a preset palette — generate a fresh 18-token palette per request, matched to the brief's tone / audience / topic. Required tokens:

```
background, surface, primary, primaryLight, secondary, onSurface,
textColor, mutedTextColor, disabledTextColor, textOnPrimary,
border, disabled,
success, successLight, failure, failureLight, warning, warningLight
```

Each is a 6- or 8-char hex string. Aim for AA contrast on `textColor` vs `background` and `textOnPrimary` vs `primary`. Pick a primary hue that fits the topic (don't default to blue every time).

Fonts MUST come from this closed list of CSS family strings (use one of them verbatim):

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

See the per-stage `.claude/skills/luly-style/SKILL.md` for full palette and font-pairing guidance.

### Path scheme (for controls + overrides)

- `flow` — workspace root
- `hub` — academy preset only
- `course` — all presets except `academy-course` (which IS the course)
- `onboarding-N` — only when plan has `## Onboarding`
- `lesson-N` — each lesson
- `lesson-N.screen-M` — each screen
- For overrides on individual blocks: `lesson-N.screen-M.block-K` (k = 0-indexed)

---

## Slot extraction (parse the user's prompt)

For each slot below, extract from the prompt if present; otherwise use the default. **Do not ask the user about a slot you can default.**

| Slot | Look for | Default if absent |
|---|---|---|
| preset | the preset signals table above. **Default to `campaign-simple` (basic) for any marketing / promo / landing / lead-gen / waitlist-ish prompt unless the user explicitly mentions multi-step / drip / nurture / X-lesson / weekly series.** Topic nouns like "german courses" describe the subject, NOT the structure. If your stage-2 plan would emit one lesson, the preset MUST NOT be `campaign-course` — switch to `campaign-simple`. | `campaign-simple` if marketing-ish; ask only if genuinely between two |
| topic | the noun phrase ("german courses", "crypto basics", "Mako Wallet") | required — if missing, ask once |
| audience | "for beginners / pros / experts / mixed / mobile users / B2B / ..." | "general audience" |
| tone | "funny / serious / friendly / professional / technical / minimal / playful / authoritative / ..." | inferred from preset; campaign defaults to "friendly, concrete"; academy defaults to "clear, supportive" |
| length | "quick / short / single page" → quick; "deep dive / full / extensive" → long; else standard | `standard` |
| has-quizzes | "quizzes / tests / questions" → on; "no quiz" → off | preset default |
| has-form | "form / signup / waitlist / capture emails / lead capture" → on; "no form" → off | preset default |
| form copy hints | "first 50 users discount", "early access", "join the beta" — preserve in the form-text `content` | use generic copy |
| locales | "in german, english, spanish" — set locales accordingly | `["en"]` |
| theme | "dark theme", "playful look", "minimal" — match a theme preset | infer from tone |

**Don't ask the user about slot details that aren't in the prompt** if a default exists. Trust the defaults; the user can iterate after import.

---

## Stage-by-stage execution

For each stage, follow this micro-recipe:
1. Write the artifact file under `tmp/luly-agent/`.
2. Run the matching validator via Bash: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-<stage>`.
3. If it fails, surface the error to the user verbatim. Try once to fix mechanically (typo, off-by-one). If it still fails, stop and ask.
4. Emit one progress line. Move on.

### Stage 0 — brief.json

Write `tmp/luly-agent/brief.json` directly from the parsed slots:
```json
{
  "intent": "<one-sentence rephrase of the user's ask>",
  "audience": "<audience slot>",
  "tone": "<tone slot>",
  "lengthHint": "quick | standard | long",
  "materials": []
}
```

Validate: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-brief`.

### Stage 1 — product-type.json

```json
{
  "preset": "<picked preset>",
  "key": "<kebab-case from topic>",
  "rationale": "<one sentence>",
  "academyName": "<academy preset only — workspace + hub title>",
  "academyDescription": "<academy preset only, optional — one-line academy tagline>",
  "courseAuthor": "<academy / academy-course / campaign-course only, optional — author name from brief>"
}
```

Key generation: lowercase, kebab-case, [a-z0-9-], 3-50 chars, no double/leading/trailing hyphens. Generate from topic; the user can rename in CMS later.

**For `academy` preset specifically:** extract TWO distinct names from the user's prompt:
- `academyName` = the academy / school / hub label (e.g. "Blockchain Academy"). REQUIRED. Lands on flow.title + hub.title.
- The plan.md H1 = the FIRST course's name (e.g. "What is Blockchain"). Lands on course.title.

Without `academyName`, the validator rejects and you'd see flow/hub/course all collapsed to the same string.

For non-academy presets, omit `academyName` / `academyDescription` entirely.

For learning-shape courses (`academy`, `academy-course`, `campaign-course`), optionally set `courseAuthor` if the user supplied a brand / person / persona in the brief. Otherwise leave it out — empty is fine.

Validate: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-product-type`.

### Stage 2 — plan.md (and the validator emits plan.parsed.json sidecar)

Pick the shape based on preset:
- `academy`: `with-lessons` plan with `## Onboarding` section (2 screens) + 3 lessons × 3 screens
- `academy-course`: `with-lessons` plan, **no onboarding**, 3-5 lessons × 3 screens
- `campaign-course`: `with-lessons` plan, no onboarding, 4-5 lessons × 3 screens
- `campaign-simple` / `waitlist` / `interactive-proposal`: `with-lessons` plan with 1 lesson × 5-7 screens, last screen is the form

Markdown grammar (exact):
```
# <H1 — see rule below>

<optional one-line intro>

## Onboarding         ← academy preset only
- Screen 1: <synopsis>
- Screen 2: <synopsis>

## Lesson 1 — <title>
- Screen 1: <synopsis>
- Screen 2: <synopsis>
- Screen 3: <synopsis>

## Lesson 2 — <title>
- Screen 1: ...
```

**H1 meaning depends on preset:**
- `academy` → H1 is the **first course's name** (e.g. "What is Blockchain"). The academy/workspace/hub title lives in `product-type.academyName`, not here.
- `academy-course` → H1 is the course name (the course being added to an existing academy).
- All other presets → H1 is the flow / workspace / campaign name.

The optional intro paragraph becomes:
- `academy` → the **course description** (lands on course.description). The academy description, if any, is in `product-type.academyDescription`.
- All other presets → flow.description.

Synopses are ONE LINE each — they describe what the screen will be about, not the actual copy.

Write `tmp/luly-agent/plan.md`. Validate: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-plan` (this also writes `plan.parsed.json`).

### Stage 3 — format-profile.json

Apply preset defaults (table above), then layer any explicit user signals on top:

```json
{
  "screenMode": "story",
  "allowQuiz": <bool>,
  "quizDensity": "low",       // omit entirely when allowQuiz=false
  "allowMedia": true,
  "allowLayout": false,
  "allowForm": <bool>,
  "locales": ["en"]
}
```

Validate: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-format-profile`.

### Stage 4 — lesson-N.json (per lesson)

For each lesson N in plan.parsed.json.lessons, write `tmp/luly-agent/lesson-<n>.json`:

```json
{
  "n": N,
  "title": "<from plan>",
  "screens": [
    { "n": 1, "title": "<short>", "blocks": [ { "format": "...", ... } ] },
    ...
  ]
}
```

Rules:
- Mirror screen count from plan exactly.
- Pick ONE block format per screen, matching the synopsis + format-profile allowlist.
- Write `content` / `question` / `successContent` as plain Markdown.
- For campaign-shape presets, the **last screen of the last lesson** is typically a `form-text` block. Preserve any form-specific copy hints from the prompt (e.g., "first 50 users get a discount" goes in the `content`).
- **Default to `image-richtext` for narrative screens**, not `text`. Use `imageUrl: "/assets/placeholder-image.svg"` (the canonical project placeholder — renders cleanly in the CMS) and supply a `caption` field with a 1-sentence description of the illustration. The caption is **both** the human-visible caption under the image AND the prompt a future image-gen step uses to produce the real illustration. Example: `"caption": "Flat illustration of two cartoon characters learning German vocabulary at a desk, friendly style, warm colours"`.
- Use plain `text` format only when the screen is genuinely text-only (e.g., a recap or a quote with no visual).
- **Never emit `richtext` as a format name.** The renderer doesn't recognise it. Canonical names: `text` (pure rich text) or `image-richtext` (with image).
- No styles, no controls, no slugs in stage-4 output.
- Quiz `correctAnswer` must equal one of `choices[].id`; choice ids must be unique within a quiz.

After writing each file, validate it: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-lesson tmp/luly-agent/lesson-<n>.json`.

After all lessons: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-lesson --all` for a final batch check.

### Stage 4a — onboarding.json (only for academy preset)

Skip unless `plan.parsed.json.onboarding.length > 0` (academy only). Write:

```json
{
  "screens": [
    { "n": 1, "title": "Welcome", "blocks": [ { "format": "image-richtext", "imageUrl": "/placeholder/welcome.svg", "imagePosition": "left", "content": "## Welcome\n..." } ] },
    ...
  ]
}
```

Onboarding screens typically use `image-richtext` or `richtext`. Keep copy short — one headline + one or two sentences.

Validate: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-onboarding`.

### Stage 5 — theme.json

Generate a fresh 18-token color palette and pick two fonts. **There is no preset.** The agent thinks through:

1. **Light or dark background?** Choose based on tone (warm → light; tech/crypto → dark; corporate → very light; high-contrast → pure white).
2. **Primary brand color?** A hue that fits the topic — don't default to blue. Language learning → warm orange/teal; finance → navy/forest; crypto → cyan/violet; lifestyle → coral/sage.
3. **Derive the rest** — `surface`/`onSurface` are background tints; `textColor` has AA contrast against background; `mutedTextColor` ~60% strength; `disabledTextColor` ~30%; `textOnPrimary` is white-or-dark with AA contrast against primary; `border`/`disabled` are subtle; `success/failure/warning` use green/red/amber families.
4. **Fonts**: pick `fontHeading` and `fontBody` from the closed list above. Same-font pairs (e.g. Inter/Inter) are fine. For more character: Montserrat heading + Inter body, Nunito heading + Open Sans body, Poppins heading + Lato body.
5. **Optionally** add button radii / heights if the tone calls for it (sharp 0-4px for tech; rounded 12px+ for warm).

**Contrast targets (don't ship a palette that fails these):**

| Pair | Target | Notes |
|---|---|---|
| `textColor` vs `background` | ≥ 7:1 (AAA) | Body text — non-negotiable |
| `textOnPrimary` vs `primary` | ≥ 4.5:1 (AA) | If `primary` is light, `textOnPrimary` must be dark. If `primary` is dark, white text. |
| `mutedTextColor` vs `background` | ≥ 4.5:1 (AA) | Same hue as textColor, ~70% blended toward background |
| `surface` vs `background` | distinguishable (5–15% lightness shift) | Don't make them identical |
| `border` vs `background` | subtle but visible (10–20% darker on light, lighter on dark) | |
| `success` / `failure` / `warning` | green / red / amber families | their `*Light` companions ~15% saturation of the main |

**Worked palette examples** (anchors — generate fresh, don't copy):

| Vibe | background | surface | primary | primaryLight | textColor | mutedTextColor | textOnPrimary | success |
|---|---|---|---|---|---|---|---|---|
| Warm friendly | `#FFF8F0` | `#FFEAD5` | `#E85A3C` | `#FFD9C2` | `#2C1810` | `#7A5A40` | `#FFFFFF` | `#10B981` |
| Dark tech | `#0B0F1A` | `#161B2A` | `#22D3EE` | `#0E3A47` | `#E6E9EF` | `#94A3B8` | `#001017` | `#34D399` |
| Corporate | `#F8FAFC` | `#FFFFFF` | `#1E3A8A` | `#DBEAFE` | `#0F172A` | `#475569` | `#FFFFFF` | `#15803D` |
| Minimal | `#FFFFFF` | `#F5F5F5` | `#111111` | `#E0E0E0` | `#0A0A0A` | `#525252` | `#FFFFFF` | `#16A34A` |
| Playful pastel | `#FFFBF5` | `#FFF1E0` | `#F472B6` | `#FCE7F3` | `#1F2937` | `#6B7280` | `#FFFFFF` | `#34D399` |

Write `tmp/luly-agent/theme.json` with the full theme:

```json
{
  "colors": {
    "background": "#FFF8F0",
    "surface": "#FFEAD5",
    "primary": "#FF6B35",
    "primaryLight": "#FFD9C2",
    "secondary": "#6B8E23",
    "onSurface": "#FFF1E0",
    "textColor": "#2C1810",
    "mutedTextColor": "#8B6F47",
    "disabledTextColor": "#C9B79A",
    "textOnPrimary": "#FFFFFF",
    "border": "#F0DDB4",
    "disabled": "#F5EFE6",
    "success": "#10B981",
    "successLight": "#E8F8EF",
    "failure": "#DC2626",
    "failureLight": "#FBE6E6",
    "warning": "#F59E0B",
    "warningLight": "#FFE8C2"
  },
  "style": {
    "fontHeading": "\"Nunito\", sans-serif",
    "fontBody": "\"Inter\", sans-serif",
    "buttonBorderRadius": "12px"
  }
}
```

`layout` is optional; `style.*` size fields beyond fontHeading/fontBody are optional too.

Validate: `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-theme`. The validator confirms all 22 color tokens are present and valid hex, and both fonts are in the supported list.

### Stage 5b — course-icon.svg

Design a creative SVG course-card icon using the theme palette and the course topic. Write the SVG markup to `tmp/luly-agent/course-icon.svg` as plain text (no XML declaration, no doctype, just `<svg>…</svg>`).

Requirements:
- `viewBox="0 0 640 360"` (16:9 card)
- Self-contained: no `<script>`, no `<image href>` to external URLs, no `xlink:href`, no `<style>` blocks
- Use only colors from `theme.json` (which already reflects `brief.brand.colors` if present)
- At least 2 distinct shapes + a typographic element (course title fragment or initials)
- A topical visual concept when obvious (e.g., Phantom academy → ghost silhouette; security course → shield; language course → speech bubble); otherwise abstract geometry composed from the palette
- Pretty-printed, debuggable markup

See `luly-icon/SKILL.md` for worked examples (Phantom academy, warm-friendly course).

The SVG is later inlined into `course.body.cardImageSvg` by the assembler and rendered directly in the hub course card (no URL, no data URI — just markup).

### Stage 6 — overrides.json

Skip entirely unless the user explicitly asked for per-screen variation ("vary the background per lesson", "make the welcome screen full-bleed dark"). Default: do nothing.

### Stage 7 — controls.json (analytical)

Run: `${CLAUDE_PLUGIN_ROOT}/bin/luly apply-controls`. This is deterministic — no input from you. The script reads product-type + plan + lessons and writes a valid controls.json.

### Stage 8 — review agents (optional, skip by default)

Skip. The user gets a faster result. They can run `/luly-review-content` or `/luly-review-style` manually if they want a quality check.

### Stage 9 — assemble

Run: `${CLAUDE_PLUGIN_ROOT}/bin/luly assemble`. This compiles Markdown to TipTap, applies theme, embeds controls, stamps slugs and lexoRanks, and writes `tmp/luly-agent/<key>.luly.json`. It validates the output inline.

If it fails, surface the error verbatim.

---

## The hand-off

When stage 9 succeeds, end the conversation with this format:

```
✓ Done.

File: tmp/luly-agent/<key>.luly.json
- Type: <flow | course>
- Lessons: N · Screens: M · Blocks: K

To use it: open the CMS at {your tenant}.luly.io/cms, click Import, select that file.
For `academy-course` output specifically: use the "import under existing flow" path to attach it to your existing academy hub.
```

That's the end. Don't propose further work unless the user asks.

---

## Hard rules

- **Never tell the user to type any `/luly-*` slash command.** You run the pipeline; they don't.
- **Default aggressively.** Slot missing? Use the default. Don't interrogate.
- **One progress line per stage.** Status, not narrative.
- **Markdown in content fields**, not TipTap. Stage 9 compiles.
- **No styles / controls / visual fields in stage-4 output.** Validator will catch leaks.
- **Validators are gates.** Every artifact must pass its validator before moving on. If a validator fails:
  - First try to fix the file mechanically (typo, off-by-one, missing field).
  - If retry still fails, surface the error and stop. Do not skip past failures.
- **Do not run `/luly-overrides` (step 6) unless the user explicitly asked for per-screen variation.**
- **Do not run review agents (step 8) by default.** Faster default is no review; the user can request one.
- **Do not invoke other skills** during this run. Call their npm scripts directly via Bash.

---

## When to ask the user

Ask only if all three are true:
1. A slot is genuinely missing from the prompt.
2. No reasonable default exists.
3. The choice meaningfully changes the output.

Examples:
- Two preset candidates are equally plausible (e.g., "make a sales pitch for X" — could be `interactive-proposal` or `campaign-simple`). Ask which.
- The topic is missing entirely. Ask once.

Don't ask:
- Tone (default from preset).
- Length (default standard).
- Theme (default from tone).
- Locale (default en).
- Form copy specifics (use generic).
- Image choices (use placeholders).

When you do ask, ask ONE question max per pause. Then resume.

---

## Failure protocol

If a step fails after one mechanical retry:
1. Print the validator's error message verbatim.
2. Tell the user which file is at fault and how to inspect it (`cat tmp/luly-agent/<file>`).
3. Stop. Do not proceed to later stages.

If the user fixes the file manually, they can ask you to resume: at that point, re-run the failing validator and continue from there.
