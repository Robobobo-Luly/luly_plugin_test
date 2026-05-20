# Luly plugin for Claude Code

Author Luly flows — academies, courses, marketing campaigns, waitlists,
interactive proposals — end-to-end from a single natural-language prompt.
Output is a single importable `<key>.luly.json` file ready for the Luly CMS.

## Install

Requires Claude Code. Node 20+ is bundled with Claude Code's installer, so no
separate Node install is needed.

```text
/plugin install <git-url-of-this-repo>
```

After the first invocation, the plugin installs its own runtime dependencies
into `${CLAUDE_PLUGIN_ROOT}/node_modules` automatically (one-time, ~10s).

## Usage

In any project directory, inside Claude Code:

```text
/luly create a blockchain academy with first course being what is blockchain
```

The plugin runs the 10-stage pipeline. Intermediate artifacts land in
`tmp/luly-agent/` in your current project. The final importable JSON appears at
`tmp/luly-agent/<key>.luly.json`. Import it into the Luly CMS via the existing
Import flow.

### What it supports

Six product presets, picked automatically from your prompt:

- **Academy** — a hub with one or more courses.
- **Course (added to existing academy)** — a course-only JSON imported under an
  existing academy.
- **Basic campaign** — single-funnel marketing flow.
- **Advanced campaign** — multi-lesson drip / nurture sequence.
- **Waitlist** — email capture, social proof, share.
- **Interactive proposal** — personalised pitch / demo flow.

### Stage-by-stage access

The `/luly` command runs everything. If you want to drive stages manually:

- `/luly-brief` — capture the request.
- `/luly-product-type` — pick the preset.
- `/luly-plan` — outline lessons and screens.
- `/luly-format` — pick block formats, locales, media policy.
- `/luly-fill-lesson` — write each lesson's screens.
- `/luly-fill-onboarding` — academy welcome screens.
- `/luly-style` — generate the 18-token color palette and fonts.
- `/luly-overrides` — optional per-screen style overrides.
- `/luly-controls` — apply navigation controls (deterministic).
- `/luly-validate` — assemble + validate the final JSON.
- `/luly-review-content` / `/luly-review-style` — optional QA reviewers.

## Troubleshooting

- **`ts-node: command not found`** — the first-run `npm install` failed. Run it
  manually: `cd "$(claude plugin path luly)" && npm install`.
- **`Cannot find module 'lexorank'` etc.** — same root cause; re-run the
  install above.
- **Validation errors** — surface the message to the agent; it will fix the
  upstream artifact and re-validate.

## Maintainer notes

- Skills shell out via `${CLAUDE_PLUGIN_ROOT}/bin/luly <subcommand>` rather
  than `npm run`. The bin wrapper preserves `$PWD` so script `process.cwd()`
  picks up the user's project directory.
- All TS scripts live in `scripts/`. Adding a new validator: drop a new
  `<name>.ts` there, then reference it from a skill as
  `${CLAUDE_PLUGIN_ROOT}/bin/luly <name>`.
- This directory is self-contained; move it to its own repo whenever you want
  to split distribution from the main app.
