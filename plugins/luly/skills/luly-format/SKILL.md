---
name: luly-format
description: Step 3 of the Luly authoring pipeline. Read brief + product-type + plan, propose format defaults (story vs responsive, quizzes, media, layout, locales), confirm with the user, write format-profile.json. The single source of truth every stage-4 lesson agent reads to know what block formats it may emit. Use after /luly-plan and before any content-writing stages.
---

# Luly — Step 3: Format profile

This step locks in the global format decisions every stage-4 lesson agent
will share, so we don't re-ask the same questions per lesson. See
`docs/flow-json-schema.html` § Step 3 for context.

## Process

### 1. Load prior stages

Read:
- `tmp/luly-agent/brief.json`
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json`

If any is missing, stop and direct the user to the appropriate prior skill.

### 2. Propose defaults from preset

Read `product-type.json.preset` and pick the default row:

| Preset | screenMode | allowQuiz | quizDensity | allowMedia | allowLayout | allowForm |
|---|---|---|---|---|---|---|
| `academy` | `story` | `true` | `low` | `true` | `false` | `false` |
| `academy-course` | `story` | `true` | `low` | `true` | `false` | `false` |
| `campaign-course` | `story` | `true` | `low` | `true` | `false` | `true` |
| `campaign-simple` | `story` | `true` | `low` | `true` | `false` | `true` |
| `waitlist` | `story` | `false` | — | `true` | `false` | `true` |
| `interactive-proposal` | `story` | `false` | — | `true` | `false` | `true` |

Rationale per preset (matches what the real templates actually carry):
- Academy templates are pure learning — quizzes yes, forms no.
- `academy-course` is the same shape: a single course being added to an existing academy. No forms.
- Campaigns (basic / advanced) typically have a lead-capture form on the final screen — quizzes + forms.
- Waitlists and proposals are form-first — no quizzes, forms required.

`locales` always defaults to `["en"]`.

### 3. Show the proposal as a single block

Example:

> Proposed format profile:
> · screenMode = `story`
> · allowQuiz = `true` (density = `low` — about 1 per lesson)
> · allowMedia = `true` (image / image-richtext / video allowed)
> · allowLayout = `false` (story mode)
> · locales = `["en"]`
> Keep this, or change anything?

### 4. Handle overrides

- User wants responsive scroll → `screenMode = "responsive"`. They may also flip `allowLayout` to `true`.
- User wants no quizzes → `allowQuiz = false`. **Omit `quizDensity` entirely** — do not set it to null.
- User wants quizzes → `allowQuiz = true` and pick density (`low`, `medium`, `high`).
- User gives locales → confirm each matches `/^[a-z]{2}(-[A-Z]{2})?$/` (`en`, `en-US`, `ru`). Reject malformed ones with the user before writing.

### 5. Write the file

Write `tmp/luly-agent/format-profile.json` with exactly the agreed values:

```json
{
  "screenMode":  "story",
  "allowQuiz":   true,
  "quizDensity": "low",
  "allowMedia":  true,
  "allowLayout": false,
  "allowForm":   true,
  "locales":     ["en"]
}
```

When `allowQuiz` is `false`, **omit `quizDensity`** — the schema does not
allow it to coexist. `allowForm` is always present (true or false).

### 6. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-format-profile
```

The validator prints which block formats are unlocked for stage 4 — relay
that one-line summary back to the user.

If validation fails, fix the file and re-run.

### 7. Hand off

Tell the user:
- The profile is at `tmp/luly-agent/format-profile.json`.
- The block-format allowlist is derived from this — stage 4 reads it directly.
- Next stage is `/luly-fill-lesson` (when it ships).

## Hard rules

- Read-only on `brief.json`, `product-type.json`, `plan.parsed.json`.
- Write only to `tmp/luly-agent/format-profile.json`.
- Never include `quizDensity` when `allowQuiz` is `false`.
- Never set `allowLayout: true` when `screenMode: "story"`.
- Do not invent new fields. Schema is closed.
- Do not run any other skill in this conversation.
