# Marketing strategy

_v1.3 (2026-11-02). First written 2026-10-22; rewritten or amended every week;
the "What changed" section at the bottom is the changelog._

Alex's direction (2026-10-22): organic first (web-game portals, communities, short
gameplay clips, launch posts); then a small paid test, about $100/month, once measurement
works and a channel shows promise. Alex places every post and ad himself from the
Marketer's drafts until an ad account is connected. Analytics: Vercel Web Analytics only.

## Positioning

**One-line pitch:** *House of the Dead on a rollercoaster — a free browser rail shooter.
Ride, aim, blast. Two minutes a run, no install, works on your phone.*

What makes it worth a click, in the order we lead with it:

1. **Instant.** A link is the whole install. Title → riding → first kill in under 15 s.
2. **The ride is the hook.** Nobody else's browser shooter puts you on a coaster through
   five themed worlds (Theme Park, Desert, Ocean, Antarctica, Inferno). The clip sells
   itself: speed, drops, a Ferris wheel passing overhead, balloons popping.
3. **Arcade scoring.** 60–120 s runs, combo tiers to ×5 FRENZY, stars, weapon pickups, a
   boss finale (the Golden Blimp, the Kraken), a Daily Run everyone plays with the same seed,
   "one more run".
4. **Made with three.js, zero asset files.** Everything on screen is procedural (geometry,
   shaders, synthesised music and SFX). That is the story for the web-dev crowd, which is the
   cheapest audience to reach and the most likely to share.

