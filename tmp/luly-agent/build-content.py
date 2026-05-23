#!/usr/bin/env python3
"""Build content.md by inlining each illustration SVG as a data: URI."""
import base64
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ILLOS = os.path.join(HERE, "illos")


def data_uri(filename: str) -> str:
    with open(os.path.join(ILLOS, filename), "rb") as f:
        raw = f.read()
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


illo = {
    "01": data_uri("01-boardwalk-pier.svg"),
    "02": data_uri("02-locked-liquidity.svg"),
    "03": data_uri("03-two-tracks.svg"),
    "04": data_uri("04-launch-timeline.svg"),
    "05": data_uri("05-bmx-vote.svg"),
    "06": data_uri("06-academy.svg"),
    "07": data_uri("07-megaphone.svg"),
    "08": data_uri("08-checklist.svg"),
}

content = f"""## Section 1 · Screen 1 — What Boardwalk Is, in One Minute
type: image-richtext
image: {illo['01']}
position: right
caption: "Minimalist boardwalk and sun mark, flat vector illustration, using palette #0E7C7B primary, #F7F2E9 background, 1:1 aspect ratio"

# Onchain Starts Here.

**Boardwalk** (useboardwalk.com) is a permissionless **launchpad protocol** for new token economies. Anyone can spin up a launch; the rules — fees, vesting, liquidity treatment — are written into the token *contract* before a single dollar goes in.

The platform serves four overlapping audiences:

- **Issuers** — teams or individuals launching a token / protocol
- **Traders** — looking for venues where the rules can't change mid-trade
- **Contributors** — early backers who want verifiable access terms
- **LPs & stakers** — provide liquidity, stake the BMX governance token, earn fee flow

The boardwalk metaphor is everywhere on the site: a public, walkable seafront where everything is visible and you can choose your own stop.

---

## Section 1 · Screen 2 — Three Built-In Protections
type: image-richtext
image: {illo['02']}
position: left
caption: "Padlock over a calm wave, flat line illustration, using palette #0E7C7B primary, #F7F2E9 background, 1:1 aspect ratio"

What makes Boardwalk structurally different from a generic launchpad is three guarantees baked into every launch:

1. **Locked liquidity at graduation.** When a launch hits its raise threshold, the raised asset is paired with the supply and the resulting LP is **permanently locked**. The rug-pull route is closed off at the contract level.
2. **Fees written into the token.** Fee percentages and recipients are encoded in the token contract itself, so they apply across *every* trading venue — not just inside Boardwalk's own UI.
3. **Anti-sniper fee ramp.** For the first ~90 minutes after a token goes live, fees start at ~40% and decay to the standard rate. Snipers get taxed; long-term holders don't.

> Add to those: a **7-day claim cliff** after graduation, and a **Café Boardwalk** forum auto-created for every launch — so community discussion is part of the launch surface, not bolted on.

---

## Section 1 · Screen 3 — Quick Check
type: quiz-text
text: "Pick the option that is **not** a Boardwalk-by-design protection:"
question: "Which of the following is *not* part of Boardwalk's structural guarantees?"
choices:
  - id: a
    text: "Liquidity is locked permanently at graduation"
  - id: b
    text: "Fees are written into the token contract"
  - id: c
    text: "An anti-sniper fee that ramps down over ~90 minutes"
  - id: d
    text: "Boardwalk manually approves which projects can launch"
correct: d

---

## Section 2 · Screen 1 — Two Launch Tracks: Express vs Advanced
type: image-richtext
image: {illo['03']}
position: right
caption: "Two side-by-side panels — a lightning bolt and a gear — flat geometric illustration, using palette #0E7C7B primary, #E97451 accent, #F7F2E9 background, 1:1 aspect ratio"

A Boardwalk issuer picks one of two tracks at the start:

**Express launch** — for memes, experiments, fast tests.
- 24-hour auction window
- Graduates at **10 ETH** raised
- A **single fee recipient**
- No supply vesting options

**Advanced launch** — for apps and serious protocols.
- 7-day auction window
- Up to **5 fee recipients** (treasury, team, ecosystem, etc.)
- Supply **vesting schedules** available
- Same locked-liquidity + on-contract-fee guarantees

The track choice is the single biggest knob an issuer turns — it sets the entire shape of the launch.

---

## Section 2 · Screen 2 — The Launch Timeline
type: image-richtext
image: {illo['04']}
position: left
caption: "Horizontal timeline arrow with four milestone dots, minimal flat illustration, using palette #0E7C7B primary, #E97451 accent, #F7F2E9 background, 1:1 aspect ratio"

Every launch follows the same four beats — what changes is the dial settings:

1. **Auction** — open subscription window (24h Express / 7d Advanced). Anyone can contribute.
2. **Graduation** — if the threshold is hit, the contract pairs the raised asset with token supply and locks the LP forever.
3. **7-day cliff** — token claims are time-locked, plus the anti-sniper fee is in force on early trades.
4. **Live trading** — the token is now tradeable everywhere; fees route per the on-contract config.

If a launch *doesn't* graduate, contributors get their funds back. The contract decides — no human override.

---

## Section 2 · Screen 3 — BMX Staking & Café Boardwalk
type: image-richtext
image: {illo['05']}
position: right
caption: "Ballot box with a circular B-token above it, flat minimal illustration, using palette #0E7C7B primary, #E97451 accent, #F7F2E9 background, 1:1 aspect ratio"

Two things tie the protocol together as a living system rather than a one-shot launchpad:

**BMX staking + Designated Fees.** A slice of platform fees is routed weekly via **winner-takes-all** governance vote. BMX stakers direct that bucket toward: buy-and-burn, more liquidity, treasury, or staker distributions. The token is **non-inflationary** — no emissions, just fee flow.

**Café Boardwalk.** Every launch gets a forum auto-spun-up at graduation, with a 30-day-rolling **upvote / downvote** system. It's the launch's public lobby: discussion, complaints, hype — all attached to the token profile.

Read together: the **token profile page** is the canonical surface — fees, vesting, audit history, forum, all in one place.

---

## Section 2 · Screen 4 — Quick Check
type: quiz-text
text: "A team wants to drop a **meme experiment** tonight — small, fast, single treasury wallet collects all fees. Which track fits?"
question: "Which Boardwalk track is the right call?"
choices:
  - id: a
    text: "Express — 24h auction, single fee recipient, 10 ETH grad"
  - id: b
    text: "Advanced — 7-day auction, up to 5 fee recipients, supply vesting"
  - id: c
    text: "Neither — meme launches aren't supported"
correct: a

---

## Section 3 · Screen 1 — Hook #1: Boardwalk Academy on Luly
type: image-richtext
image: {illo['06']}
position: left
caption: "Graduation cap with tassel, flat minimal illustration, using palette #0E7C7B primary, #E97451 accent, #F7F2E9 background, 1:1 aspect ratio"

Boardwalk already publishes **docs** and a **FAQ**, but neither is a *learning surface* — they're reference. That's a clean opening for Luly.

**The pitch:** a Boardwalk Academy with short, narrative courses for the three core personas — issuer, trader, contributor — each ~5–10 screens, with quizzes and progress tracking.

Anchor courses to propose:
- "How to launch on Boardwalk" (Express + Advanced walkthroughs)
- "Reading a Boardwalk token profile" (fees, vesting, audit)
- "BMX staking & Designated Fees, in 8 screens"

The win for Boardwalk: lower support load, higher first-launch success rate, a public artifact that demos the platform's transparency story without making the user read a docs site.

---

## Section 3 · Screen 2 — Hooks #2 & #3: Onboarding + Launch Campaigns
type: image-richtext
image: {illo['07']}
position: right
caption: "Megaphone with floating sparkles, flat minimal illustration, using palette #0E7C7B primary, #E97451 accent, #F7F2E9 background, 1:1 aspect ratio"

Two more product surfaces where Luly maps cleanly to Boardwalk's needs:

**Hook #2 — Per-launch onboarding flow.** First-time issuers are the weakest link in any launchpad's funnel. Luly can ship a short, story-mode onboarding (3–5 screens) that walks a brand-new issuer from "I have an idea" to "I'm staring at my graduation screen." Embed it in the Boardwalk dashboard at first-login.

**Hook #3 — Pre-graduation campaigns & waitlists.** High-profile launches need a marketing layer *before* the auction opens. Luly's `waitlist` and `campaign-simple` presets give Boardwalk-listed projects:
- Email capture for "first 50 contributors get …"
- A short "what this launch is" explainer landing
- Anti-sniper context delivered to the right people before the clock starts

Both are **off-protocol** — they don't change Boardwalk's contracts, they sit alongside.

---

## Section 3 · Screen 3 — Recap: Three Pitches to Open the Call
type: image-richtext
image: {illo['08']}
position: left
caption: "Three-item checklist with green ticks, flat minimal illustration, using palette #0E7C7B primary, #E97451 accent, #F7F2E9 background, 1:1 aspect ratio"

If we get a 30-minute slot with the Boardwalk team, open with these three — in order:

1. **Boardwalk Academy** — a Luly-hosted learning hub. Lower support load, higher first-launch success, a public asset that doubles as marketing for the protocol's transparency story.
2. **First-launch onboarding flow** — embedded in the Boardwalk dashboard. Targets the weakest part of every launchpad funnel: the brand-new issuer.
3. **Per-launch campaigns + waitlists** — sold either as a feature Boardwalk offers its listed projects, or as a direct Luly product for those projects, with Boardwalk getting referral / co-marketing credit.

> Closing line for the deck: *"Luly is the learning + marketing surface that turns Boardwalk's transparency into a story end users actually read."*
"""

out = os.path.join(HERE, "content.md")
with open(out, "w") as f:
    f.write(content)
print(f"wrote {out} ({len(content)} bytes)")
