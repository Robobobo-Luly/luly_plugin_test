---
name: luly-overrides
description: Optional Step 6 of the Luly authoring pipeline. Captures per-screen / per-block style overrides — backgrounds, sticky controls, responsive layout tweaks. Run only when the user explicitly asks for a deviation from the workspace theme picked in step 5 (e.g. "make the welcome screen a dark gradient", "vary the background per lesson"). Most flows ship without ever running this. Stage 9 picks up the overrides.json file if present, skips this layer if not.
---

# Luly — Step 6: Per-screen / per-block overrides (opt-in)

This is the escape hatch from the workspace theme. **Default to NOT running it.** Only emit overrides when the user has explicitly asked for a specific deviation from the step 5 theme.

## When to run

- The user invoked `/luly-overrides`, OR
- During any other conversation the user said something like:
  - "make the first screen full-bleed dark"
  - "vary the background per lesson"
  - "stick the bottom controls on screen 3"
  - "give the quiz screens a different background"

If you're not sure whether the user wants per-screen variation, ask. The default is to do nothing — brand consistency wins.

## Process

### 1. Load prior stages

Read:
- `tmp/luly-agent/brief.json`
- `tmp/luly-agent/product-type.json`
- `tmp/luly-agent/plan.parsed.json`
- `tmp/luly-agent/format-profile.json`
- `tmp/luly-agent/theme.json` — required (step 6 builds on step 5)
- all `tmp/luly-agent/lesson-*.json` you'll reference

Stop if any required earlier artifact is missing.

### 2. Capture the requested overrides

For each override the user has asked for, ask just enough to disambiguate:
- Which screens (one specific, all screens in a lesson, all quiz screens, …)?
- What change (background color/gradient, sticky bottom controls, button stretched, …)?

Map each target to its path:
- Screen path: `lesson-<n>.screen-<m>` (both ≥ 1)
- Block path: `lesson-<n>.screen-<m>.block-<k>` (k is **0-indexed** to match `lesson-<n>.json.screens[m-1].blocks[k]`)

### 3. Build the overrides object

Emit only the keys that genuinely differ. Common shapes:

**Screen background (gradient):**
```json
"screens": {
  "lesson-1.screen-1": {
    "style": {
      "container": {
        "background": {
          "type": "gradient",
          "color": "#0142E5",
          "gradient": {
            "angle": 0,
            "stops": [
              { "color": "#0142E5", "position": 0 },
              { "color": "#010101", "position": 81 }
            ]
          }
        }
      }
    }
  }
}
```

**Screen controlStyle (sticky bottom controls, responsive layout):**
```json
"controlStyle": {
  "bottomStyle": {
    "backgroundColor": { "mobile": "transparent", "desktop": "transparent" },
    "buttonStretched":  { "mobile": true,         "desktop": false }
  }
}
```

**Block background:**
```json
"blocks": {
  "lesson-2.screen-3.block-0": {
    "style": { "container": { "background": { "type": "solid", "color": "#FFF8F0" } } }
  }
}
```

### 4. Write the file

Write `tmp/luly-agent/overrides.json`. Overwrite if present.

If the user revoked every override during the conversation, **delete the file** rather than writing an empty object.

### 5. Validate

Run:

```
${CLAUDE_PLUGIN_ROOT}/bin/luly validate-overrides
```

The validator prints the count of screen / block overrides and lists their paths. It also checks each path actually exists in the lesson files — typos like `lesson-2.screen-9` when lesson 2 only has 3 screens fail loudly.

If validation fails, fix the file and re-run.

### 6. Hand off

Tell the user:
- The overrides file is at `tmp/luly-agent/overrides.json`.
- Stage 9 will apply these during assemble.
- The workspace theme from step 5 still applies to every screen except where overridden.

## Hard rules

- Read-only on prior stage artifacts.
- Write only to `tmp/luly-agent/overrides.json` (or delete it if the user revoked everything).
- Path syntax exactly: `lesson-N.screen-M` for screens, `lesson-N.screen-M.block-K` for blocks. Block index is **0-based**.
- Every referenced path MUST exist in the lesson files — no inventing paths.
- Only `style` and `controlStyle` keys for screens. Only `style` for blocks. `controlStyle` on a block fails validation.
- Do NOT put `control.style.*` overrides here — those are step 7 territory.
- Never auto-suggest overrides. Only emit what the user asked for.
- Do not run any other skill in this conversation.
