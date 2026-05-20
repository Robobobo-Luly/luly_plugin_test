---
name: luly-fill-onboarding
description: Step 5a of the Luly authoring pipeline (runs AFTER theme + icon + lessons). For an academy (or any flow whose plan declares an "## Onboarding" section), generate the welcome / intro screens that live as siblings of the hub. Reads brief + plan + format-profile + theme and writes tmp/luly-agent/onboarding.json. Image captions reference real HEX from theme.json.
---

# Luly — Step 4a: Fill onboarding screens

Onboarding screens are the welcome / intro sequence shown BEFORE a user reaches the academy hub. They live as direct children of `flow`, siblings of the hub. Typically 1–3 screens; small enough to fill in one focused agent call.

This skill only writes content for the onboarding screens declared in `plan.parsed.json.onboarding`. If the plan has no onboarding section, this skill is not applicable — tell the user to add a `## Onboarding` section to `plan.md` and re-run `/luly-plan` first.

## Process

### 1. Load prior stages

Read:
- `tmp/luly-agent/brief.json` — for tone, audience, and `brand` if present
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json` — must have a non-empty `onboarding` array
- `tmp/luly-agent/format-profile.json`
- `tmp/luly-agent/theme.json` — **REQUIRED for caption HEX values**

If `plan.parsed.json.onboarding` is empty or missing, stop and tell the user to either (a) add a `## Onboarding` section to `plan.md` and re-run `/luly-plan`, or (b) skip this stage entirely.

If `theme.json` is missing, run `/luly-style` first.

### 2. Generate the screens

For every onboarding screen in `plan.parsed.json.onboarding`:
- Match the screen count exactly — no adding, no dropping.
- Pick the single best block format given the synopsis. For onboarding, `image-richtext` is the most common choice (a hero image + welcome copy). Use `richtext` if there's no natural image.
- Write `content` and `question` fields as **plain Markdown**. Same rules as `/luly-fill-lesson`.
- Image URLs: use the canonical project placeholder `/assets/placeholder-image.svg` (real, renders cleanly). For each image-bearing block, set `caption` to a one-sentence description of the illustration — it shows under the image in the CMS AND serves as the prompt for a future image-gen step.
- **Caption format** (same hard rule as `/luly-fill-lesson`):
  - `"<subject>, <style direction>, using palette <#HEX> primary, <#HEX> background"` (+ optional aspect ratio).
  - The HEX clause is **mandatory** — pull from `theme.json.colors` (`primary`, `background`, optionally `secondary` as accent). Theme always exists at this stage.

  > ⛔ **Banned color words in captions:** `purple`, `blue`, `green`, `red`, `orange`, `violet`, `navy`, `teal`, `pink`, `yellow`, `dark`/`light`/`warm`/`cool` (as color descriptors), `soft gradient`, `muted palette`, `brand colors` (when not followed by HEX). Use ONLY 6-char HEX strings (e.g. `#AB9FF2`) sourced from `theme.json.colors`.

  **Aspect ratio is optional** — append it only when you can reasonably match the layout (1:1 for square hero, 16:9 for wide hero, 9:16 for mobile full-bleed). Onboarding screens are typically square-ish hero blocks, so `1:1 aspect ratio` is a sensible default; skip the clause if unsure.

  Style direction is about *technique* (`"flat vector illustration"`, `"soft hand-drawn line art"`, `"playful cartoon style"`, `"minimal geometric composition"`) — not color. Keep style consistent across all onboarding screens.

Keep each screen short — onboarding shouldn't have walls of text. One headline + a sentence or two.

The block-format allowlist is the same as for lessons (derived from `format-profile.json`). Onboarding screens **rarely** use `quiz-text` or `form-text` — usually just `richtext` or `image-richtext`.

### 3. Write the file

Write `tmp/luly-agent/onboarding.json`:

```json
{
  "screens": [
    {
      "n": 1,
      "title": "Welcome",
      "blocks": [
        {
          "format": "image-richtext",
          "imageUrl": "/assets/placeholder-image.svg",
          "caption": "Friendly welcoming illustration of an academy entrance, warm pastel cartoon style, 1:1 aspect ratio",
          "imagePosition": "left",
          "content": "## Welcome\nLearn the essentials of self-custody in 3 short lessons."
        }
      ]
    }
  ]
}
```

Overwrite if present.

### 4. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-onboarding
```

The validator checks the artifact against the plan's declared onboarding screen count and against the format-profile's block-format allowlist.

### 5. Hand off

Tell the user:
- The file is at `tmp/luly-agent/onboarding.json`.
- Next stage is `/luly-controls` (run it again if you already ran it — it now picks up the onboarding paths) and then `/luly-validate`.

## Hard rules

- Read-only on all prior stage artifacts.
- Write only to `tmp/luly-agent/onboarding.json`.
- Screen count must exactly match `plan.parsed.json.onboarding.length`.
- Same field rules as `/luly-fill-lesson` — Markdown in content fields, no styles/controls leakage.
- Do not run any other skill in this conversation.
