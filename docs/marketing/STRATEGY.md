# Marketing strategy

_v1.2 (2026-10-26). First written 2026-10-22; rewritten or amended every week;
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
3. **Arcade scoring.** 60–120 s runs, combos, stars, "one more run".
4. **Made with three.js, zero asset files.** Everything on screen is procedural (geometry,
   shaders, Tone.js music). That is the story for the web-dev crowd, which is the cheapest
   audience to reach and the most likely to share.

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
| 1 | **Web-game portals** — CrazyGames (Basic Launch), itch.io, Newgrounds | A | The only channels with standing traffic for browser games. CrazyGames' Basic Launch is a 7–21 day trial on their site that ends at 500 plays; itch and Newgrounds host a zip with `index.html` at the root. All need an **embeddable build** (relative paths, no external requests, pause on tab hide). Poki is excluded for now: it wants a web-exclusive deal (default 5 years) and its SDK/ads, which would conflict with scoaster.com being the home. | builder work (#growth issue) + Alex uploads | 2 |
| 2 | **three.js forum Showcase + r/threejs + `#threejs` on X/Bluesky** | B | Exactly our audience, free, moderated (so no spam), and Showcase posts "will be considered for the three.js homepage". A good post here is also the seed for the Show HN later. | 1 post + a GIF | 1 |
| 3 | **r/WebGames** and **r/playmygame** | A, C | Players who want a browser game *now*. r/playmygame rules are quoted below; r/WebGames rules could not be read from the agent sandbox (Reddit is blocked) — Alex checks the sidebar before posting. One post per sub per month. | 2 posts | 1 |
| 4 | **Show HN** | B | Highest ceiling of any single post; one shot, needs the game to be polished and the first 30 s to be flawless. "The project should be non-trivial", must be tryable "without barriers such as signups". Save it for the M2 arcade loop with leaderboards. | 1 post, Alex on the thread all day | 3 |
| 5 | **Short-form video** (TikTok / Shorts / Reels) of the ride | A, C | The ride is visual; a 15 s vertical clip of the Inferno drop or the Ferris wheel pass is the ad. Agents have no screen-capture or video tools, so Alex records (phone screen recording is enough). | Alex's time | 2–3 |
| 6 | **SEO** on scoaster.com | A | "rollercoaster shooter game", "rail shooter browser", "free online shooting game no download" are long-tail and slow. Table stakes shipped in #96 (title/description, OG card, sitemap, robots). Still missing: indexable text — the page is an empty `<div id="root">` to a crawler — and `VideoGame` structured data (#101, queued P2). | builder work | 0–1 |
| 7 | **Paid test** (~$100) — Reddit ads on r/WebGames-style interests, or Meta/TikTok to the clip | A | Only after analytics works and an organic channel shows which audience converts to a second level. | $100 cap (STEERING) | 3 |

Not now: press / game journalists (no story yet), Steam (not a Steam game), Discord
servers (needs a community to exist first), Product Hunt (weak fit for a game).

## Launch stages

