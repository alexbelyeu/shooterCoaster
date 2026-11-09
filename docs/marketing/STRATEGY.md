# Marketing strategy

_v1.4 (2026-11-09). First written 2026-10-22; rewritten or amended every week;
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
3. **Arcade scoring.** 60–120 s runs (every run becomes 60 s with #434), combo tiers to ×5
   FRENZY, stars, weapon pickups, a boss finale on four of five levels (the Golden Blimp, the
   Giant Scorpion, the Kraken, the Yeti), an online top 10 per level with arcade initials, a
   Daily Run everyone plays with the same seed, "one more run".
4. **Made with three.js, zero asset files.** Everything on screen is procedural (geometry,
   shaders; music and SFX synthesised in plain Web Audio on the Scrimshaw score engine — no
   audio library since #431). 397 KB gz of startup JS, three.js included. That is the story for
   the web-dev crowd, which is the cheapest audience to reach and the most likely to share.

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
| 1 | **Web-game portals** — CrazyGames (Basic Launch), itch.io, Newgrounds | A | The only channels with standing traffic for browser games. CrazyGames' Basic Launch is a 7–21 day trial on their site that ends at 500 plays; itch and Newgrounds host a zip with `index.html` at the root. All need an **embeddable build** (relative paths, no external requests, pause on tab hide) — **shipped 31 Oct (#251, `npm run build:portal` → `dist-portal.zip`, smoked under a nested path in CI)**; the zip is kept as the `dist-portal` artifact of every green `main` CI run (#349, 3 Nov; README "Portal zip"). Poki is excluded for now: it wants a web-exclusive deal (default 5 years) and its SDK/ads, which would conflict with scoaster.com being the home. | Alex uploads | 2 |
| 2 | **three.js forum Showcase + r/threejs + `#threejs` on X/Bluesky** | B | Exactly our audience, free, moderated (so no spam), and Showcase posts "will be considered for the three.js homepage". Work-in-progress posts are the norm there, so it doesn't wait on Alex's player bar. A good post here is also the seed for the Show HN later. | 1 post + a GIF | 1a |
| 3 | **r/WebGames** and **r/playmygame** | A, C | Players who want a browser game *now*. r/playmygame rules are quoted below; r/WebGames rules could not be read from the agent sandbox (Reddit is blocked) — Alex checks the sidebar before posting. One post per sub per month. Waits for Alex's bar (#434 / #435 / #436). | 2 posts | 1b |
| 4 | **Show HN** | B | Highest ceiling of any single post; one shot, needs the game to be polished and the first 30 s to be flawless. "The project should be non-trivial", must be tryable "without barriers such as signups". The arcade loop and the online leaderboard are in; the "what's new" for the HN day is Level 6 or the procedural worlds (#437). | 1 post, Alex on the thread all day | 3 |
| 5 | **Short-form video** (TikTok / Shorts / Reels) of the ride | A, C | The ride is visual; a 15 s vertical clip of the Inferno drop or the Ferris wheel pass is the ad. `npm run clip` renders the vertical 720×1280 cut from the real game (#395, in `docs/marketing/media/`); Alex only has to upload it with a caption. | Alex's time | 2–3 |
| 6 | **SEO** on scoaster.com | A | "rollercoaster shooter game", "rail shooter browser", "free online shooting game no download" are long-tail and slow. Everything on our side is shipped: #96 (title/description, OG card, sitemap, robots), #255 (indexable about / how-to-play text, `VideoGame` JSON-LD), #275 (real 404s, headers, manifest + icons, full card set, Lighthouse SEO 100 gate; checklist in `SEO.md`). What's left is Alex's: verify the domain in Search Console + Bing and submit the sitemap (#274). Then it is a matter of months, not weeks. | Alex (15 min) | 1 |
| 7 | **Paid test** (~$100) — Reddit ads on r/WebGames-style interests, or Meta/TikTok to the clip | A | Only after analytics works and an organic channel shows which audience converts to a second level. | $100 cap (STEERING) | 3 |

Not now: press / game journalists (no story yet), Steam (not a Steam game), Discord
servers (needs a community to exist first), Product Hunt (weak fit for a game).

## Launch stages

| Stage | Name | Gate to enter | What happens |
|---|---|---|---|
| **0** | **Get measurable** — **done 26 Oct** | – | Web Analytics on and reading ✅ (first page view 22 Oct; 31 visitors in W43, all direct), scoaster.com attached ✅, OG card + meta ✅, GA tag removed ✅, custom events live ✅ (#98). No traffic pushed; baseline week runs 24 Oct – 1 Nov. |
| **1a** | **Soft launch, dev audience** — **we are here: the gate has been green since 2 Nov; nothing has been posted** | Readiness gate below all green ✅ (2 Nov), production green with no `agent:prod-broken` ✅ (9 Nov) | **Post 1: three.js Showcase (#102) — re-dated GO for this week (Mon 9 – Fri 13 Nov).** The forum wants the technical story and takes work-in-progress well, so Alex's own bar (below) is not a reason to hold it. Then r/threejs and one X/Bluesky thread. Collect feedback into issues. |
| **1b** | **Soft launch, player audience** | Stage 1a posted **and Alex's own bar from his 8 Nov playtest (#439)**: 60 s runs (#434), no spawn gaps (#435), the title world (#436) — the Director's call on when they're in | r/playmygame + r/WebGames (#308, re-dated to the first weekend after that bar), then the Daily Run as a weekly hook. One channel a week, each measured against the baseline. |
| 2 | Portals | Embeddable build ✅ (#251), zip downloadable from CI ✅ (#349); Stage 1b feedback addressed | itch.io first (free, no review queue, link back allowed), then Newgrounds, then CrazyGames Basic Launch. The vertical clip ✅ (#395) for Shorts / Reels. |
| 3 | Big swing | M2 arcade loop ✅ (four finales, Daily Run, pickups, online leaderboard #383); Level 6 or the procedural worlds (#437) as the "what's new" | Show HN (Alex's words); clip series; the $100 paid test on whichever channel had the best start rate. |

**Where we are** (9 Nov, 05:20 NY). The gate went green on 2 Nov and stayed green: production is
`main` @ `15cbbd9` with `verify` and the deploy health check green and no `agent:prod-broken`
open. Since then the game gained four finales, the online leaderboard, the score-card image,
Alex's picked themes on one audio engine, a coaster on the title and a 397 KB startup
(`metrics/2026-W45.md`, Readiness). **Neither draft was posted** (#102 dated 2 Nov, #308 dated
7–8 Nov), so two weeks have produced no learning about players, and W45's only play traffic looks
like Alex's own un-flagged Mac browser. Alex's 8 Nov playtest (#439) sets his own bar before he
shows it to players: a bigger title world, 60 s runs, no spawn gaps. The strategy now honours
that bar for the **player** posts (Stage 1b) and asks for the **dev** post (Stage 1a) now: the
three.js Showcase is the one channel where "work in progress, here's how it's built" is the
expected shape of a post, and its replies are the feedback the next month's work wants.

## Readiness gate (checked 2026-11-09 05:20 NY)

| Check | Status | Evidence / what closes it |
|---|---|---|
| scoaster.com serves the game over HTTPS | ✅ | Production is `main` @ `15cbbd9`: CI `verify` green 09:11 UTC and the post-deploy health check (`npm run prod-check`, #352) green 09:10 UTC on 9 Nov. 28 visitors reached it in W45 from 6 countries. The sandbox still cannot open the site itself (blocked host). |
| Analytics on | ✅ | Reading since 22 Oct; `level_start` (with `mode`) / `level_complete` / `level_quit` / `share` (with `method`). UTM dimensions paywalled (402) → referrer + `requestPath`; `/go/<campaign>` pinned by a smoke step (#261). **Hygiene gap:** the Mac browser that made every W45 level start is not flagged `?internal=1` (`metrics/2026-W45.md`); #446 adds a Settings toggle for it. |
| Real-player telemetry | ⏳ | #373 shipped 7 Nov (errors, WebGL context loss, frame times per level and device class, `docs/TELEMETRY.md`) but `/api/telemetry` doesn't answer: **Alex runs `supabase/migrations/0002_telemetry.sql` once.** Without it the first post's phones report no frame times. |
| Title, description, social preview card | ✅ | #96 → #275: title, description, canonical, full `og:*` + `twitter:*` set with alt text, card under every unfurler's weight limit, `site.webmanifest` + icons, real 404s, security headers, Lighthouse gate (SEO 100, A11y / BP ≥ 95) in `npm run verify`. Checklist with sources: `SEO.md`. Card still shows the HUD frame without a title — experiment 5 tests a titled card. |
| Indexable | ✅ | #255: visually hidden `#about` text (what the game is, how to play, every level named) + `["VideoGame","WebApplication"]` JSON-LD, unit-tested. Search engines still have to be told the site exists: **#274 (Alex)**. The `#about` copy's run lengths change with #434 (60 s runs) — the builder updates it in that PR. |
| Loads fast | ✅ | `main` @ `15cbbd9`: **397 KB gz startup JS** (three 172, r3f 114, app 111; budget 435), total 519 of 630 KB. Tone.js is gone (#431); the level scene is a lazy chunk prefetched on the title and the poster paints before any JS (#420). Shader warm-up behind the Ready / Set / GO countdown. Lighthouse performance is report-only (28 mobile / 59 desktop on 2 Nov; #376 part 2 owns it). |
| Plays on a phone | ✅ / ❓ | Smoke `mobile` shard passes on every merge. Mobile start rate: 1 of 19 mobile visitors over three weeks (0 of 9, 1 of 9, 0 of 1) vs desktop 14 of 77. Still below the 20-mobile-visitor bar of experiment 3; the first post with volume decides. Telemetry (above) will add real frame times. |
| First 10 seconds exciting | ✅ / ⚠️ | A coaster rides the title park, beat-locked cuts, attract mode, poster from the first paint (#423, #420). **Alex's read (8 Nov, #436): the title world "feels only half way" — a green plain around the park.** Fine for the dev post (they look at the ride and the code); the player posts wait for #436. 19 % of W44 visitors pressed PLAY (W45 is unreadable, above). |
| Production smoke green | ✅ | #297 closed; the smoke samples level time now (#305), PR smoke is sharded (#364, #411), the deploy check runs after every deploy and the full smoke nightly (#355). No `agent:prod-broken` open on 9 Nov. |
| A clip to post | ✅ | `docs/marketing/media/`: landscape level-1 clip (re-rendered 2 Nov on `8e66045`; predates the title coaster, picked themes and the new finales), the **vertical 720×1280 cut** (#395, 6 Nov), three title clips (#419). Re-render the landscape clip on the day of the post (`npm run build && npm run clip`, ~15 min; media README policy). |
| Share-your-score | ✅ | #253 text share + #368 **score-card image** (1200×630 feed / 1080×1920 story, native image share on phones, Save / Copy on desktop), link `/go/share`. The share line doesn't yet say the run's **World rank** (#383's online board) — #445. 0 shares of 12 completes so far. |
| Portal build | ✅ | #251 `dist-portal.zip` + #349: kept as the `dist-portal` artifact of every green `main` CI run (README "Portal zip"). Ready to upload when Stage 2 opens. |
| Alex's own bar (new) | ⏳ | #439: #434 (60 s runs), #435 (spawn gaps), #436 (title world). Gates **Stage 1b** (player posts), not Stage 1a. |

## Experiment queue (ranked)

1. ~~**Referrer baseline**~~ — **done (W44, 26 Oct – 1 Nov):** 37 visitors, 43 views, 8 level
   starts (7 people), 3 completes, 100 % direct; ≈ 5 visitors and ≈ 1 start a day; 19 % of
   visitors press PLAY. This is the ruler every post is measured against.
2. **three.js Showcase post** (#102, **re-dated: GO this week, Mon 9 – Fri 13 Nov**; not posted on
   2 Nov) — measure `requestPath = /go/showcase` and referrer `discourse.threejs.org` for 7 days;
   success = 100 visitors, ≥ 30 % start a level, ≥ 10 % complete one. Also the first real read
   of the mobile start rate (3). Events carry `requestPath`, so starts and completes on
   `/go/showcase` are the post's own funnel.
3. **Mobile start rate** (passive, continues) — `level_start` visitors on mobile ÷ mobile
   visitors. W43: 0 of 9; W44: 1 of 9; W45: 0 of 1 (nothing posted). Still under the
   20-mobile-visitor bar. If the Showcase week brings ≥ 20 mobile visitors and the rate stays
   under half of desktop's, file a P1 on the phone title → PLAY → level path. Telemetry
   (#373, once Alex runs the migration) adds each phone's frame times to the read.
4. **r/playmygame vs r/WebGames** (#308, **re-dated to the first weekend after Alex's bar #434 /
   #435 / #436 is in** — not posted on 7–8 Nov) — same weekend, different landing paths
   (`/go/playmygame`, `/go/webgames`); which sub sends more visitors and which sends visitors
   who finish a level.
5. **OG card A/B** — the current HUD gameplay frame vs a titled card (game name + "free
   browser rail shooter" over the same frame); measured by click-through from the
   X/Bluesky thread (manual count).
6. **Share button use** — `share` events ÷ `level_complete`, and visitors on `/go/share`. 0 of
   12 so far (W44 1, W45 11 — the W45 completes look like Alex's own runs). If it stays near 0
   over 50 real completes, the button needs a prompt (a "beat me" nudge on NEW RECORD) rather
   than a bigger button. The World-rank share line (#445) gives it a reason first.
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

- **2026-11-09 (v1.4, weekly run).** **Nothing was posted in the week the gate went green**: #102
  (2 Nov) and #308 (7–8 Nov) are untouched, and W45 is a second baseline (28 visitors, 65 views,
  100 % direct bar one github.com view, 31 starts → 11 completes that all come from one Mac browser
  on the days Alex played — his un-flagged device, by every sign; `metrics/2026-W45.md`). Alex's
  8 Nov playtest (#439) sets his own bar before players see it (#434 60 s runs, #435 spawn gaps,
  #436 title world), so **Stage 1 is split**: 1a the three.js Showcase now (dev audience,
  work-in-progress is the expected shape there; #102 rewritten with this week's facts and
  re-dated 9–13 Nov), 1b the player posts after that bar (#308 rewritten and re-dated to the first
  weekend after it; the Director decides when). Readiness gate re-read: production green with no
  `agent:prod-broken`, 397 KB startup JS, four finales, the online leaderboard, the score-card image,
  the vertical clip (#395) and the CI-kept portal zip (#349) all landed; two new ⏳ rows: the
  telemetry migration (Alex, one SQL paste) and the `?internal=1` flag on the Mac browser. New
  growth issues: #445 (the share line and score card carry the World rank from the online board) and
  #446 (a Settings toggle marks a browser internal, so Alex's own plays stay out of the baseline). No new drafts (the
  three `needs-alex` slots are #102, #308, #274). No spend (knob 0).
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
