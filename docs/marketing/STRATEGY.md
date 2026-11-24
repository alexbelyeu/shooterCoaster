# Marketing strategy

_v1.6 (2026-11-23). First written 2026-10-22; rewritten or amended every week;
the "What changed" section at the bottom is the changelog._

Alex's direction (2026-10-22): organic first (web-game portals, communities, short
gameplay clips, launch posts); then a small paid test, about $100/month, once measurement
works and a channel shows promise. Alex places every post and ad himself from the
Marketer's drafts until an ad account is connected. Analytics: Vercel Web Analytics only.

**Alex's launch bar (#610, 18 Nov): no public post "until the game is AAA. We need 10 levels at
the highest degree."** That is M4 in `VISION.md` (ten worlds, every ride a thrill; due 8 Jan).
Until it closes the Marketer measures, keeps this file and the launch kit list current, and
drafts nothing.

## Positioning

**One-line pitch:** *House of the Dead on a rollercoaster — a free browser rail shooter.
Ride, aim, blast. Sixty seconds a run, no install, works on your phone.*

What makes it worth a click, in the order we lead with it:

1. **Instant.** A link is the whole install: title → PLAY → a 10 s tour of the world → riding.
2. **The ride is the hook.** Nobody else's browser shooter puts you on a coaster through
   six themed worlds, ten at launch (Theme Park, Desert, Ocean, Antarctica, Inferno, and a
   Climbing Gym built from Alex's own gym; Neon Metropolis and Jungle Ruins next). Since the ride
   kit (#703, week of 16 Nov) the rides are real coaster rides: launches, loops, corkscrews, drop
   tracks, jump gaps, a stretch ridden backwards, junctions you shoot to switch. The clip sells
   itself: speed, drops, a Ferris wheel passing overhead, balloons popping.
3. **Arcade scoring.** Every run is 60 s (#434): combo tiers to ×5 FRENZY, stars, weapon
   pickups, a boss finale on every level (the Golden Blimp, the Giant Scorpion, the Kraken, the
   Yeti, the Magma Titan, the Medusa), an online top 10 per level with arcade initials, a
   Daily Run everyone plays with the same seed, "one more run".
4. **Made with three.js, zero asset files.** Everything on screen is procedural (geometry,
   shaders; music and SFX synthesised in plain Web Audio on the Scrimshaw score engine — no
   audio library since #431). 436 KB gz of startup JS, three.js included. That is the story for
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
| 3 | **r/WebGames** and **r/playmygame** | A, C | Players who want a browser game *now*. r/playmygame rules are quoted below; r/WebGames rules could not be read from the agent sandbox (Reddit is blocked) — Alex checks the sidebar before posting. One post per sub per month. Waits on the launch bar (#610). | 2 posts | 1b |
| 4 | **Show HN** | B | Highest ceiling of any single post; one shot, needs the game to be polished and the first 30 s to be flawless. "The project should be non-trivial", must be tryable "without barriers such as signups". The arcade loop and the online leaderboard are in; the "what's new" for the HN day is Level 6 or the procedural worlds (#437). | 1 post, Alex on the thread all day | 3 |
| 5 | **Short-form video** (TikTok / Shorts / Reels) of the ride | A, C | The ride is visual; a 15 s vertical clip of the Inferno drop or the Ferris wheel pass is the ad. `npm run clip` renders the vertical 720×1280 cut from the real game (#395, in `docs/marketing/media/`); Alex only has to upload it with a caption. | Alex's time | 2–3 |
| 6 | **SEO** on scoaster.com | A | "rollercoaster shooter game", "rail shooter browser", "free online shooting game no download" are long-tail and slow. Everything on our side is shipped (#96, #255, #275; checklist in `SEO.md`) and Alex verified the domain and submitted the sitemap (#274, closed 9 Nov). **First google.com visit: 12 Nov.** A matter of months, not weeks; the weekly file tracks search referrals as a series from W46. | – | 1 |
| 7 | **Paid test** (~$100) — Reddit ads on r/WebGames-style interests, or Meta/TikTok to the clip | A | Only after analytics works and an organic channel shows which audience converts to a second level. | $100 cap (STEERING) | 3 |

Not now: press / game journalists (no story yet), Steam (not a Steam game), Discord
servers (needs a community to exist first), Product Hunt (weak fit for a game).

## Launch stages

| Stage | Name | Gate to enter | What happens |
|---|---|---|---|
| **0** | **Get measurable** — **done 26 Oct** | – | Web Analytics on and reading ✅ (first page view 22 Oct; 31 visitors in W43, all direct), scoaster.com attached ✅, OG card + meta ✅, GA tag removed ✅, custom events live ✅ (#98). No traffic pushed; baseline week runs 24 Oct – 1 Nov. |
| **Hold** | **Build to the launch bar** — **we are here since 18 Nov** | Alex's answer on #610 | No posts, no drafts. Weekly: measure the no-post baseline, keep SEO and the share path working, keep the launch kit list below current. Leaves when M4 closes (ten levels at Alex's bar) or Alex says otherwise in STEERING.md. |
| **1a** | **Soft launch, dev audience** | **M4 closed (Alex's bar, #610)**; readiness gate below green, production green | Post 1: three.js Showcase (draft text kept in the closed #102, to be rewritten with launch-week facts). Then r/threejs and one X/Bluesky thread. Collect feedback into issues. |
| **1b** | **Soft launch, player audience** | Stage 1a posted | r/playmygame + r/WebGames (text kept in the closed #308; the first weekend after the Showcase post has had its week), then the Daily Run as a weekly hook. One channel a week, each measured against the baseline. |
| 2 | Portals | Embeddable build ✅ (#251), zip downloadable from CI ✅ (#349); Stage 1b feedback addressed | itch.io first (free, no review queue, link back allowed), then Newgrounds, then CrazyGames Basic Launch. The vertical clip ✅ (#395) for Shorts / Reels. |
| 3 | Big swing | M2 arcade loop ✅; Level 6 ✅ playable (#546), at Alex's bar ⏳ (#558, #583); the procedural worlds (#437) as the "what's new" | Show HN (Alex's words); clip series; the $100 paid test on whichever channel had the best start rate. |

**Where we are** (23 Nov, 14:45 NY). **On hold by Alex's decision.** He answered #610 on 18 Nov:
no public post "until the game is AAA. We need 10 levels at the highest degree." The Director made
that M4 ("Ten worlds, every ride a thrill", due 8 Jan): six levels exist, level 7 Neon Metropolis
is in progress, 8 Jungle Ruins is planned, 9 and 10 come from the level kit. So the Marketer drafts
nothing: #308 (Reddit) is closed, its text and #102's stay in the closed issues. Four weeks without
a post read 37, 28, 26, 19 visitors (`metrics/2026-W47.md`): the trickle is shrinking, and
that is the expected cost of waiting, not a problem to fix with a post.

**Launch kit (what the first post will need, re-made in launch week, not before):**

| Piece | State | Launch-week action |
|---|---|---|
| Showcase text + link `/go/showcase` | kept in closed #102 (six worlds, old UI) | rewrite with ten worlds, the ride kit, the fair UI; new `needs-alex` draft |
| Reddit pair `/go/playmygame`, `/go/webgames` | kept in closed #308 | same, the weekend after |
| Clips (`docs/marketing/media/`) | all predate the fair UI, the ride kit and the intro tour | `npm run build && npm run clip` (landscape + vertical), plus one clip of a ride-kit ride (level 6 or a new world) |
| Share card / posters | `npm run og` output, re-rendered by builders when the title changes | check the card shows the launch title |
| Portal zip | `dist-portal` artifact on every green `main` CI run | upload at Stage 2 |
| Measurement | Web Analytics live; **telemetry endpoint still waits on Alex's `0002_telemetry.sql`**; **Alex's phones unflagged** | both before the first post, or its numbers can't be read |

## Readiness gate (checked 2026-11-23 14:45 NY)

| Check | Status | Evidence / what closes it |
|---|---|---|
| scoaster.com serves the game over HTTPS | ✅ / ⚠️ | Production is `main` @ `36843f1`; 19 visitors reached it in W47 from 3 countries. **Two `agent:prod-broken` open when read:** #894 (CI `verify` red on `main` @ `36843f1`, 23 Nov 19:04 UTC) and #707 (the nightly, red since 20 Nov for three causes, each fixed; closes on the next green one). The sandbox still cannot open the site itself (blocked host). |
| Analytics on | ✅ | Reading since 22 Oct; `level_start` (now with `from`, #811; counted from the loading screen since #674) / `level_complete` / `level_quit` / `share` (with `method`). UTM dimensions paywalled (402) → referrer + `requestPath`. **Hygiene gap:** two US iPhones made 11 of W47's 15 starts with no internal flag; by every sign the studio's own (Settings → Data → Internal device on each phone). |
| Real-player telemetry | ⏳ | #373 shipped 7 Nov, long frames (#540) and a WebGPU capability field (#851) added, but `/api/telemetry` still waits: **Alex runs `supabase/migrations/0002_telemetry.sql` once.** M4's "60 fps on a mid-range phone from real telemetry" criterion waits on it too. |
| Title, description, social preview card | ✅ | #96 → #275: title, description, canonical, full `og:*` + `twitter:*` set with alt text, card under every unfurler's weight limit, `site.webmanifest` + icons, real 404s, security headers, Lighthouse gate (SEO 100, A11y / BP ≥ 95) in `npm run verify`. Checklist with sources: `SEO.md`. Card still shows the HUD frame without a title — experiment 5 tests a titled card. |
| Indexable | ✅ | #255: visually hidden `#about` text (six worlds named, 60 s runs) + `["VideoGame","WebApplication"]` JSON-LD, unit-tested. Search Console + Bing done by Alex (#274, 9 Nov); first google.com visit 12 Nov. |
| Loads fast | ✅ / ⚠️ | **436 KB gz startup JS, exactly at its 436 budget** (STATE.md, 23 Nov); total 635 of 665 KB. #861 takes 20+ KB back and each world now loads in its own chunk (#862 → #889, 23 Nov). The poster paints before any JS (#420). |
| Runs smoothly | ⚠️ | #561 (Alex's MacBook Neo, 14 Nov: ~15 % of a run in frames over 50 ms). Since then the countdown warm-up moved off visible frames (#626) and the recorder splits long frames by cause (#621). **Waits on Alex's re-run on the Neo** (#620). Level 6 is the heaviest scene now (41 targets at its probe). |
| Plays on a phone | ✅ / ❓ | Smoke `mobile` shard passes on every merge. Mobile start rate without the US iPhones: 4 of 26 visitor-days since 22 Oct (W47: 1 of 2). The iPhones themselves finished 7 of 11 runs, level 6 included, so the phone path works end to end on iOS. A post with volume decides the rate. |
| First 10 seconds exciting | ✅ / ❓ | The title is now the fair's front with the park to the horizon; PLAY goes straight to the next unlocked level (#811), through a loading screen and a 10 s intro tour (#690) before Ready / Set / GO. **New question:** a 10 s tour and the countdown now sit between PLAY and the first shot; two `level_quit` at 0 % on level1 in W47 (studio phones, probably). Stranger start rate W47: 2 of 13 visitor-days (15 %; W46 21 %, W44 19 %). |
| Production smoke green | ⚠️ | Nightly red since 20 Nov (#707; three causes, each fixed on `main`, closes on the next green nightly); `main`'s CI red at 19:04 UTC today (#894). Not a launch blocker while on hold; it must be green in launch week. |
| A clip to post | ⏳ (by design) | Every committed clip predates the fair UI, the ride kit and the intro tour. Re-render in launch week only (media README policy; launch kit above). |
| Share-your-score | ✅ | #253 text share + #368 score-card image + #445 World rank on the line and the card. `share` events: 0 in W47; 2 ever, both Alex testing. Strangers' completes in W46 and W47: 3. |
| Portal build | ✅ | #251 `dist-portal.zip` + #349: kept as the `dist-portal` artifact of every green `main` CI run (README "Portal zip"). Ready to upload when Stage 2 opens. |
| Alex's own bar | ⏳ | **Ten levels "at the highest degree" (#610, 18 Nov) = M4, due 8 Jan.** Six exist; his verdicts on level 6 (#671), the Neo (#561) and the results music (#794) are pending; level 7 (#323) is in progress. This row is the gate for every post. |

## Experiment queue (ranked)

1. ~~**Referrer baseline**~~ — **done (W44, 26 Oct – 1 Nov):** 37 visitors, 43 views, 8 level
   starts (7 people), 3 completes, 100 % direct; ≈ 5 visitors and ≈ 1 start a day; 19 % of
   visitors press PLAY. This is the ruler every post is measured against.
2. **three.js Showcase post** (draft kept in the closed #102; **after M4, Alex's answer on
   #610**) — measure `requestPath = /go/showcase` and referrer `discourse.threejs.org` for 7 days;
   success = 100 visitors, ≥ 30 % start a level, ≥ 10 % complete one. Events carry
   `requestPath`, so starts and completes on `/go/showcase` are the post's own funnel.
3. **Mobile start rate** (passive, continues) — `level_start` visitors on mobile ÷ mobile
   visitors. W43: 0 of 9; W44: 1 of 9; W45: 0 of 1; W46: 2 of 5; **W47: 1 of 2 without the two
   US iPhones** → 4 of 26. Past the
   20-visitor bar and not under half of desktop's rate, so no P1 on the phone path. The first
   post's volume, and telemetry once Alex runs the migration, give the real read.
4. **r/playmygame vs r/WebGames** (text in the closed #308; the first weekend after the Showcase post has had its
   week) — same weekend, different landing paths (`/go/playmygame`, `/go/webgames`); which sub
   sends more visitors and which sends visitors who finish a level.
5. **OG card A/B** — the current HUD gameplay frame vs a titled card (game name + "free
   browser rail shooter" over the same frame); measured by click-through from the
   X/Bluesky thread (manual count).
6. **Share button use** — `share` events ÷ `level_complete`, and visitors on `/go/share`. 2 of
   28 so far, both Alex's test on 9 Nov; 0 from players (2 player completes). If it stays near
   0 over 50 real completes, the button needs a prompt (a "beat me" nudge on NEW RECORD). The
   World-rank share line (#445) is live since 14 Nov.
7. **Organic baseline without posts** (new, passive) — non-Mac visitors who start a level, and
   google.com referrals, per week. W46: 4 of 19 started (21 %), 1 search visit; **W47: 2 of 13
   (15 %, also leaving out two US iPhones), 0 search visits.** On hold this is the main series:
   visitors 37, 28, 26, 19. This is what the
   game earns by itself, and the floor every post is measured above.
8. **Portal cross-traffic** — does an itch.io / CrazyGames listing send anyone to scoaster.com
   (link in the description where allowed → `/go/itch`, `/go/crazygames`)?
9. **Paid $100** — Reddit ads, 7 days, $14/day, stop rule: < 30 visitors/day for 3 days.
10. **Time to first shot** (new, passive) — `level_quit` at `progress_pct` 0 and abandons on
   level1 among strangers, now that a first run is title → loading → 10 s intro tour → countdown.
   W47: 0 stranger quits (3 stranger starts). If strangers start leaving before the ride once
   there is volume, the tour needs a skip prompt on first run; nothing to file at n = 3.

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

- **2026-11-23 (v1.6, weekly run).** **Alex answered #610 (18 Nov): no public post "until the game
  is AAA. We need 10 levels at the highest degree."** The plan moves to a new **Hold** stage until
  M4 closes (due 8 Jan): no drafts, #308 closed (its text and #102's stay as the launch drafts'
  starting point), a launch kit table says what gets re-made in launch week. W47 = 19 visitors, 24
  views, 15 starts → 9 completes, 100 % direct, no search visit, a zero-visitor Sunday; 11 of the
  15 starts are two unflagged US iPhones that had level 6 unlocked (the studio's own, by every
  sign); strangers: 2 people, 3 starts, 1 complete (`metrics/2026-W47.md`). Readiness gate re-read:
  startup JS at its budget (436 / 436), two `agent:prod-broken` open (#707 nightly, #894 CI on
  `main`), clips stale by design, "Alex's own bar" is now the gate for everything. Pitch updated
  for the ride kit and "ten at launch"; a stray second pitch line ("Two minutes a run") removed.
  New passive experiment 10 (time to first shot, now that the intro tour sits before every run).
  **No new growth issues**: nothing on the growth side blocks M4 and every builder hour is
  better spent on levels 7–10. No spend (knob 0); the earliest paid test moves to February.

- **2026-11-16 (v1.5, weekly run).** W46 = 26 visitors, 42 views, 22 starts → 16 completes, of
  which Alex's Macs made 15 and 14; **the first players who aren't Alex: 4 people in 4 countries,
  7 starts, 2 completes** (an iPhone in Sweden), and the **first google.com visit** three days
  after Alex closed #274. Still no post. Alex's 8 Nov bar closed today (#434, #435, #436), but his
  perf report #561 (a MacBook stalling ~15 % of a run) is a new yellow on the gate ("Runs
  smoothly"). **#102 closed under the three-week rule; #610 asks what the first post waits for**
  (A after #596, recommended; B after Level 6 at his bar; C no posts). #308 refreshed (six
  worlds, a boss on every level, 60 s runs) and tied to #610. Pitch and positioning updated to six
  worlds and 60 s. Experiment 3 (mobile start rate) passed its 20-visitor bar without a P1;
  new passive experiment 7 (organic baseline: non-Mac start rate and search referrals). **No new
  growth issues**: #445 and #446 both shipped, the builders' queue is Alex's Level 6 and perf
  steering, and nothing on the growth side blocks the first post. No spend (knob 0).
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
