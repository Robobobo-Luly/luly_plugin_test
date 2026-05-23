---
name: luly-intake
description: Stage 1 of the Luly authoring pipeline. Read the user's natural-language prompt, do brand research when a specific company is named, pick the preset, generate a key, and write a single intake.md capturing intent, audience, tone, brand, materials, and preset choice. Replaces the old brief + product-type + brand-research stages with one markdown artifact.
---

# Luly — Stage 1: Intake

You write a single markdown document that the rest of the pipeline reads as context. No JSON. No schema validator. Plain markdown a human can edit. Inline self-checks for the few things that genuinely matter (HEX format, preset enum, key shape).

## Process

### 1. Read the user's prompt

The orchestrator passes you the user's one-line request. Pull any URLs they attached for context using `WebFetch` if a quick read would help disambiguate intent or topic.

### 2. Brand research (when applicable)

**Trigger:** the prompt names a specific company by brand (e.g. "Phantom academy", "Wallet onboarding", "Base campaign"). Skip entirely for generic / non-branded products.

When triggered, **before writing the file**, use `WebFetch` (or `WebSearch` if no URL was given) to extract from the company's actual sources:

- **Colors as HEX** — find them in CSS variables on the site (`--color-primary`), Tailwind config, brand-book PDFs, or design-system pages. **Never invent hex codes.** If you can't find a value, omit the key.
- **Logo URL** — absolute URL to the canonical logo (prefer SVG, transparent background).
- **Fonts** — what they use (from CSS, brand book).
- **Voice** — one sentence summarizing how they speak.

Trust user-supplied material over what you scrape. If brand research yields nothing usable, set only the company name and proceed.

### 3. Pick the preset

| Preset | When to pick |
|---|---|
| `academy` | "academy", "school", "learning hub", "training program" |
| `academy-course` | "add a course to (the) academy", "extend the X academy" |
| `campaign-course` | **explicit** "multi-step", "drip", "nurture sequence", "X-lesson series", "weekly campaign" |
| `campaign-simple` | default for "marketing campaign", "promo", "launch", "landing", "ad campaign", "lead-gen" |
| `waitlist` | "waitlist", "early access", "email signup", "lead capture" |
| `interactive-proposal` | "sales proposal", "pitch deck", "demo for client X" |

**Single-section rule:** if the user's request would naturally fit in 1 section of screens, the preset MUST be `campaign-simple`, `waitlist`, `interactive-proposal`, or `academy-course`. Never `campaign-course` for a single section — that's structurally a basic campaign, not advanced.

**Topic-noun trap:** "campaign for my X courses" — the word "courses" is the subject, not a structural cue. Use `campaign-simple` unless multi-step structure is explicit.

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
Website: <url, optional>
Docs: <url, optional>
Colors:
- primary: #HEX
- background: #HEX
- secondary: #HEX     (optional)
- accent: #HEX        (optional)
- text: #HEX          (optional)
Logo: <absolute url, optional>
Fonts: ["Inter"]      (optional)
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