| Stage | Name | Gate to enter | What happens |
|---|---|---|---|
| **0** | **Get measurable** — **done 26 Oct** | – | Web Analytics on and reading ✅ (first page view 22 Oct; 31 visitors in W43, all direct), scoaster.com attached ✅, OG card + meta ✅, GA tag removed ✅, custom events live ✅ (#98). No traffic pushed; baseline week runs 24 Oct – 1 Nov. |
| **1** | **Soft launch** (target **Mon 2 Nov**) — **we are here, waiting on the clip** | Readiness gate below all green: #28 ✅ (merged 26 Oct), #70 ✅ (closed 23 Oct), #98 ✅, campaign landing paths ✅ (`/go/<campaign>` already served; #171 pins it), **a clip exists ❌ (#100, P1)** | three.js Showcase (drafted, #102), r/threejs, r/WebGames, r/playmygame, one X/Bluesky thread — one channel at a time, a week apart, so each has its own clean measurement. Collect feedback into issues. |
| 2 | Portals | Embeddable build ships; soft-launch feedback addressed | itch.io + Newgrounds uploads, CrazyGames Basic Launch. First short clip. |
| 3 | Big swing | M2 arcade loop (combo tiers, leaderboard, daily run) | Show HN; clip series; the $100 paid test on whichever channel had the best second-level rate. |

**Stage 0 is done; we are in Stage 1 waiting on one item** (26 Oct, 05:30 NY): analytics
reads (W43: 31 visitors, 47 views, 18 level starts, 8 completes — all direct, mostly Alex
and the people he sent the link to), the title fly-by shipped this morning (#167), production
smoke is green. The 2 Nov Showcase post (#102) goes ahead **only if a clip exists by then**
(#100, now P1, or Alex's own screen recording) — the draft says so. UTM breakdowns turned
out to be paywalled on Vercel Pro, so links now use `/go/<campaign>` landing paths; the game
already serves at those paths (verified locally this run; #171 pins it), and the Showcase
link was switched to `/go/showcase` today.

## Readiness gate (checked 2026-10-26 05:30 NY)

| Check | Status | Evidence / what closes it |
|---|---|---|
| scoaster.com serves the game over HTTPS | ✅ | Production domain, verified; production deployment `8c43d5b` READY at 04:56 NY today (#167 + #155). 31 real visitors reached it in W43 from 7 countries on desktop and mobile. The sandbox still cannot open the site itself (blocked host). |
| Analytics on | ✅ | **Reading.** Page views since 22 Oct; `level_start` / `level_complete` / `level_quit` since #98 (23 Oct). Per-level, per-stars and per-progress breakdowns work via `eventData/*`. **UTM dimensions are paywalled (402)** → attribution by referrer + `requestPath` (`/go/<campaign>` landing paths, live; #171 pins them). |
| Title, description, social preview card | ✅ | #96: title, description, canonical, full `og:*` + `twitter:card=summary_large_image` with a real gameplay frame (`public/social/og-1200x630.jpg`), `robots.txt`, `sitemap.xml`, GA tag gone. Card shows the HUD and no title text — fine for v1; experiment 4 tests a titled card. |
| Loads fast | ✅ | Re-measured on `main` @ `8c43d5b` this run: **498 KB gz total** (three 172, r3f 114, app **211 of 260 KB**) — down from 546 / 253 on 22 Oct. No loading screen yet (#39, P3), but the shader warm-up now runs behind the Ready / Set / GO countdown, so the first ride doesn't stutter. |
| Plays on a phone | ✅ / ❓ | Smoke `--mobile` passes on every merge (taps → kills in portrait and landscape, HUD inside the viewport). **But** the 9 mobile visitors in W43 started 0 levels while 4 desktop visitors started 18. Too few to call; W44 decides (see experiment 3). |
| First 10 seconds exciting | ✅ (shipped today, not yet seen by players) | #28 → #167 merged 26 Oct 04:47 NY: two fly-by camera shots, title drop-in, pulsing PLAY, any key starts, fade-to-black whoosh, title → level music crossfade. First real-player reaction comes with the Showcase thread. |
| Production smoke green | ✅ | #70 closed 23 Oct; no `agent:prod-broken` issue open. |
| A clip to post | ❌ | **The last gate item.** #100 (`npm run clip`, frame-stepped MP4 + GIF from the headless rig) has been `agent:ready` since 23 Oct and unclaimed; raised to **P1** this run. Fallback: Alex records 15 s of the Theme Park ride on his phone or desktop. |

## Experiment queue (ranked)

1. **Referrer baseline** (running: 24 Oct – 1 Nov) — analytics is on, no posts, so we know
   what "nobody is marketing this" looks like. First reading (24–25 Oct UTC): 14 visitors,
   26 views, 15 level starts from 3 people, all direct. Expected for the full week: a few a
   day, mostly Alex's circle.
2. **three.js Showcase post** (drafted #102, earliest Mon 2 Nov, needs the clip) — measure
   `requestPath = /go/showcase` and referrer `discourse.threejs.org` for 7 days; success = 100 visitors, ≥ 30 % start a level, ≥ 10 % complete one.
3. **Mobile start rate** (W44, passive) — `level_start` visitors on mobile ÷ mobile visitors.
   W43: 0 of 9. If W44 has ≥ 20 mobile visitors and the rate is still ~0, file a P1 bug on
   the phone title → PLAY → level path (with a one-shot `title_play` event only if nothing
   else explains it); if phones start levels like desktops do, drop this.
4. **r/WebGames vs r/playmygame** — same week, different landing paths (`/go/webgames`,
   `/go/playmygame`); which sub sends more visitors and which sends visitors who finish a
   level.
5. **OG card A/B** — the current HUD gameplay frame vs a titled card (game name + "free
   browser rail shooter" over the same frame); measured by click-through from the
   X/Bluesky thread (manual count).
6. **Portal cross-traffic** — does the CrazyGames Basic Launch send anyone to scoaster.com
   (link in the description where allowed → `/go/crazygames`)?
7. **Paid $100** — Reddit ads, 7 days, $14/day, stop rule: < 30 visitors/day for 3 days.

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
