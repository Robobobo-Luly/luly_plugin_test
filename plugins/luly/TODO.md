# TODO — pipeline improvements

Organized into phases. Phase 1 is the priority and should be implemented before Phase 2/3. Each item is scoped enough to start without re-asking.

---

## PHASE 1 — Foundation (do these first, in order)

Progress:
- [x] 1.1 Writing guidelines wiring
- [x] 1.4 Placeholder-first image approach (assembler + fill skill)
- [x] 1.5 Brand-research failure UX (intake)
- [x] 1.2 Section-by-section fill with carry-forward recap
- [x] 1.3 Non-section content agent (title / description / tags / hub logo)
- [x] 1.6 Validator agent — guideline compliance

### 1.1 Writing guidelines — make agents follow them by default

A Luly writing-style spec already exists at `guidelines/writing-guidelines.md`. Right now no agent reads it.

- Every content-producing agent (intake, plan, fill, the new non-section-content agent) reads `guidelines/writing-guidelines.md` and follows it.
- Add a single line to the top of each skill: *"Before writing, read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and follow it."*
- Guidelines content is authoritative — if a per-skill rule conflicts with the global guidelines, the global wins.

### 1.2 Section-by-section fill with carry-forward recap

Today `luly-fill` writes all sections × screens in one giant agent pass. Switch to per-section.

- One agent call per section. Output appended to `content.md` (or written per-section as `content/section-N.md` and concatenated at the end).
- After each section, the agent writes a **3-sentence-max recap** — key terms introduced, tone settled on, recurring metaphors.
- The next section's call receives intake + plan + theme + writing-guidelines + the recap.
- Benefits: lower per-call context, retryable per-section, easier to enforce per-section rules (one quiz per lesson, 2–3 questions per quiz).

### 1.3 Non-section content agent (title, description, tags, hub logo)

Today's gaps: no first-class generation of marketing title, description, tags, or hub logo. Spin up a dedicated stage between Plan and Fill — or as a sibling of Fill.

- **Course title** — 3–4 words, no project name (per writing guidelines §7).
- **Course description** — one short sentence overview (per §7).
- **Tags** — 3–5 from a known taxonomy. (Decide taxonomy source — new file?)
- **Hub logo** (academy preset only):
  - Use the actual brand logo ONLY if intake's brand research reliably found a logo URL at decent quality (resolvable, ≥256px, transparent or clean background).
  - Otherwise, leave empty — the flow-level `iconPlaceholderUrl` (see 1.4) covers it.
  - Do NOT auto-generate an SVG hub-logo by default.

### 1.4 Simplified image approach — placeholders by default, SVG only on request

Drop the "every image-block gets an inline base64 SVG" default. Lean on the 3 flow-level placeholder fields already supported by `flow.body`:

| Field | Purpose | Bundled default |
|---|---|---|
| `mediaPlaceholderUrl` | Empty media/image/video/animation blocks | `/assets/placeholders/media.svg` |
| `cardPlaceholderUrl` | Course with no `cardImageUrl` (hub card + course header) | `/assets/placeholders/card.png` |
| `iconPlaceholderUrl` | Course with no `iconUrl` (icon next to author) | `/assets/placeholders/icon.png` |

Implementation:
- Assembler stamps the 3 placeholder URLs onto `flow.body` by default. No agent action needed.
- Fill stage stops generating per-screen inline SVGs by default. Image blocks ship with **just the caption** — which serves as both alt-text and the prompt for a future real image-gen pass.
- Add an opt-in "max images" mode (CLI flag or orchestrator slot) — only then does fill generate per-screen SVGs and inline them. When on, do it via sibling files (`images/s1-s1.svg`) referenced by relative path; assembler inlines as base64 at compile time (same pattern as the existing `loadInlineSvg()`).
- Either way, the caption keeps the natural-language image prompt for future image-gen wiring.

### 1.5 Brand-research failure → ask the user, don't silent-fallback

Today: if research fails, style falls back to default Luly palette (recently patched). Better: pause and offer choices via `AskUserQuestion` when brand colors weren't **reliably** identified.

Three options:
1. **Proceed with default Luly styling** — neutral palette.
2. **Try a topic-themed styling** — agent proposes a palette inspired by the *topic* (not the brand name); shows hex preview; user confirms.
3. **Provide extra materials** — user pastes brand-book URL, screenshot, exact hex codes, or any reference. Include tips on how to gather: "open the site in a browser, inspect a button's CSS, copy the background-color"; "check the company's press kit / brand assets page"; "look for `meta name=theme-color` in the page source".

