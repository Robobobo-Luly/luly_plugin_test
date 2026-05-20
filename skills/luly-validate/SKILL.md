---
name: luly-validate
description: Step 9 (final, mandatory) of the Luly authoring pipeline. Assembles all prior artifacts into a single canonical <flow-key>.luly.json ready to import into the CMS. Compiles stage-4 Markdown into TipTap, resolves the theme, applies controls and optional overrides, stamps slugs and lexoRank, and validates the result atomically. Fully analytical — no LLM in the loop. Run after everything else; this produces the deliverable.
---

# Luly — Step 9: Validate & assemble

This is the **final stage**. It runs the deterministic assembler that
produces the file you import into the CMS. No creative work here — every
input artifact feeds in, one canonical JSON file comes out.

## Process

### 1. Confirm prior stages are present

Required artifacts in `tmp/luly-agent/`:
- `brief.json`
- `product-type.json`
- `plan.parsed.json`
- `format-profile.json`
- `theme.json`
- `controls.json`
- `lesson-<n>.json` for every lesson the plan declares
- `onboarding.json` **iff** `plan.parsed.json.onboarding.length > 0` (typically academy preset)

Optional:
- `overrides.json` (step 6) — applied if present, skipped silently if not.

If any required artifact is missing, stop and direct the user to the appropriate prior skill.

### 2. Run the assembler

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly assemble
```

The assembler:
1. Reads all required artifacts.
2. Verifies every lesson in the plan has a corresponding `lesson-<n>.json`.
3. Builds the tree (`flow → hub → course → lesson → screen → block`).
4. Compiles every Markdown `content` / `question` field into stringified TipTap JSON.
5. Resolves theme (`resolveTheme(preset, overrides)`) into `flow.body.theme`.
6. Walks `controls.json` and embeds controls on the matching tree nodes (replacing semantic placeholder ids like `ctrl.screen.prev` with fresh UUIDs).
7. Walks `overrides.json` (if present) and merges per-screen / per-block overrides.
8. Stamps fresh UUIDs as `slug` on every node, plus `lexoRank` from the `lexorank` library with coarse spacing per sibling group.
9. Writes `tmp/luly-agent/<flow-key>.luly.json`.
10. **Invokes the validator inline** — if validation fails, the assembler exits 1 with the validator's message.

### 3. Report

Relay the assembler's summary back to the user. Key fields:
- File path
- Theme preset + key
- Node counts (lessons / screens / blocks)
- Whether overrides were applied
- Locales declared

### 4. Hand off

Tell the user:
- The flow is at `tmp/luly-agent/<flow-key>.luly.json`.
- Open the CMS, click **Import**, select that file — the workspace lands as a draft.
- They can re-run `/luly-validate` any time after editing any prior artifact (idempotent — always rebuilds from the artifacts).

## What the output looks like

Top-level shape (matches `Basic_Campaign_Template.json`):

```json
{
  "type": "flow",
  "title": "<course title from plan>",
  "description": "<optional intro line from plan>",
  "slug": "<uuid>",
  "body": {
    "product": "academy",
    "flowType": "academy",
    "productType": "academy",
    "key": "<product-key>",
    "theme": { "colors": {…}, "style": {…}, "layout": {…} },
    "locales": { "supported": ["en"], "default": "en" }
  },
  "controls": [],
  "lexoRank": "…",
  "children": [
    { "type": "hub", … "children": [
      { "type": "course", … "children": [
        { "type": "lesson", … "children": [
          { "type": "screen", … "blocks": [ { "type": "block", "body": {…}, … } ] }
        ]}
      ]}
    ]}
  ]
}
```

## Hard rules

- Always call the assembler; never hand-write or hand-edit the output JSON. If something looks wrong, edit the upstream artifact and re-run.
- Do not run any other skill in this conversation.
- If `${CLAUDE_PLUGIN_ROOT}/bin/luly assemble` exits non-zero, surface the message verbatim to the user — do not try to interpret or paper over it.
