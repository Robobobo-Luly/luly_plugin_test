---
name: luly-fill-onboarding
description: Step 4a of the Luly authoring pipeline. For an academy (or any flow whose plan declares an "## Onboarding" section), generate the welcome / intro screens that live as siblings of the hub. Reads brief + plan + format-profile and writes tmp/luly-agent/onboarding.json. Run once after /luly-fill-lesson has filled the regular lessons.
---

# Luly — Step 4a: Fill onboarding screens

Onboarding screens are the welcome / intro sequence shown BEFORE a user reaches the academy hub. They live as direct children of `flow`, siblings of the hub. Typically 1–3 screens; small enough to fill in one focused agent call.

This skill only writes content for the onboarding screens declared in `plan.parsed.json.onboarding`. If the plan has no onboarding section, this skill is not applicable — tell the user to add a `## Onboarding` section to `plan.md` and re-run `/luly-plan` first.

## Process

### 1. Load prior stages

Read:
- `tmp/luly-agent/brief.json`
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json` — must have a non-empty `onboarding` array
- `tmp/luly-agent/format-profile.json`

If `plan.parsed.json.onboarding` is empty or missing, stop and tell the user to either (a) add a `## Onboarding` section to `plan.md` and re-run `/luly-plan`, or (b) skip this stage entirely.

### 2. Generate the screens

For every onboarding screen in `plan.parsed.json.onboarding`:
- Match the screen count exactly — no adding, no dropping.
- Pick the single best block format given the synopsis. For onboarding, `image-richtext` is the most common choice (a hero image + welcome copy). Use `richtext` if there's no natural image.
- Write `content` and `question` fields as **plain Markdown**. Same rules as `/luly-fill-lesson`.
- Image URLs: use the canonical project placeholder `/assets/placeholder-image.svg` (real, renders cleanly). For each image-bearing block, set `caption` to a one-sentence description of the illustration — it shows under the image in the CMS AND serves as the prompt for a future image-gen step.
- **Caption format** (same as `/luly-fill-lesson`):
  - With brand: `"<subject>, <style direction derived from brand voice>, using brand palette <#HEX primary>, <#HEX secondary> on <#HEX background>, 1:1 aspect ratio"`.
  - Without brand: `"<subject>, <style direction from brief tone>, 1:1 aspect ratio"`.

  When `brief.brand.colors` is present, **append literal HEX values** (e.g. `#AB9FF2`) to anchor the image-gen output to the real brand palette. Style direction examples: `"warm pastel cartoon style"` for friendly briefs, `"dark vector with neon accents"` for crypto / tech briefs, `"minimal flat illustration, muted palette"` for corporate briefs. Keep style consistent across all onboarding screens.

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
