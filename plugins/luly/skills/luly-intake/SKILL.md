---
name: luly-intake
description: Stage 1 of the Luly authoring pipeline. Read the user's natural-language prompt, do brand research when a specific company is named, pick the preset, generate a key, and write a single intake.md capturing intent, audience, tone, brand, materials, and preset choice. Replaces the old brief + product-type + brand-research stages with one markdown artifact.
---

# Luly — Stage 1: Intake

You write a single markdown document that the rest of the pipeline reads as context. Inline self-checks for the few things that genuinely matter (HEX format, preset enum, key shape).

**Before you write anything user-facing**, read `${CLAUDE_PLUGIN_ROOT}/guidelines/writing-guidelines.md` and apply it (sentence-case titles, American English, no emojis, no rhetorical questions, etc.).

## Process

### 1. Read the user's prompt

The orchestrator passes you the user's one-line request. Pull any URLs they attached for context if a quick read would help disambiguate intent or topic.

### 2. Brand research (when applicable)

**Trigger:** the prompt names a specific company by brand (e.g. "Phantom academy", "Wallet onboarding", "Base campaign"). Skip entirely for generic / non-branded products.

When triggered, **before writing the file**, extract these from the brand's actual sources:

- **Colors as HEX** — canvas/background, primary CTA, secondary, accent, text. **Never invent hex codes.**
- **Logo** — find and save the canonical brand mark. See "Logo discovery" below.
- **Fonts** — heading and body font-family from CSS or brand book.
- **Border radius** — typical button / container radius (px) from CSS rules on `button`, `.btn`, or design-system primitives.
- **Voice** — one sentence on how they speak.

#### The job is *visual fidelity*, not scrape compliance

The site's HTML and CSS are usually the right starting point, but **every site is structured differently** — there's no single "always do X first" recipe. What matters is ending up with **reasonable assurance that the tokens you write actually represent how the brand's site looks to a human visitor**. Don't ship colors you can't defend.

Useful signals to combine:
- `<meta name="theme-color">` and `<meta name="background_color">` in the HTML head — explicit declared canvas
- PWA manifest (`<link rel="manifest">`) → `theme_color` / `background_color`
- CSS rule on `html` / `body` background — the visible canvas under the content
- Design-system CSS variables (`--background`, `--primary`, etc. when present)
- Most-frequent background-color hex across the bundle (only a hint — many of those are dark-mode-variant or modal-specific)
- Apple-touch-icon, link rel=icon SVG, og:image — often expose the brand color
- Brand book / press kit / brand assets page when one is published
- A screenshot of the homepage (last resort — visual reality is the tiebreaker)

If two signals disagree (e.g. `theme-color` says light but a CSS rule says dark), **reconcile**. Don't just pick one. The fix is one of: (a) pull more signals until a clear picture emerges, (b) take a screenshot and let visual reality decide, (c) ask the user.

Don't give up after one failed fetch. If one path is blocked (Cloudflare 403, captcha), try a real-browser User-Agent, a different subdomain, the press/brand page, or a brand-asset aggregator.

#### Logo discovery

The logo is its own search — don't conflate it with color extraction. Brands publish multiple variants; recognise them and save them to the right slot.

**The three variants you might find:**

| Variant | What it looks like | Where the assembler uses it |
|---|---|---|
| **Lockup** (preferred) | Icon + wordmark, usually horizontal | Header logo (`headerLogo` / `headerLogoSvg`) and academy hub logo (`hub.body.hubLogo`) |
| **Wordmark** | Brand text only, no symbol | Header logo / hub logo fallback when no lockup exists |
| **Icon-only** | Just the symbol (no text) | Course icon (`course.body.iconSvg` / `iconUrl`) — only the icon, never the lockup, fits a 1:1 256×256 frame |

When a brand offers multiple variants, prefer the lockup for header and hub logo (instant brand recognition), and the icon-only for the course icon (a wordmark squashed into a 1:1 frame is unreadable).

**Where to look:**
- Press / brand-assets / brand-resources page — usually the cleanest source, often offers all three variants explicitly labeled.
- `<header>` / nav `<svg>` or `<img>` on the live site — the lockup as actually used.
- `<link rel="icon" ... href="...svg">` — usually the icon-only mark, transparent background, ideal for the course icon slot.
- `<link rel="apple-touch-icon" ...>` — square PNG, also icon-only candidate.
- `<meta property="og:image" ...>` — marketing banner, rarely a clean logo.

**Save to the workdir:**

| File | What goes here |
|---|---|
| `<workdir>/logo.svg` | The lockup (or wordmark fallback). Assembler inlines into the header AND uses for hub logo when intake says `hub-logo: brand-logo`. |
| `<workdir>/brand-icon.svg` | Icon-only variant — used for the course icon slot when intake supplies it. Optional; if absent, the style stage generates a course-icon.svg. |

