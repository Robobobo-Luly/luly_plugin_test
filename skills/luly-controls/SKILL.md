---
name: luly-controls
description: Step 7 of the Luly authoring pipeline. Apply standard navigation controls to the tree (Back, Next, finishLesson, hub click-through). Fully analytical — no LLM in the loop. Just runs the apply tool which reads prior artifacts, computes per-path controls from the preset library, writes controls.json, and validates. Use after lessons are filled and theme is picked; before validate-assemble.
---

# Luly — Step 7: Standard controls (analytical)

This stage has **no creative work**. It runs a deterministic generator that
applies the canonical navigation control set from the product preset.

The control shapes are the highest failure-rate surface when generated
freely (wrong guard names, missing fallback clauses, invalid targets), so
we don't ask an LLM to write them — the preset library in
`scripts/luly-agent/controls-presets.ts` is the single source of truth.

## Process

### 1. Confirm prior stages are present

Check these files exist:
- `tmp/luly-agent/brief.json`
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json`
- `tmp/luly-agent/format-profile.json`
- `tmp/luly-agent/theme.json`
- at least one `tmp/luly-agent/lesson-*.json`

If any is missing, stop and direct the user to the appropriate prior skill.

### 2. Run the apply tool

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly apply-controls
```

The tool reads `product-type.json` + `plan.parsed.json` + lesson files,
computes the per-path controls map from the preset library, writes
`tmp/luly-agent/controls.json`, then **immediately validates it**. If
validation fails the tool exits 1 — never trust a controls.json that
wasn't written through this path.

### 3. Report

Relay the tool's summary back to the user:
- Which preset was applied
- How many paths got controls
- Total control count

### 4. Hand off

Tell the user:
- `controls.json` is at `tmp/luly-agent/controls.json`
- They can hand-edit it before stage 9 if needed, then re-run `${CLAUDE_PLUGIN_ROOT}/bin/luly validate-controls` to re-check
- Next stage is `/luly-validate` (when it ships)

## What the artifact looks like

Path-keyed map, e.g. for an academy preset:

```json
{
  "preset": "academy",
  "controls": {
    "hub":                [ {...hub click-through...} ],
    "course":             [ {...Back...}, {...Learn...} ],
    "lesson-1":           [ {...auto-route...} ],
    "lesson-1.screen-1":  [ {...header-back...}, {...Previous...}, {...Next...} ]
  }
}
```

Each control uses **semantic placeholder ids** like `ctrl.screen.prev` —
stage 9 replaces those with fresh UUIDs at assemble time.

## Hard rules

- **Do not generate controls in the conversation.** Always call the apply tool.
- Do not hand-edit `controls.json` from within this skill. If the user wants edits, they can do them after the skill exits and re-validate manually.
- Do not run any other skill in this conversation.