Define "reliably identified" — at minimum: verified primary + background hex from an authoritative source (CSS bundle, brand book, manifest). If only one of those is found, treat as unreliable and ask.

### 1.6 Validator agent — guideline compliance check before assemble

A final agent runs after fill (and after the non-section-content agent) and validates the generated content against `guidelines/writing-guidelines.md`.

- Checks: title is sentence case; story sentence count is 3–4; bullets have no trailing periods; headings have no trailing punctuation; one quiz per lesson with 2–3 questions; correct-answer positions shuffled across the course; description is one sentence; etc.
- On violations: either report + ask user to accept, or auto-fix the mechanical ones (periods, capitalization) and report the substantive ones (sentence count, quiz count) for manual revision.
- Goal: catch drift before assemble runs.

---

## PHASE 2 — Cleanup

### 2.1 Clean dead code
- `block-validation.ts:loadFormatProfile()` reads `format-profile.json` and throws "run /luly-format first" — that stage was collapsed in v0.2. Delete the function and any call sites.
- `allowedFormats(fp)` is exported from `block-validation.ts` but never called by `assemble.ts`. Either wire it back as the actual gate, or remove.
- Audit `scripts/` for any other v0.1-era functions unreachable from `bin/luly`.

### 2.2 README cleanup
- README mentions `/luly-overrides` and `/luly-controls` which don't exist in v0.2.
- Decision: **delete the README entirely for now**, regenerate from scratch once the pipeline stabilizes.
- Also remove references to deprecated commands from any skill files.

### 2.3 Reduce scripts surface area
- Enumerate every file in `scripts/` and decide keep / merge / delete.
- `assemble.ts` is the only entrypoint — anything not on its call graph is suspect.
- Consolidate validators if there's overlap.
- Goal: fewer files, fewer indirection levels, fewer things to keep in sync with skill docs.

---

## PHASE 3 — Expansion

### 3.1 Expand the theme — buttons, radii, real styling tokens
Today the theme has colors + fonts + 3 optional style tokens. Not enough for real product styling.
- Button variants — primary/secondary/ghost: fill, text, border, hover.
- Typography scale — h1/h2/h3/body size + weight + line-height.
- Shadow scale (sm/md/lg) and spacing scale (xs/sm/md/lg/xl).
- Update `REQUIRED_STYLE_TOKENS` / `OPTIONAL_STYLE_TOKENS` in `scripts/themes.ts`.
- Update the default Luly palette in `luly-style/SKILL.md` to include the new tokens.
- Decide: which tokens are required vs optional (required = breaks generation if missing).

### 3.2 Localization — "one language only, but you pick which"
Today `locales: [en, de]` is parsed but no multi-language generation happens.
- In intake/orchestrator: if user asks for multiple languages → reply "only one locale is supported right now; pick one."
- If user asks for a single non-English language → fine, set `locales: [<lang>]` and generate everything in that language. Default locale changes accordingly.
- Update the `luly` orchestrator skill (slot extraction table) to reflect this.

### 3.3 Fill directly in TipTap, drop the Markdown→TipTap conversion
Today: agent writes markdown body, `markdown-to-tiptap.ts` compiles to TipTap JSON at assemble time. Risk: agent uses markdown features the converter silently drops or rejects.
- Have `luly-fill` emit TipTap JSON directly for block bodies.
- Pre-requisite: a clear contract — what nodes/marks does Luly's TipTap schema support? Add that contract to `luly-fill/SKILL.md` as a fixed list. The agent generates only those nodes.
- Delete `markdown-to-tiptap.ts` once cut over. Counts toward 2.3 (reduce scripts).
- Trade-off: TipTap JSON is harder to write by hand than markdown. Mitigate with clear examples per common pattern.

---

## Open questions to resolve before starting each phase

- **1.2**: one file per section or one combined `content.md` with explicit boundaries?
- **1.3**: new dedicated stage, or absorbed into existing intake/plan?
- **1.3**: where does the tag taxonomy live? New file in `guidelines/`?
- **1.4**: are `card.png` and `icon.png` placeholders shipped with the plugin, or app-side only? Confirm bundled defaults exist at the listed paths.
- **1.5**: what's the exact "reliably identified" rule — minimum tokens required?
- **1.6**: validator auto-fixes (capitalization, periods) vs report-only?
- **3.1**: which new tokens are required vs optional — risk of breaking existing themes.
- **3.3**: worth doing after 3.1, or wait for the theme expansion to settle first?