Sanity checks before saving any file:
- It renders as the brand mark (open and look at it, don't just trust the filename).
- No external `<image href>` or `<script>` tags inside.
- File size < 20 KB (larger usually means it's an illustration, not a logo).
- For `logo.svg`: includes the wordmark when one exists — the header renders at ~32px desktop / 24px mobile so a lockup stays legible.
- For `brand-icon.svg`: NO wordmark — must render readably at 256×256 with no text.

If you only have URLs (no SVG available), record them in the `Logo:` block instead — the assembler uses URLs as fallback.

If no variant is available at decent quality, **don't save anything**. Header falls back to the Luly mark; course icon falls back to the generated SVG. Both are preferable to a wrong / blurry brand impression.

#### Plausibility check before committing

Before writing the `Colors:` block, do a sanity pass:

- Does the **declared brand canvas** match the dominant impression of the homepage screenshot or main-page rule? A widely-known brand suddenly looking opposite (e.g. all black for a brand whose marketing site is bright cream) is a red flag.
- Does the **primary** appear in the brand's own buttons, links, or accents — not just in a footer or one component?
- Are the colors mutually consistent (good contrast, readable, look intentional together)?

If anything fails the sanity pass, treat the extraction as unreliable and ask the user (see below).

Trust user-supplied material over what you scrape.

#### What counts as "reliably identified"

Reliable means **you can defend it with at least two converging signals AND it passes the plausibility check**. Examples:
- `theme-color` meta + body background rule + matching og:image canvas → reliable.
- One CSS-bundle background hex + nothing else → unreliable.
- A logo URL alone, a single color, or a guess from the company name → unreliable.

When in doubt, treat as unreliable.

#### When brand research fails or is unreliable — ask the user

If the prompt named a brand but you could not reliably identify the colors, **pause and ask the user before writing intake.md**. Use the `AskUserQuestion` tool with these three options:

1. **Proceed with default Luly styling** — neutral palette, no brand color claims. Intake ships without a `Colors:` block; stage 3 uses the default Luly palette.
2. **Try a topic-themed palette** — generate a palette inspired by the *topic / category* (not the brand name), preview the HEX values, user confirms. Write those into the `Colors:` block as an explicit topic palette (not as brand colors).
3. **Provide extra materials** — the user pastes a brand-book URL, a screenshot, exact HEX codes, or any reference. Then re-run extraction.

Include in the third option a brief note on how the user can gather these themselves: open the site in a browser → inspect a primary button → copy its `background-color`; check the company's press / brand assets page; look for `<meta name="theme-color">` in page source; or screenshot the homepage.

Whichever option the user picks, record it in the intake.md `Brand` section under a `Brand research result:` line — one of `verified`, `topic-themed`, `default-luly`, or `user-supplied` — so downstream stages can act deterministically.

If the prompt did NOT name a brand (generic / non-branded), skip this entirely and proceed without colors.

### 3. Pick the preset

| Preset | When to pick                                                                              |
|---|-------------------------------------------------------------------------------------------|
| `academy` | "academy", "school", "learning hub", "training program"                                   |
| `academy-course` | "create a course", "multi step"                                                           |
| `campaign-course` | same as acedemy course but if forms / rewards / user feedback is implied                  |
| `campaign-simple` | default for "marketing campaign", "promo", "launch", "landing", "ad campaign", "lead-gen" |
| `waitlist` | "waitlist", "early access", "email signup", "lead capture"                                |
| `interactive-proposal` | "sales proposal", "pitch deck", "demo for client X"                                       |

**Single-section → never `academy course or campaign-course`.** If the plan would emit 1 section, the preset must be `campaign-simple` / `waitlist` / `interactive-proposal`.

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
Brand research result: <verified | topic-themed | default-luly | user-supplied>
Website: <url, optional>
Docs: <url, optional>
Colors:
- primary: #HEX
- background: #HEX
  surface: #HEX (optional)
- secondary: #HEX     (optional)
- accent: #HEX        (optional)
- text: #HEX          (optional)
Logo (lockup, preferred — saved to `<workdir>/logo.svg` when SVG, else URL here): <absolute url or "saved as logo.svg">
LogoIcon (icon-only variant for course-icon slot — saved to `<workdir>/brand-icon.svg` when SVG, else URL here): <absolute url, "saved as brand-icon.svg", or omit if none>
LogoWordmark (text-only variant, optional fallback): <absolute url, or omit>

Fonts for Header and paragraph: Header - "Inter", paragraph - Inter Tight (optional)
ButtonBorderRadius: <e.g. 8px, 12px, 999px — extracted from brand CSS; omit if not found> (optional)
ContainerBorderRadius: <e.g. 12px, 16px — for cards/panels; omit if not found> (optional)
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
