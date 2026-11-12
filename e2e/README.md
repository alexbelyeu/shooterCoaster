# e2e: the headless smoke test and the test hook

Moved out of CLAUDE.md (it was half of that file, which every agent loads on every turn).
Read this before you change `e2e/`, `src/testing/e2eHook.tsx`, or anything a smoke step
checks, and when a smoke failure needs more than its summary line.

## Smoke test (`npm run smoke`, `node e2e/smoke.mjs`)

Headless browser in Claude cloud sessions: the Playwright CDN is blocked, so run
`export SC_CHROME="$(scripts/ensure-browser.sh)"` once per session before `npm run smoke`.
This section is the full run (`npm run smoke`, and the nightly production smoke); a PR's CI shards run only part of it
("Two depths" below says which). The smoke test writes PNG screenshots + `results.json` (frames, draw calls,
triangles, avg frame ms, kills, score, combat stats, on-screen enemy counts/sizes, errors)
to `e2e-results/`: `title.png` and `title-2.png` 6 s later (the 3D scene behind the title UI must not look blank, polled on a cold start; the fly-by camera must have turned ≥ 8° or moved ≥ 30 units;
a title sparkle's centre pixel must blend to a colour in [0, 1] (`pointCentreColour('title-sparkles')`: a glow dividing by the distance to the point's centre went NaN there and Bloom spread it to a black frame, #344); the self-hosted Lobster and Inter faces must have loaded; the start hint must show and a key press must fade to black and open level select; the score engine's chunks (`player-*.js`, `synth-*.js`) must not be fetched before that press, and the press must load them, unlock audio and start the title score; the poster (#376): with JS off, index.html alone must show the poster's logo and load its still, and `poster.png` must not look blank behind the logo, and the title page itself is shot over and over from its first paint until the poster has gone (two shots after): no shot may look blank outside the title UI (any that does is kept as `poster-blank-<n>.png`); the title scene must fit budgets.json `scene.title`: its draw calls, the more of the two screenshots' readings, its objects and triangles; the summary line prints them and the load shots); a `landing` step loads the campaign landing path
`/go/smoke-check?e2e=1&internal=1` (links we post point at `/go/<campaign>`, attributed by the page view's path; `robots.txt` disallows `/go/`):
it must boot to the title with no failed request, no analytics request and no page error, keep its path (only `internal` stripped) and show the "internal: not tracked" marker (skipped with `--base`); and per level `<id>.png` (after a ride to `--seconds` 10 of *level time* and at least `--min-frames` 10 frames, then game time frozen for the
ride stats, the perf gate, the shot and the enemy probe; the ride stops at exactly `--seconds` of level time, timer, game clock and ride together on the frame that gets there (`stopAtLevelTime`, #487: a poll used to catch it anywhere from 10.2 to 10.7 s, and level2's enemy probe failed at 10.7); the level steps cap level time per frame (`timerStepMax`: `--seconds` / `--min-frames` on the ride, 0.25 s
in combat) and ride `--ride-rate` 0.14 s of track per second of level time (`rideRate`: CI's ride, where the budgets were set; the game rides at most
3/60 s a frame), so a slow runner samples the same moment of the level from the same track point as a fast one; through the combat checks the level timer is then held (`holdLevelTime`: the game clock runs on, the run can't time out and no wave or boss comes due) until the step ends the level itself, so however long the checks take they never run into the boss or the end of the run (#305);
it fails as a stalled render loop only if the frames haven't rendered by 4× `--seconds`, and the summary line prints `frames=N in Xs levelTime=…`; the title waits the same way),
`<id>-enemy.png` (4× close-up of the largest on-screen enemy, time frozen), `<id>-combat.png`
(after 4 s of autofire + `killNearest(5)`, with the weapon's muzzle flash + tracer and the
gold hitmarker held on the kill frame via `holdFeedback`; on the first level a primed 14-kill chain makes
that kill enter the 5× combo tier, and the shot must show the "×5 FRENZY" flash with its slow-mo held and, on the Theme Park,
the streak-15 firework burst held on screen; the kill's death effect must be live in the shot in its enemy type's style, held mid-spread, `death=<type>` in the summary; the first level then starts over, primes 5× and ends through the level timer mid-FRENZY: its results must be at `timeScale` 1 with the music not ducked, `frenzyEnd` in `results.json`; a reveal that never finishes saves `<id>-frenzy-end.png` and names every mounted results screen and its state in the failure, as the daily and phone results checks do), `<id>-shot.png` (one real shot two 40 ms
steps into its flight, time frozen), `<id>-results.png`, `<id>-share.png` (the results share menu open) and `<id>-card.png` / `<id>-card-story.png` (the score card share image, #272). A level fails if
no enemy is on screen at that probe, or fewer than min(2, on screen) are ≥ 12 px (`enemiesOnScreen` / `readable` / `largestPx` in the summary), its biome particle field isn't mounted (`particles=` in the summary), it gets no kills, a real mouse click doesn't fire, autofire never fires at on-screen
enemies, the `killNearest` hits never produce an `enemy:killed` (skipped if the
level timer already ran out), the level's boss arrives during these checks (they are the boss step's), the camera translates off the track pose at all
(kill feedback is rotation-only trauma, ≤ 1°, back to 0), the first-person weapon is off
screen / covers the centre / overlaps the HUD / points > 25° off the tracer of the frozen fixed-point shot or of a second shot on the far side of the screen without `holdFeedback` (`aimJump=`; the gun snaps to every shot) (also
checked in mobile portrait + landscape, and in portrait at four extreme aims with the combo meter showing),
the camera aspect doesn't match the canvas (±0.01), any drawn bullet's screen radius exceeds 2% of the
canvas height (also checked on the phone run), a fresh shot isn't drawn at the muzzle tip, or the results screen never finishes its
reveal (`data-sequence="done"`), lacks a stats row (kills, accuracy, best combo, time left) or the
Levels / Replay / Share buttons (inside the viewport, none overlapping, 44 px), offers Next Level while the next level is locked (or hides it while open), shows NaN, or disagrees with `stats()` on score or kills, has no local leaderboard fully inside 1280×720, or (first level) Enter with the mute button focused doesn't play on;
on the first level the leaderboard is seeded so the run places 4th: the row must open for initials at the last ones used (AAA),
ArrowUp must cycle a letter, typing r e s must give RES without leaving or toggling mute (R and S are letters there), and Enter must confirm, store
and persist it, with the board labelled This device during the entry. That run has the online board (#365) on a stubbed API (`page.route` on `/api/leaderboard`, never the real one; `onlineBoard(endpoint)`):
after Enter it must POST once (level, RES, the shown score, kills, accuracy 0..1, seed, version), fetch nothing, and turn the board to World with RES 2nd of 10 (`level1-results-world.png`);
its frenzy-end rerun is seeded a full board out of reach and must show the board with no rank and no initials entry: the World board (fetched for that level), with nothing submitted;
`shareText()` must match the share format with the shown score, stars, level name and the `/go/share` link (`share_copy` campaign); a real Share click must open the share menu (#271) with Save image focused and every target in order (Save image, Copy image, Copy link, X, Reddit, Bluesky, Threads, WhatsApp, Facebook, LinkedIn, Email; items 44 px), inside the viewport and covering no other results button, each link carrying its own `utm_campaign=share_<target>`; Copy image must show "Copied!" and put the 1200×630 PNG on the clipboard, Copy link must show "Copied!" and put `shareText()` on the clipboard, ArrowDown must move focus to Copy image, Esc must close the menu with focus back on Share (network links are never clicked), and Save image must download `shootercoaster-<id>-<score>.png` and close the menu. `scoreCard('feed' | 'story')` must draw a 1200×630 and a 1080×1920 PNG (not blank: ≥ 20 KB) named after the level and score. Every page of a local run fails on a request to another origin
(not with `--url`). `--dist <dir> --base <path>` previews another build folder under a sub-path (`smoke:portal`: the title and level 1's ride, shot and results, what a sub-path and the no-other-origin rule can break; the rest of the game is the same code the site's shards and nightly cover, #486).
`npm run smoke` also passes `--mobile`:
an iPhone 13-like touch context (390x844) taps PLAY (at its centre, `tapCentre`: its pulse never settles, so no Playwright stability wait) and a level (the title music must ramp out from full and be disposed, the level music ramp in), then in portrait and
again in 844x390 landscape taps the canvas 10x, each tap 15–30 px off an on-screen
enemy (game time frozen while tapping), and requires kills (touch aim assist); checks
camera aspect == canvas aspect in portrait, landscape and after rotating back, that the
HUD is inside the viewport with no overlap in both orientations, that the SFX node count doesn't grow across the taps and the music ducks while time is frozen (and opens again within two frames of `timeScale` 1), runs the `audioBurst` SFX stress in portrait and after rotating (every desktop level runs it too: any page error or dropped sound fails, and so do fewer than 10 of its 10 spaced kills reaching the engine, `killsPlayed`, summary `audioBurst=ok kills10/10`), and taps Pause (`mobile-level-select.png`, `mobile-level1.png`,
`mobile-level1-landscape.png`; `--skip-desktop` runs only that). **Look at the screenshots** with the Read tool — that is how you
playtest visually. Waits are polled against the frame counter because software
rendering can run at ~1 fps; tune with `--seconds`, `--combat-seconds`,
`--min-frames`, `--levels level1,level3`, `--shot-timeout <ms>` (default 120 s),
`--seed <n>` (default 1337). Every smoke run pins that run seed, so enemy spawns are the
same each time; a `seed-check` step reloads the first level and requires the same
`spawnDigest()` for the same seed and a different one for another seed. A `hidden-pause`
step fakes a tab hide (`visibilitychange`) on the first level: the run must pause, drop a
held trigger, keep `timeRemaining` still over 5 s hidden, stay paused when shown again, and
after Resume neither reset nor jump the timer, a combo primed before hiding must survive the pause, and the kills made
before it must stay (no killed enemy back); the world is frozen while paused (track fraction `rideProgress`, live enemies and
`nextWave()` unchanged over the 5 s and through Resume's Ready / GO countdown, the pause mix on), then the ride goes on from
the same spot and the next wave arrives at its original level time (slack: 1 s for the whole-second timer store plus two of the longest
frames since Resume, `maxFrameMs`); a window `blur` must pause too.
A `pause-menu` step on the same page opens the menu through the hook (`pause.png`): the card inside 1280×720 with the level
name, Resume focused, ArrowDown moves focus, Esc resumes, and Restart starts the level over (kills, score, timer, ride). The
phone run checks the card after its Pause tap in landscape and portrait (`mobile-pause-landscape.png`, `mobile-pause.png`: inside
the viewport, no sideways scroll, 44 px buttons), then taps its Settings (`mobile-settings.png`: fits 390 px, 44 px targets)
and Back to the menu, then ends the level and enters initials by tapping ▲, a letter, ▲ and OK (BBA; 44 px buttons, the pad in view: `mobile-results-entry.png`), then the results buttons must fit and not overlap in portrait and landscape
(`mobile-results.png`, `mobile-results-landscape.png`, the board inside the viewport in landscape) and the share menu must pass the same checks, bar the clipboard, in landscape and at 390 px portrait (`mobile-share-landscape.png`, `mobile-share.png`; headless Chromium has no share sheet, so the phone gets the menu); with `navigator.canShare` / `share` stubbed to take files, Share must send the sheet one 1080×1920 PNG named after the level and score with the line and the `share_image_native` link, and open no menu (#272); then starts level2 and goes back to level select: on every music
switch (there, title → level, and the `audio` step's) the incoming track's first note must land before the outgoing bus has
faded to 0 (`audio().music.fades` log each ramp's start and the incoming `firstNote`; tracks start on the next beat, `musicBus.ts`).
A `settings` step opens Settings from the title (`settings.png`: the card inside 1280×720 with the four quality
options, two volume sliders and two switches), picks Low and a music volume, closes with Esc, and requires both
to survive a reload. A `quality` step loads the first level at device dpr 2 with the default quality and with
`?quality=low` (any preset name works as a URL override and is saved like the setting) on the same seed and frozen
track point: low must render at dpr 1 with no contact shadows and fewer draw calls (`<id>-low.png`).
A `levelSelect` step seeds saved progress (3★ + 1★) and leaderboards, reloads the page, opens the level select (`levelSelect.png`)
and requires one card per level plus the Daily card, each top's initials on its card after the reload, the right locked count and `★ x / 15` total, every card
inside 1280×720 with no sideways scroll, and keyboard-only play (arrows move focus, Enter on a
locked card does nothing, Enter on an open one plays the launch transition and starts that level);
the phone run checks its cards fit 390 px.
A `daily` step (two fresh pages, no `?seed=`) clicks the Daily card: the run must be today's `daily()` level and seed in
daily mode, a second load must give the same `spawnDigest()`, the results must show the Daily badge, NEW BEST, no Next Level and no leaderboard or initials entry (the campaign boards stay empty)
(`daily-results.png`; its score cards `daily-card.png` / `daily-card-story.png` carry the Daily badge and date), save today's best and a 1-day streak without changing the campaign saves, and Replay must keep the seed.
`?e2e=1` skips the Ready / Set / GO countdown (runs start in `playing`); a `countdown` step
loads the first level with `?e2e=1&countdown=1`: the countdown must show (`countdown.png`),
a press during it must fire nothing (also when held on into `playing`), the timer must hold, a replay tap after 1 s (Ready held by `holdFeedback`) skips to `playing`,
and the shader warm-up must finish (and leaving a level mid-warm-up must log no error); after it, the first shot + kill must compile no new shader program
(`programs()`; the longest frame is reported). The step also prints the startup timings (`initTimings()`: boot, first title
frame and PLAY from navigation; level mounted, env baked, warm-up done and first `playing` frame from the run's start) and writes
them to `results.json` (`initTimings` on the `countdown` entry); no thresholds, software GL. A `speed` step holds the first level (or `--speed-level <id>`) at top speed on the most
banked of ten sampled track points: the wind streaks must show and the camera must bank ≥ 1° (`speed.png`).
When level2 is in the run, a `wave` step rides it to the crow wave: its `wave:incoming` tell (screen-edge pulse +
label) must come before the wave, on time by the level timer (`waveTellSeconds` ahead; the timer steps a fixed 0.25 s a frame
around it, `timerStep`, so a slow frame can't land both together), the run is paused and resumed in between (the level timer is held on the tick the tell fires, so the pause lands in the gap on any runner, and the step fails if the wave came before the pause; no tell or wave may fire twice), then the V flies in and is frozen for `level2-wave.png` (≥ 5 crows on screen, none within 40 units).
When level1 is in the run, an `audio` step plays its sound from the title on (the score engine and the arcade SFX, the game's only engine since #416): a click must unlock audio and start the
title score, the level score must crossfade from it, keep its long-lived node count flat (≤ 150) and advance, run `audioBurst(64, 32)`
on the arcade SFX twice (never more voices than the budget, voices stolen, SFX node count flat, nothing thrown or dropped), duck with time frozen,
follow the combo with its intensity layers (time frozen, `primeCombo(8)` → 2, `primeCombo(15)` → 3, held through the pause, `primeCombo(0)`
→ back to 0 through 2 or 1, not in one cut), hold its song position while paused and resume there, then crossfade to the results score, with no page errors or dropped sounds.
When level1 is in the run, a `boss` step summons the Golden Blimp (`summonBoss()`): the tell and `boss:spawn` must fire, the
hull must be ≥ 15% of the frame wide with the boss bar clear of the HUD (`level1-boss.png`), only the balloons exposed; a real
bullet must hit one, `bossHit` clears them and must expose only the gondola (`level1-boss-gondola.png`), then defeat it:
`boss:defeated`, one kill per weak point and the big score popup over the confetti (`level1-boss-down.png`). The phone run
resumes after its Pause tap with the boss summoned: the bar must sit inside the viewport and clear of the HUD in portrait and
landscape (`mobile-level1-boss.png`).
When level2 is in the run, the same `boss` step summons the Giant Scorpion: after 2 s of game time (it bursts out of the sand)
≥ 4 of its claws and tail segments must be on screen (`level2-boss.png`, only those exposed), and once they are broken only the
stinger on the bare stub (`level2-boss-stinger.png`) before it collapses into the sand (`level2-boss-down.png`).
When level3 is in the run, the same `boss` step summons the Kraken: after 3 s of game time ≥ 3 sucker pads must be on screen
above the water (`level3-boss.png`, only pads exposed), and after the pads go the head must surface with only its eye exposed
(`level3-boss-head.png`) before the eye is shot and it sinks in a splash (`level3-boss-down.png`).
When level4 is in the run, the same `boss` step summons the Yeti: after 4 s of game time (it climbs its ridge, roars and
throws) both fists must be on screen and ≥ 1 snowball in flight (`level4-boss.png`, only the fists exposed; `boss().projectiles`).
`projectileHit()` then shoots every live snowball: one kill and one combo step each, the boss's hp unchanged (they are left out
of the per-weak-point kill count). Once the fists are broken it roars at once and only its chest is exposed
(`level4-boss-chest.png`; between roars the chest is retracted) before it topples backwards into the snow (`level4-boss-down.png`).
Every boss must fit its fight window (#452: the boss arrives at 40 s of the 60 s run): the game seconds it moved before
each phase was on screen plus every weak point's hp at 2 hits a second must be ≤ 20 s (`fight` on the summary line).
When level1 is in the run, a `pickup` step checks its 2–4 weapon pickups (`pickups()`), parks the coaster behind the first
(spread) with time frozen and shoots it with a real bullet: `weaponState()` must report the spread gun, the next pull must
count 3 shots and draw 3 bullets, and `level1-pickup.png` holds the tinted tracer with the `.hud-weapon` badge clear of the HUD;
the pickup must hold through a pause, expire on game time, and a restart must bring back the blaster and every pickup.
A `pacing` step (#450) rides every level's whole run, GO to the end, on a fixed `timerStep` of `--pacing-step` level seconds a
frame (default 0.5, so the run is the same on any runner; `rideRate` 1, the ride a 60 fps player gets), with no firing and the
level time never held. Every frame the page records level time, `stats().onScreenEnemies` (shootable targets inside the
viewport: enemies, boss weak points, projectiles; never pickups), `rideProgress` and whether a wave tell (the 1 s before a
wave) or the boss tell is on. Pure `pacingMetric.mjs` (`pacingMetric.test.ts`) turns that into `noTargetShare` (share of
the run with nothing on screen) and the gaps (`longestGapSeconds`, `longestGap` with its start time and track fraction,
`gaps` of 1 s or more); the first 2 s after GO and the boss tell are meant to be empty, so they count neither way and end a
gap. It prints one line per level (`level2 pacing: no target 7% of 60 s, longest gap 2.0 s at 4 s (track 0.03)`) and
writes `e2e-results/pacing.json`: those metrics per level plus a `timeline`, one row a level second (`t`, fewest and most
targets on screen `min` / `max`, `track`, `waveTell`, `bossTell`), which is where to look for where a gap is. A level over
its `budgets.json` `pacing` ceilings (`longestGapSeconds`, `noTargetShare`) fails with the gap named (`longest gap 9.0 s at
7.0 s (track 0.03) over budget 3 s`); only the Director lowers or raises them. A level takes its run length in frames
(150 frames for 75 s; ~2.5 min in a 2-core session), so run one at a time: `--steps pacing --levels level4`.
`drawCalls`/`triangles` depend on where the camera happens to be (frustum culling,
spawned enemies) and vary run to run; for before/after comparisons use the
camera-independent `scene` totals the smoke also prints (`track objs/tris` = objects
named `track*`; `env=` is the baked sky env map's intensity and bake time; a level
without `scene.environment` fails).
**Perf gate:** sampled with the ride stats at `--seconds` of level time (the scene totals count every visible mesh, enemies included,
so a later moment has more waves on screen). `budgets.json` `scene` holds per-level ceilings on the ride screenshot's draw calls (+20% headroom, since they
vary) and on the scene / track objects and triangles (+15%); a level past one fails with `over budget: scene objs=560 (budget 551)`
(`perfGate` in `results.json`). A level whose entry has `knownOver: "#<open issue>"` only prints a WARN line until that issue lands
(then drop the key). `--no-perf-gate` skips the gate for local experiments. Ceilings are budgets: only the Director raises them.

## Steps, shards and the time budget (`e2e/shards.mjs`, #353)

Every check above belongs to a named step: `title`, `landing`, `levelSelect`, `daily`, `settings`, `mobile` (the phone
run's touch play: taps, aim assist, aspect, HUD, audio, up to the Pause tap) and `mobileMenus` (the rest of the phone run on
the same page: pause card, settings, boss bar, initials entry, results, share, music switches) (no level); `frenzy` (the
first level's FRENZY kill, leaderboard entry and frenzy-end rerun, inside its ride), `seed`, `quality`, `pause`
(hidden-pause + pause menu), `countdown`, `speed` (on the run's first level); `ride` (every level: the ride, the perf
gate, the enemy probe, combat, the level's end), on the ride's own page `shot` (the frozen fresh shot and aim jump),
`results` (the results screen's reveal, stats, buttons, board) and `share` (its Share line, menu and score cards); and
`pacing` (every level, a whole run on its own page) and `wave`, `boss`, `pickup`, `audio` (only on the levels in `STEP_LEVELS`; the smoke fails at start if that table and its
checks disagree). A step that runs on another's page needs it in the same run (`share` and `frenzy` need `ride` and
`results`, `mobileMenus` needs `mobile`). `--steps ride,boss --levels level2` runs just those. Without `--steps` every
desktop step runs, plus `mobile` and `mobileMenus` with `--mobile`; `--skip-desktop` leaves `title` and the phone run.

**Two depths (#372).** The PR smoke is rendering and integration: CI runs the shards in `SHARDS`, one `smoke (<name>)`
job each (`ci.yml` matrix): `ui` (title, landing), `menus` (levelSelect, settings), `level1` (ride, shot, results), `level1-steps`
(quality, speed), `level2`…`level5` (ride) and `mobile`. The **deep** checks, everything else (`nightlyOnly()` in
`shards.mjs`: daily, frenzy, seed, pause, countdown, wave, boss, pickup, audio, share, pacing, `mobileMenus`, and shot / results
on levels 2–5), run in the full smoke, which the nightly production run makes (`prod-smoke.yml`, below): they are either
game logic a unit test covers next to its pure module (the table below), or a browser check too slow for every PR. A red
nightly opens the `agent:prod-broken` P1 issue the Maintainer takes first. To reproduce one, run its step:
`node e2e/smoke.mjs --steps ride,results,frenzy --levels level1`, `--steps boss --levels level2`, `--mobile --skip-desktop`.
`node e2e/smoke.mjs --shard <name>` runs one PR shard exactly as CI does. `shards.test.ts` checks that the shards run part
of the full run, each step once, that they and `nightlyOnly()` together make all of it, that every registry level is
ridden on the PR, that the nightly job runs the full smoke, and that the shards, the `ci.yml` matrix and `budgets.json`
`smokeSeconds` list the same names.

| Nightly-only step | Logic a unit test covers | Browser-only part (nightly) |
|---|---|---|
| `daily` | `levels/daily.test.ts` (key, seed, level, streak), `useGameStore.test.ts` "daily runs" (date seed, Replay keeps it, saves apart from the campaign) | the Daily card flow and results badge |
| `frenzy` | `comboTiers.test.ts`, `comboRuntime.test.ts` (5×, slow-mo, `endFrenzy` → 1), `fireworks.test.ts`, `leaderboard.test.ts`, `initialsEntry.test.ts`, `onlineLeaderboard.test.ts`, `api/_lib/handler.test.ts` | the FRENZY flash and firework on screen, initials typed into the board |
| `seed` | `spawnPlacement.test.ts` (deterministic per seed, differs between seeds), `utils/rng.test.ts` | the same digest after a reload |
| `pause` | `waveSchedule.test.ts` (#152, #198), `useGameStore.test.ts` "pause and resume", "combo" (ignores the wall clock), `pauseMenu.test.ts` | tab hide / blur, the pause card |
| `countdown` | `startPhase.test.ts`, `programReadiness.test.ts`, `startupMarks.test.ts` | Ready / Set / GO over the warm-up, no new shader on the first shot |
| `wave` | `waveSchedule.test.ts` (tell 1 s early, on time, no replay after a pause), `spawnPlacement.test.ts` (the V) | the V of crows on screen |
| `boss` | `bossModel.test.ts`, `krakenMotion.test.ts`, `scorpionMotion.test.ts` (the `turntable` workflow draws every boss on PRs touching `src/entities/`) | the full fights |
| `pickup` | `weaponTypes.test.ts`, `pickupPlacement.test.ts`, `useGameStore.test.ts` (a run starts with the blaster) | the shot pickup, fan and badge |
| `audio` | `src/audio/scrim/*.test.ts` (layers, scheduler, score), `arcade.test.ts`, `AudioEngine.test.ts` | the score engine and arcade SFX in a page |
| `pacing` | `pacingMetric.test.ts` (share, longest gap, the GO grace and boss tell left out, the budget lines) | the whole run of every level, sampled |
| `share` | `share.test.ts`, `scoreCard.test.ts`, `popoverPlacement.test.ts` | the menu, clipboard, download |
| `mobileMenus` | `pauseMenu.test.ts`, `initialsEntry.test.ts`, `share.test.ts` | phone layouts of the menus |

Each results entry records its wall time (`seconds`). A `--shard` run ends with a `time` line and entry (`level3 shard
took 4.2 min, budget 7.0`) and a GitHub annotation of the same text (pure rules in `shardTime.mjs`). A shard's
allowance is its `smokeSeconds` budget, scaled up on a slow runner (#394): CI runners differ ~2x in speed and a level
shard's time follows how fast its ride rendered, so the budget is multiplied by the ride's wall ms per frame
(`rideMsPerFrame` in its results entry) over a normal runner's 300 ms, capped at 2x; a shard on a normal-speed runner,
or with no ride (`ui`, `menus`, `mobile`, `level1-steps`), keeps its plain budget. Over the budget is a **warning**, not a
failure (#487: shared runners swing ±60%, and runs failed by seconds with every check green): a warning annotation and
the time entry's `level: 'warning'` in `results.json` (`… budget 3.0: over, within what a slow runner (ride 525 ms/frame,
1.8x normal) allows 5.3`, or `… budget 2.0: over, fails past 3.0`). On CI (`CI` set) a shard fails only past 1.5x its
allowance (`FAIL_FACTOR`, `failsAt` in the entry); a slow creep under that is the watchdog's `creep:` finding. One still
running at 3.45x its budget writes `results.json` with what ran and exits (`still running after …: stopped`), inside
the job's timeout; locally it only warns, since a 2-core session is slower than a CI runner. Budgets, the normal
runner's ms per frame, the 2x cap and the 1.5x fail line: only the Director changes them.

CI's required `verify` check is a gate job that needs `changes`, `unit + build`, `lighthouse` and every shard, and passes only if
all of them passed or were skipped by the plan. GitHub creates its check run only when those end, so `scripts/automerge.cjs` and
`scripts/studio-status.cjs` read the running jobs before it as "verify waiting".

Only what a PR can break runs (#371). The first job, `changes`, plans the run from the PR's files with pure
`scripts/ciPlan.cjs` (its rules, unit-tested in `ciPlan.test.ts`): a docs-only PR (the watchdog's `isDocsOnly` in
`scripts/studioHealthRules.cjs`: `docs/` but `docs/audio/`, `.claude/agents|commands/`, any `*.md`) skips `lighthouse` and
every `smoke (<shard>)`, and `unit + build` too unless it touched `scripts/`; `verify` still runs and passes in a minute or two.
Any other PR runs the full gate. `portal` (the portal build smoked under `/nested/path/`) runs only on a PR touching
`vite.config.ts`, `index.html`, `public/`, `scripts/portal/`, `package*.json` or `ci.yml`, on a hand-started run, and in the
nightly run on `main` (`schedule`, the full gate plus `portal`, its own concurrency group). Merges to `main` run the full gate
without `portal`.

## Production (`.github/workflows/prod-smoke.yml`, #352)

Two suites watch https://scoaster.com, each under GNU `timeout` (exit 124 = it hit its cap):

- **Deploy health check** after every production deploy (`deployment_status`, 8 min cap, ~3 min): `npm run prod-check -- --url <site>`
  (`e2e/prod-check.mjs`). The full smoke already passed in `verify` on the deployed commit; this asks whether the deploy
  arrived intact. It needs a local build of that commit (CI: `VERCEL=1 npx vite build`) for the list of files to expect.
  `assets`: every file of `dist/` outside `assets/` at its path, and every hashed chunk under its deployed name (matched by
  name without the hash; the deployed names come from crawling the deployed page, stylesheet and chunks, so the lazy
  scrim / arcade chunks are found through the entry chunk's dep map), each 200 with its content type and the headers
  `vercel.json` sets (`scripts/vercelRoutes.mjs`: hashed `assets/` a year `immutable`, nothing else cached a day or more);
  `routes`: `/go/prod-check` is the game page, an unknown path a real 404 with `404.html`, `GET /api/leaderboard?level=level1` the CDN-cached top 10 (on a 200 it GETs again 3 s later and wants `x-vercel-cache: HIT` / `STALE`, since Vercel's CDN strips `s-maxage` from what clients see, #397) or, while the board is unavailable (no env vars, a paused project; always when serving dist/ locally), a bare uncached 503, never a 500, a 404 or a leak; `title`: boots with no page error
  or failed same-origin request, the 3D scene not blank (`prod-title.png`); `level`: level1 rides, a real click fires,
  `killNearest(3)` reaches `enemy:killed` (`prod-level.png`); `phone`: iPhone 13 portrait, tap PLAY, tap the level1 card,
  3 taps at enemies fire, a kill (`prod-phone.png`). Rules in pure `scripts/prodCheckRules.mjs`. Writes `prod-check.json`
  (`checks`, `running`, `finished`) after every check, so a run stopped at its cap still says where it was. Without
  `--url` it serves `--dist` (default `dist/`) on localhost the way `vercel.json` says Vercel would, for local runs.
  Back-to-back deploys: the job's concurrency group cancels the older run, which reports nothing.
- **Nightly full smoke** (06:00 UTC, 60 min cap): `node e2e/smoke.mjs --mobile --url <site> --seconds 10`: every step on
  every level, so it is also where the deep checks the PR shards leave out run (#372, "Two depths" above).

`scripts/prod-alert.cjs` reports both: one `agent:prod-broken` issue per suite (marked `<!-- prod-smoke:<suite> -->`),
opened on a green → red transition with the failed checks (or "timed out after N min, no check failed"), silent while it
stays open, commented on and closed by the next green run of that suite. CI's red-`main` issue is separate. Manual runs:
Actions → Production smoke → `suite` (deploy / nightly), `dry_run` to open or close nothing.


## Test hook (`?e2e=1` → `window.__SC_TEST__`)

Test hook: load the game with `?e2e=1` and use `window.__SC_TEST__`
(`levels()` (each with its `maxScore`, `nextLevel` and `unlocked` now), `startLevel(id, seed?)`, `primeCombo(n)` (live chain of n kills, last one now), `setPhase(phase)`, `setSavedScores(scores)`, `setLeaderboards(boards, lastInitials?)` / `leaderboards()` (local top 10s), `onlineBoard(endpoint | null)` (the results screen's online board on that endpoint, for a stubbed API; null is off, as every `?e2e=1` page starts), `daily()` (today's UTC key, seed, level; the run's mode, saved daily bests, streak), `shareText()` (what the results Share button sends for the current level + score), `scoreCard(size)` (the results share image for the current run, `feed` or `story`: pixel size, PNG data URL, file name), `spawnDigest()` → hash of the run's spawn positions (formation members: their seeded slots), `waveEvents` (every `wave:incoming` / `wave:announce` with its time, level time, due wave and the wave tick before it), `nextWave()` → level time now + when the next wave is due + the last wave tick, `waveTellSeconds`, `timerStep` (seconds of level time + game clock per frame; null is the frame time), `timerStepMax` (a cap on that per frame: slower frames count as this much; null is none), `rideRate` (seconds of ride per second of level time; null rides the frame time), `titleTime` (seconds since the title appeared, held: the title camera stays at that pose; null runs it; `npm run og -- --poster` renders the posters with it), `titleAttractIdleMs` (idle ms before the title's attract mode, #419; null, as every `?e2e=1` page starts, never enters it; `npm run clip -- --title --attract` sets 0), `holdLevelTime` (true holds the level timer, so no time runs out and no wave or boss comes due, while the game clock, enemies, effects and combo keep running), `frames`, `drawCalls`, `triangles`, `avgFrameMs`, `maxFrameMs` (longest frame since a test set it to 0), `programs()` (compiled shader programs), `cameraPose()` (position + view direction), `pointCentreColour(name)` (the linear RGBA a scene `Points`' first point blends to over opaque grey with its centre exactly on a pixel centre, in a 1×1 float target),
`errors`, `phase()`, `enemies()` → on-screen enemies with projected px, `stats()` → score/kills/combo/multiplier/timeScale/frenzy/timeRemaining/phase/liveEnemies/
onScreenEnemies/shotsFired/hits/bestCombo/runSeed/currentLevel, `autoFire(on)`, `killNearest(n)` (never a boss weak point; fires one real shot,
then resolves hits via `processHit`, the bullet pool's own path), `enemyScreenPoints(n)`,
`fireShot(x, y)` (one real shot through NDC), `bullets()` → drawn count, largest screen radius now / since load, newest bullet's
screen point, `bulletStep` (seconds per frame for every live bullet; 0 freezes them), `endLevel()`, `setTimeScale(s)`, `rideTo` (set a track fraction 0–1 to jump the coaster there), `rideProgress` (its track fraction on the last frame), `rideSpeed` (set 0–1 to put the coaster at that speed), `sceneStats()`, `combat` fire/hit/kill event counters,
`cameraTranslation` {current, max} = translation off the track pose (must be 0), `cameraTrauma`
{current, max} in degrees, `cameraWeight` → bank / pitch / speed + drop FOV kick now and max (degrees), smoothed speed 0–1, wind-streak opacity, the caps the smoke checks (`caps`, from the source constants), `weapon` → the gun's on-screen box, pivot, muzzle tip + last shot point, `holdFeedback`,
`view()` → camera vs canvas aspect + FOV, drawing-buffer size + dpr, `graphics()` → quality setting, its preset, adaptive steps, reduced motion, `audio()` → unlocked?, score engine chunk loaded? (`engineLoaded`; the title step fails it before the first key press), long-lived SFX node count, arcade voice pool (`sfxVoices`: budget / live / peak / stolen / dropped), music ducked?, sounds dropped by a caught audio error, `music` (live music buses with their gain + the last few fade ramps), `scrim` (score engine: current score, tracks with the score each plays (a `?theme=` option or its own), paused + song position + `layered` / `intensity`, the asked-for `targetIntensity`, long-lived nodes, timer running),
`audioBurst(shots, kills)` → rapid SFX in one JS turn while the audio clock ticks (every gun, kills spaced 35 ms apart on the audio clock; returns `killsPlayed`, the kills that reached the engine), `renderAudio(req, seed?)` → an offline render as base64 PCM (title screen, before audio unlocks; `npm run audio:render`; kinds music / sfxSheet / mix (`stem: 'music'`: without SFX), and `score` for one score through the port alone), `triggerHeld()` → pointer trigger down?,
`shaderWarmup` {done, ms, programs} for the current level, `initTimings()` (ms from navigation to each startup phase, the first time: `core/startupMarks.ts`), `summonBoss()` (the level's boss now instead of at its level time),
`boss()` → stage / hp fraction / exposed weak points on screen (with hp) / the hull's on-screen box / live projectiles on screen, `bossHit(n)` (n hits on exposed
weak points through `processHit`), `projectileHit()` (one hit on each live boss projectile, `boss-projectile:` targets), `bossEvents` spawn/hit/defeated counters, `fireworks()` → mounted?, launches / bursts, live rockets / bursts and the newest burst on screen, `deaths()` → death effects spawned / live, the newest one's style and origin on screen, `particles()` → the biome particle field: mounted?, points, boost-only points, boost strength now, `weaponState()` → active gun, pickup id + remaining fraction, `pickups()` → the level's weapon pickups: id, track fraction, collected?, screen point). See `src/testing/e2eHook.tsx`. Extend it when you need new test
surfaces. Bullets travel per *second* with a swept hit test (`combat/projectiles/bulletMotion.ts`) along the camera ray;
they are *drawn* from the gun's muzzle into that ray, capped to 1.5% of the canvas height on screen (`bulletVisual.ts`),
but enemies and the camera still move a lot during one ~1 fps headless frame, so
autofire only sometimes lands hits — `killNearest` is what guarantees kills.
The coaster camera sets its own aspect/FOV from the canvas size (`track/cameraFov.ts`:
portrait screens get a wider vertical FOV, plus a few degrees with speed and on steep drops) and has rotation-only
weight (`track/cameraRig.ts`: look-ahead into curves, bank into turns, pitch with speed changes;
bank, pitch and the FOV kick scale with the Screen-shake setting, and the smoke fails past their caps).
Above ~70% of top speed, camera-space wind streaks fade in (`track/WindStreaks.tsx`, numbers in `windStreaks.ts`;
one draw call, hidden when slow, also scaled by Screen shake); touch shots get aim assist (`combat/aimAssist.ts`).
`npm run clip` drives the same hook in virtual time (`scripts/clip.mjs`: Playwright's fake clock plus a page
`requestAnimationFrame` that runs only when the script asks), so each captured frame is exactly 1/30 s of
game time for every consumer (R3F, timers, framer-motion) however slowly software GL draws it; no game code is involved.
A portrait `--size` (e.g. `720x1280`) emulates touch, so the clip shows the phone layout; `--ride-only` plays the title
and level select uncaptured, so the clip opens on the ride.
