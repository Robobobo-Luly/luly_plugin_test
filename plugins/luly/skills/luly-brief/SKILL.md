---
name: luly-brief
description: Step 0 of the Luly authoring pipeline. Interview the user about a new Luly course / campaign and capture brief.json that every later stage consumes verbatim. Run this first; all subsequent stages read its output. Use when the user says they want to create, draft, or plan a new Luly flow, course, campaign, academy, lesson, or marketing campaign and no brief.json exists yet.
---

# Luly — Step 0: Brief capture

You are running Step 0 of the Luly authoring pipeline (full playbook at
`docs/flow-json-schema.html` § Step 0).

Your only job in this conversation: ask the user 4 short questions, write
`tmp/luly-agent/brief.json`, validate it. Do not progress to any later stage —
stages 1–9 each have their own skill.

## Process

### 1. Ask the four questions

Ask in order. Accept the user's existing answers if they already covered any of
these in their opening message — don't ask again.

1. **Intent** — one sentence, what is this course / campaign for?
2. **Audience** — beginners / pros / mixed; mobile-first or desktop too?
3. **Tone** — short phrase (e.g. "friendly, concrete, no jargon"). If the user
   is vague, propose a sensible default based on audience and confirm.
4. **Materials** — optional URLs or files to draw from. Skip if none.

### 2. Infer lengthHint without asking

Infer `lengthHint` from the intent:

| Signal | Choose |
|---|---|
| "quick", "single", "landing", "one-pager" | `quick` |
| Default if unclear | `standard` |
| "deep dive", "full academy", "complete course", "8+ lessons" | `long` |

Only ask the user if the intent is genuinely ambiguous.

### 3. Write the file

Write `tmp/luly-agent/brief.json` with exactly these fields and types, no extras:

```json
{
  "intent":     "string, non-empty",
  "audience":   "string, non-empty",
  "tone":       "string, non-empty",
  "lengthHint": "quick | standard | long",
  "materials":  ["string", "..."]
}
```

If `tmp/luly-agent/` does not exist yet, create it. Overwrite any existing
`brief.json` without prompting.

### 4. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-brief
```

Report the result to the user in one line. If validation fails, fix the file
and re-run. Do not move on.

### 5. Hand off

End the conversation by telling the user:

- The brief is at `tmp/luly-agent/brief.json`.
- Next stage is `/luly-product-type` (once it ships) — or for now, manual review
  and re-run.

## Hard rules

- Do not write to any path other than `tmp/luly-agent/brief.json`.
- Do not modify code in `src/`, `tests/`, or the CMS data.
- Do not invent fields. The schema is closed; unknown keys fail validation.
- Do not run any other skill in the same conversation.