Public name: **ShooterCoaster**. Home: **https://scoaster.com**
(https://shooter-coaster.vercel.app keeps working). Posts are from Alex as the developer.

## Target players

| Segment | Who | Where they are | What they want to hear |
|---|---|---|---|
| **A. Browser-game casuals** | 13–35, play 5-minute games on a laptop at school/work or on a phone in a queue; mobile-heavy | CrazyGames, Poki, itch.io, Newgrounds, Y8; r/WebGames | "Free, loads instantly, plays with one thumb, has a timer and a high score." |
| **B. Web devs / three.js people** | Front-end devs, creative coders, R3F users | three.js forum Showcase, r/threejs, X/Bluesky `#threejs`, Hacker News, the r3f Discord | "All procedural, no assets, ~500 KB gz, open source; here's how the track/terrain/shaders work." |
| **C. Rail-shooter nostalgics** | 25–45, Time Crisis / House of the Dead / Star Fox fans | r/IndieGaming, r/playmygame, r/retrogaming, YouTube | "A light-gun arcade feeling in a tab, no quarters needed." |

Segment B is first: cheapest to reach, overlaps with Alex's own network, and gives
honest technical feedback. Segment A is the volume: the portals bring players at a scale
no post does. Segment C comes with the arcade loop (M2: leaderboards, daily run).

## Channels, ranked by expected value

| # | Channel | Segment | Why this rank | Cost | Stage |
|---|---|---|---|---|---|
| 1 | **Web-game portals** — CrazyGames (Basic Launch), itch.io, Newgrounds | A | The only channels with standing traffic for browser games. CrazyGames' Basic Launch is a 7–21 day trial on their site that ends at 500 plays; itch and Newgrounds host a zip with `index.html` at the root. All need an **embeddable build** (relative paths, no external requests, pause on tab hide) — **shipped 31 Oct (#251, `npm run build:portal` → `dist-portal.zip`, smoked under a nested path in CI)**; the zip still has to be kept as a CI artifact so Alex can download it without a local build (#307). Poki is excluded for now: it wants a web-exclusive deal (default 5 years) and its SDK/ads, which would conflict with scoaster.com being the home. | Alex uploads | 2 |
| 2 | **three.js forum Showcase + r/threejs + `#threejs` on X/Bluesky** | B | Exactly our audience, free, moderated (so no spam), and Showcase posts "will be considered for the three.js homepage". A good post here is also the seed for the Show HN later. | 1 post + a GIF | 1 |
| 3 | **r/WebGames** and **r/playmygame** | A, C | Players who want a browser game *now*. r/playmygame rules are quoted below; r/WebGames rules could not be read from the agent sandbox (Reddit is blocked) — Alex checks the sidebar before posting. One post per sub per month. | 2 posts | 1 |
| 4 | **Show HN** | B | Highest ceiling of any single post; one shot, needs the game to be polished and the first 30 s to be flawless. "The project should be non-trivial", must be tryable "without barriers such as signups". Save it for the M2 arcade loop with leaderboards. | 1 post, Alex on the thread all day | 3 |
| 5 | **Short-form video** (TikTok / Shorts / Reels) of the ride | A, C | The ride is visual; a 15 s vertical clip of the Inferno drop or the Ferris wheel pass is the ad. Agents have no screen-capture or video tools, so Alex records (phone screen recording is enough). | Alex's time | 2–3 |
| 6 | **SEO** on scoaster.com | A | "rollercoaster shooter game", "rail shooter browser", "free online shooting game no download" are long-tail and slow. Everything on our side is shipped: #96 (title/description, OG card, sitemap, robots), #255 (indexable about / how-to-play text, `VideoGame` JSON-LD), #275 (real 404s, headers, manifest + icons, full card set, Lighthouse SEO 100 gate; checklist in `SEO.md`). What's left is Alex's: verify the domain in Search Console + Bing and submit the sitemap (#274). Then it is a matter of months, not weeks. | Alex (15 min) | 1 |
| 7 | **Paid test** (~$100) — Reddit ads on r/WebGames-style interests, or Meta/TikTok to the clip | A | Only after analytics works and an organic channel shows which audience converts to a second level. | $100 cap (STEERING) | 3 |

Not now: press / game journalists (no story yet), Steam (not a Steam game), Discord
servers (needs a community to exist first), Product Hunt (weak fit for a game).

## Launch stages

| Stage | Name | Gate to enter | What happens |
|---|---|---|---|
| **0** | **Get measurable** — **done 26 Oct** | – | Web Analytics on and reading ✅ (first page view 22 Oct; 31 visitors in W43, all direct), scoaster.com attached ✅, OG card + meta ✅, GA tag removed ✅, custom events live ✅ (#98). No traffic pushed; baseline week runs 24 Oct – 1 Nov. |
| **1** | **Soft launch** — **we are here: the gate is green, the first post is Alex's to make** | Readiness gate below all green: #28 ✅, #70 ✅, #98 ✅, landing paths ✅ (#261), clip ✅ (#100, 28 Oct), SEO + card ✅ (#255, #275), share button ✅ (#253) | **Post 1: three.js Showcase (#102) — GO for Mon 2 Nov.** Then r/playmygame + r/WebGames the week after (#308), r/threejs, one X/Bluesky thread — one channel a week, so each has its own clean measurement against the W44 baseline. Collect feedback into issues. |
| 2 | Portals | Embeddable build ✅ (#251); soft-launch feedback addressed; the zip downloadable from CI | itch.io first (free, no review queue, link back allowed), then Newgrounds, then CrazyGames Basic Launch. Vertical clip for Shorts / Reels. |
| 3 | Big swing | M2 arcade loop shipped enough to hold a Show HN crowd (bosses ✅ on levels 1 and 3, Daily Run ✅, pickups ✅; local leaderboard #40 in review) | Show HN (Alex's words); clip series; the $100 paid test on whichever channel had the best start rate. |

**Stage 1, gate green** (2 Nov, 05:20 NY). The baseline week ran (W44: 37 visitors, 43 views,
8 level starts, 3 completes, all direct — about 5 visitors and 1 start a day,
`metrics/2026-W44.md`), the clip exists (#100, 28 Oct), the share card, indexable text and
Lighthouse gate are live (#255, #275), the Share button and the portal build shipped (#253,
#251), and production is `main` @ `8e66045`. One yellow: `agent:prod-broken` #297 is open, but
the Maintainer traced every red run to smoke timing flakes on slow runners with all functional
checks passing (fix #305, P1); it is not a reason to hold the post, only to play the game once
on a phone and a desktop before posting. **The 2 Nov Showcase post is GO** — the comment on
#102 says exactly what to do. Nothing has been posted yet, so nothing is measured yet: every
week the post slips is a week with no learning.

## Readiness gate (checked 2026-11-02 05:20 NY)

| Check | Status | Evidence / what closes it |
|---|---|---|
| scoaster.com serves the game over HTTPS | ✅ | Production deployment of `main` @ `8e66045` READY 1 Nov 11:23 UTC. 37 visitors reached it in W44 from 7 countries on desktop and mobile. The sandbox still cannot open the site itself (blocked host); the Maintainer's local smoke of `8e66045` passed every functional check. |
| Analytics on | ✅ | Reading since 22 Oct; `level_start` (now with `mode`) / `level_complete` / `level_quit` / `share` (#253, wired, none fired yet). UTM dimensions paywalled (402) → referrer + `requestPath`; `/go/<campaign>` pinned by a smoke step (#261). |
| Title, description, social preview card | ✅ | #96 → #275: title, description, canonical, full `og:*` + `twitter:*` set with alt text, card under every unfurler's weight limit, `site.webmanifest` + icons, real 404s, security headers, Lighthouse gate (SEO 100, A11y / BP ≥ 95) in `npm run verify`. Checklist with sources: `SEO.md`. Card still shows the HUD frame without a title — experiment 5 tests a titled card. |
| Indexable | ✅ | #255: visually hidden `#about` text (what the game is, how to play, every level named) + `["VideoGame","WebApplication"]` JSON-LD, unit-tested. Search engines still have to be told the site exists: **#274 (Alex)**. |
| Loads fast | ✅ | `main` @ `8e66045`: **472 KB gz startup JS** (app 184, three 172, r3f 115); Tone.js (63 KB) and the score engine load on the first gesture (#269). Total 562 of 700 KB. Shader warm-up behind the Ready / Set / GO countdown. |
| Plays on a phone | ✅ / ❓ | Smoke `--mobile` passes on every merge; #276 keeps the portrait gun clear of the combo meter. Mobile start rate: 1 of 9 in W44, 1 of 18 over two weeks vs desktop 10 of 50. Below the 20-mobile-visitor bar of experiment 3, so no P1 yet; the first post with volume decides. |
| First 10 seconds exciting | ✅ | #167 fly-by title; since then fireworks on streaks (#222), the Golden Blimp finale (#219), weapon pickups (#266), per-enemy death effects (#227), a pause that pauses (#233), Daily Run (#265). 19 % of W44 visitors pressed PLAY — the number the Showcase thread has to move. |
| Production smoke green | ⚠️ | **#297 open** since 1 Nov: CI `verify` red on `a1cb9cd` and `8e66045`, prod smoke passing and failing on and off since 31 Oct. Maintainer (2 Nov): no culprit merge, `main` playable, the failures are perf-gate object counts / a boss-part kill / `hidden-pause` slack on slow runners, every functional check green; fix #305 (P1). **Alex plays one run on phone + desktop before posting**; if anything is off, hold a day for #305. |
| A clip to post | ✅ | #100 shipped 28 Oct: `docs/marketing/media/clip-level1-1280x720.{mp4,gif}` + stills. Rendered before fireworks / blimp / pickups landed; **re-rendered this run on `main` @ `8e66045`** (fireworks, ×5 FRENZY, 17 kills; in the W44 marketing PR); a 720×1280 vertical cut for Shorts / Reels is filed (#309). |
| Share-your-score | ✅ | #253: results-screen Share button (Web Share sheet or clipboard), link `/go/share`. |
| Portal build | ✅ / ⏳ | #251: `dist-portal.zip`, nested-path smoke in CI. Not yet downloadable from CI (#307); itch.io upload drafted once it is. |

## Experiment queue (ranked)

1. ~~**Referrer baseline**~~ — **done (W44, 26 Oct – 1 Nov):** 37 visitors, 43 views, 8 level
   starts (7 people), 3 completes, 100 % direct; ≈ 5 visitors and ≈ 1 start a day; 19 % of
   visitors press PLAY. This is the ruler every post is measured against.
2. **three.js Showcase post** (#102, **GO Mon 2 Nov**) — measure `requestPath = /go/showcase`
   and referrer `discourse.threejs.org` for 7 days; success = 100 visitors, ≥ 30 % start a
   level, ≥ 10 % complete one. Also the first real read of the mobile start rate (3).
3. **Mobile start rate** (passive, continues) — `level_start` visitors on mobile ÷ mobile
   visitors. W43: 0 of 9; W44: 1 of 9; desktop 10 of 50 over the two weeks. Still under the
   20-mobile-visitor bar. If the Showcase week brings ≥ 20 mobile visitors and the rate stays
   under half of desktop's, file a P1 on the phone title → PLAY → level path.
4. **r/playmygame vs r/WebGames** (#308, weekend of 7–8 Nov, after the Showcase has had its week) —
   same weekend, different landing paths (`/go/playmygame`, `/go/webgames`); which sub sends
   more visitors and which sends visitors who finish a level.
5. **OG card A/B** — the current HUD gameplay frame vs a titled card (game name + "free
   browser rail shooter" over the same frame); measured by click-through from the
   X/Bluesky thread (manual count).
6. **Share button use** — `share` events ÷ `level_complete`, and visitors on `/go/share`. 0 of
   1 so far (one completed run since it shipped). If it stays near 0 over 50 completes, the
   button needs a prompt (a "beat me" nudge on NEW RECORD) rather than a bigger button.
7. **Portal cross-traffic** — does an itch.io / CrazyGames listing send anyone to scoaster.com
   (link in the description where allowed → `/go/itch`, `/go/crazygames`)?
8. **Paid $100** — Reddit ads, 7 days, $14/day, stop rule: < 30 visitors/day for 3 days.

## Measurement notes

- The Vercel team is on **Pro** (Alex, 22 Oct), so Web Analytics has **custom events** with
  properties (`eventData/level`, `/stars`, `/progress_pct` break down in the query API), plus
  referrer hostname, request path, country, device, OS and browser. **UTM dimensions do not
  work on Pro** (26 Oct: `402 … Enterprise plan or the Web Analytics Plus add-on`), so the
  UTM-based plan from 22 Oct is replaced by **campaign landing paths**: each post links to
  `https://scoaster.com/go/<campaign>` (served by the `vercel.json` catch-all rewrite, recorded
  as `requestPath`; #171 pins it), and the weekly file reports `requestPath` **and** referrer, because people
  re-share bare links. Links keep `?utm_*` too — free, and other tools read them. The event
  allowance still counts every custom event, so events stay at ≤ 2 per run.
- Success metric per post: visitors on the campaign path / referrer **and**
  `level_complete` ÷ `level_start` (did they finish a run), split by device.
- The API snaps date ranges to **UTC days**; weekly files say so and never relabel UTC days
  as New York days.
- Test traffic (`?e2e=1`, CI, nightly and post-deploy production smoke) never counts
  (`src/app/analyticsGate.ts`, shipped in #97).
- The query API answers 404 until the project has recorded its first production page
  view; that is "not started yet", not "off".
- The old Google Analytics tag is gone (#96). Nothing else third-party runs at runtime
  except Google Fonts (pre-existing; DECISIONS).

## Community rules we rely on (quoted)

- **r/playmygame** (mod post "How to avoid having your posts removed v2", Jul 2024):
  "There must be some way at the time of your posting to play your game for free." ·
  "Your post MUST include a written description of your game." · "You must be part of the
  game design team in order to post here." · "When posting make sure to add flair to your
  posts to designate the platform." · "Do not post more than once a month. This resets on
  the calendar month." · "a direct link is a link that takes you directly to the place
  where the game can be downloaded." Format tip from the mods: post the media, then put the
  description + link in a comment on your own post.
- **r/WebGames, r/IndieGaming, r/threejs:** rules not readable from the agent sandbox
  (Reddit blocked). Alex reads the sidebar before posting; the draft will have a blank
  "rule I relied on" line for him to fill.
- **three.js forum, Showcase:** "Use this category to showcase any projects you have
  created using three.js." · "Showcases require moderator approval." · "Projects posted
  here will be considered for the three.js homepage."
- **Show HN:** "Show HN is for something you've made that other people can play with." ·
  "The project should be non-trivial." · "Please make it easy for users to try your thing
  out, ideally without barriers such as signups or emails." · "Please don't ask friends
  to upvote or comment." · Titles: no uppercase/exclamation points, no site name. · HN:
  "Don't post generated text or AI-edited text" — **Alex writes the HN post and comments
  in his own words; the Marketer supplies facts and a bullet brief only.**
- **Portals:** CrazyGames — "Use only relative paths", "Custom in-game fullscreen buttons
  are prohibited", physics "must perform consistently across different monitor refresh
  rates", "The game must have English localization", Basic Launch ends after "at least 7
  days and … at least 500 plays" or 21 days. itch.io — zip "must contain a file called
  index.html", absolute paths fail, max 1,000 files / 500 MB. Poki — exclusive by default
  (5 years), own SDK only, "Target an initial download size under 8 MB": **skip Poki**.

## What changed

- **2026-11-02 (v1.3, weekly run).** The baseline week is in: W44 = 37 visitors, 43 views, 8
  starts → 3 completes, 100 % direct, mobile share 24 %, 1 of 9 mobile visitors started a
  level (desktop 6 of 28); ≈ 5 visitors / 1 start a day with no marketing. **Every readiness
  item is green**: the clip shipped (#100, 28 Oct), indexable text + JSON-LD (#255), the full
  share-card / 404 / headers / Lighthouse pass (#275), the Share button (#253) and the portal
  build (#251) all landed last week; one yellow, `agent:prod-broken` #297, is smoke timing
  flakes per the Maintainer (fix #305). **The Showcase post is GO today** — #102 updated with
  the gate status, a one-minute pre-flight (play a run on phone + desktop, fill in the LICENSE
  holder, set the GitHub repo's homepage to scoaster.com) and refreshed facts for the text
  (bosses, Daily Run, pickups, 472 KB startup). New draft #308: r/playmygame + r/WebGames for
  the weekend of 7–8 Nov (experiment 4; r/playmygame rules quoted, r/WebGames line left for
  Alex). The landscape clip was re-rendered this run on `main` @ `8e66045` (it now shows
  fireworks and the ×5 FRENZY; the 28 Oct render predated them). New growth issues: #307 (keep
  `dist-portal.zip` as a CI artifact so Alex can upload to itch.io without a local build) and
  #309 (a 720×1280 vertical cut for Shorts / Reels / TikTok). Stage 2 order set: itch.io → Newgrounds → CrazyGames. SEO channel row
  rewritten: our side is done, #274 (Search Console / Bing) is Alex's. No spend (knob 0).
- **2026-10-26 (v1.2, weekly run).** First real numbers: W43 = 31 visitors, 47 views, 18
  level starts → 8 completes (44 %) from 4 desktop players, 29 % mobile share with **0 mobile
  level starts**, 100 % direct (no posts yet; 22–23 Oct is Alex's setup). Stage 0 closed:
  analytics reads, custom events live, #28 (title first 30 s) merged this morning, #70
  closed, bundle down to 498 KB gz (app 211/260). **UTM dimensions are paywalled on Pro
  (402)** — attribution moves to `/go/<campaign>` landing paths (already served by the
  catch-all rewrite, verified locally; #171 pins it, P2) plus referrer; README, measurement
  notes, CHANNELS and BUDGET updated. #100 (clip) raised to P1: the last gate item for the
  2 Nov Showcase post; #102 updated with the gate status, the `/go/showcase` link and the
  shipped title screen. New experiment 3: mobile start rate (W44 decides whether the phone
  title → PLAY path is a P1 bug). No spend (knob 0).
- **2026-10-22, 23:00 NY (v1.1, extra run after Alex's setup).** Stage 0 is done bar the
  first page view: scoaster.com attached and verified (22:55 NY), Web Analytics on, share
  card + SEO head live (#96), analytics mounted (#97), GA tag gone. The team is on **Pro**,
  so custom events (#98, P1, from Alex) and UTM dimensions become the success metric per
  post; measurement notes rewritten. Closed the setup ask #85. Baseline week 23 Oct – 1 Nov,
  Stage 1 targeted for **Mon 2 Nov**. New: growth issues #100 (frame-stepped gameplay
  clip, MP4 + GIF — the missing piece for every post) and #101 (indexable text + VideoGame
  JSON-LD); first launch draft #102 (three.js Showcase post, dated 2 Nov, gated on #28, #70
  and a clip). Bundle note: app chunk 253/260 KB.
- **2026-10-22 (v1).** First run. No numbers: Web Analytics is not enabled and scoaster.com
  is not attached, so Stage 0 is "get measurable" and no posts are drafted. Filed the
  setup ask for Alex (#85: enable Web Analytics, attach scoaster.com, GA tag question)
  and three growth issues: #86 OG card + SEO head (P1), #87 share-your-score on the
  results screen, #88 portable portal build (itch.io / Newgrounds / CrazyGames). Poki
  ruled out for now (exclusivity). #59 (analytics mount) was already P1.
