# e2e: the headless smoke test and the test hook

Moved out of CLAUDE.md (it was half of that file, which every agent loads on every turn).
Read this before you change `e2e/`, `src/testing/e2eHook.tsx`, or anything a smoke step
checks, and when a smoke failure needs more than its summary line.

## Smoke test (`npm run smoke`, `node e2e/smoke.mjs`)

Headless browser in Claude cloud sessions: the Playwright CDN is blocked, so run
`export SC_CHROME="$(scripts/ensure-browser.sh)"` once per session before `npm run smoke`.
The smoke test writes PNG screenshots + `results.json` (frames, draw calls,
triangles, avg frame ms, kills, score, combat stats, on-screen enemy counts/sizes, errors)
to `e2e-results/`: `title.png` and `title-2.png` 6 s later (the 3D scene behind the title UI must not look blank, polled on a cold start; the fly-by camera must have turned ≥ 8° or moved ≥ 30 units;
the self-hosted Lobster and Inter faces must have loaded; the start hint must show and a key press must fade to black and open level select; Tone.js's `tone-*.js` chunk must not be fetched before that press, and the press must load it and unlock audio); a `landing` step loads the campaign landing path
`/go/smoke-check?e2e=1&internal=1` (links we post point at `/go/<campaign>`, attributed by the page view's path; `robots.txt` disallows `/go/`):
it must boot to the title with no failed request, no analytics request and no page error, keep its path (only `internal` stripped) and show the "internal: not tracked" marker (skipped with `--base`); and per level `<id>.png` (after a ride of `--seconds` 10, longer until `--min-frames` 10 frames have rendered; it fails as a stalled render loop only if they haven't by 4× `--seconds`, and the summary line prints `frames=N in Xs`; the title waits the same way),
`<id>-enemy.png` (4× close-up of the largest on-screen enemy, time frozen), `<id>-combat.png`
(after 4 s of autofire + `killNearest(5)`, with the weapon's muzzle flash + tracer and the
gold hitmarker held on the kill frame via `holdFeedback`; on the first level a primed 14-kill chain makes
that kill enter the 5× combo tier, and the shot must show the "×5 FRENZY" flash with its slow-mo held and, on the Theme Park,
the streak-15 firework burst held on screen; the kill's death effect must be live in the shot in its enemy type's style, held mid-spread, `death=<type>` in the summary; the first level then starts over, primes 5× and ends through the level timer mid-FRENZY: its results must be at `timeScale` 1 with the music not ducked, `frenzyEnd` in `results.json`), `<id>-shot.png` (one real shot two 40 ms
steps into its flight, time frozen) and `<id>-results.png`. A level fails if
fewer than 2 enemies are ≥ 12 px on screen right after the ride (`enemiesOnScreen` / `readable` / `largestPx` in the summary), its biome particle field isn't mounted (`particles=` in the summary), it gets no kills, a real mouse click doesn't fire, autofire never fires at on-screen
enemies, the `killNearest` hits never produce an `enemy:killed` (skipped if the
wall-clock level timer already ran out), the camera translates off the track pose at all
(kill feedback is rotation-only trauma, ≤ 1°, back to 0), the first-person weapon is off
screen / covers the centre / overlaps the HUD / points > 25° off the tracer of the frozen fixed-point shot or of a second shot on the far side of the screen without `holdFeedback` (`aimJump=`; the gun snaps to every shot) (also
checked in mobile portrait + landscape, and in portrait at four extreme aims with the combo meter showing),
the camera aspect doesn't match the canvas (±0.01), any drawn bullet's screen radius exceeds 2% of the
canvas height (also checked on the phone run), a fresh shot isn't drawn at the muzzle tip, or the results screen never finishes its
reveal (`data-sequence="done"`), lacks a stats row (kills, accuracy, best combo, time left) or the
Levels / Replay / Share buttons (inside the viewport, none overlapping, 44 px), offers Next Level while the next level is locked (or hides it while open), shows NaN, or disagrees with `stats()` on score or kills, or (first level) Enter with the mute button focused doesn't play on;
`shareText()` must match the share format with the shown score, stars, level name and the `/go/share` link, and a real Share click must show "Copied!" and put that text on the clipboard. Every page of a local run fails on a request to another origin
(not with `--url`). `--dist <dir> --base <path>` previews another build folder under a sub-path (`smoke:portal`).
`npm run smoke` also passes `--mobile`:
an iPhone 13-like touch context (390x844) taps PLAY and a level (the title music must ramp out from full and be disposed, the level music ramp in), then in portrait and
again in 844x390 landscape taps the canvas 10x, each tap 15–30 px off an on-screen
enemy (game time frozen while tapping), and requires kills (touch aim assist); checks
camera aspect == canvas aspect in portrait, landscape and after rotating back, that the
HUD is inside the viewport with no overlap in both orientations, that the SFX node count doesn't grow across the taps and the music ducks while time is frozen, runs the `audioBurst` Tone scheduling stress in portrait and after rotating (every desktop level runs it too: any page error, late note that throws or dropped sound fails, and so do fewer than 10 of its 10 spaced kills reaching the engine, `killsPlayed`, summary `audioBurst=ok kills10/10`), and taps Pause (`mobile-level-select.png`, `mobile-level1.png`,
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
the same spot and the next wave arrives at its original level time; a window `blur` must pause too.
A `pause-menu` step on the same page opens the menu through the hook (`pause.png`): the card inside 1280×720 with the level
name, Resume focused, ArrowDown moves focus, Esc resumes, and Restart starts the level over (kills, score, timer, ride). The
phone run checks the card after its Pause tap in landscape and portrait (`mobile-pause-landscape.png`, `mobile-pause.png`: inside
the viewport, no sideways scroll, 44 px buttons), then taps its Settings (`mobile-settings.png`: fits 390 px, 44 px targets)
and Back to the menu, then ends the level: the results buttons must fit and not overlap in portrait and landscape
(`mobile-results.png`, `mobile-results-landscape.png`), then starts level2 and goes back to level select: on every music
switch (there, title → level, and the `scrim` step's) the incoming track's first note must land before the outgoing bus has
faded to 0 (`audio().music.fades` log each ramp's start and the incoming `firstNote`; tracks start on the next beat, `musicBus.ts`).
A `settings` step opens Settings from the title (`settings.png`: the card inside 1280×720 with the four quality
options, two volume sliders and two switches), picks Low and a music volume, closes with Esc, and requires both
to survive a reload. A `quality` step loads the first level at device dpr 2 with the default quality and with
`?quality=low` (any preset name works as a URL override and is saved like the setting) on the same seed and frozen
track point: low must render at dpr 1 with no contact shadows and fewer draw calls (`<id>-low.png`).
A `levelSelect` step seeds saved progress (3★ + 1★), opens the level select (`levelSelect.png`)
and requires one card per level plus the Daily card, the right locked count and `★ x / 15` total, every card
inside 1280×720 with no sideways scroll, and keyboard-only play (arrows move focus, Enter on a
locked card does nothing, Enter on an open one plays the launch transition and starts that level);
the phone run checks its cards fit 390 px.
A `daily` step (two fresh pages, no `?seed=`) clicks the Daily card: the run must be today's `daily()` level and seed in
daily mode, a second load must give the same `spawnDigest()`, the results must show the Daily badge, NEW BEST and no Next Level
(`daily-results.png`), save today's best and a 1-day streak without changing the campaign saves, and Replay must keep the seed.
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
around it, `timerStep`, so a slow frame can't land both together), the run is paused and resumed in between (no tell or wave may fire twice), then the V flies in and is frozen for `level2-wave.png` (≥ 5 crows on screen, none within 40 units).
When level1 is in the run, a `scrim` step loads it with `?audio=scrim` (the score engine): a click must unlock audio and start the
title score, the level score must crossfade from it, keep its long-lived node count flat (≤ 150) and advance, run `audioBurst(64, 32)`
on the arcade SFX twice (never more voices than the budget, voices stolen, SFX node count flat, nothing thrown or dropped), duck with time frozen,
hold its song position while paused and resume there, then crossfade to the results score, with no page errors or dropped sounds.
When level1 is in the run, a `boss` step summons the Golden Blimp (`summonBoss()`): the tell and `boss:spawn` must fire, the
hull must be ≥ 15% of the frame wide with the boss bar clear of the HUD (`level1-boss.png`), only the balloons exposed; a real
bullet must hit one, `bossHit` clears them and must expose only the gondola (`level1-boss-gondola.png`), then defeat it:
`boss:defeated`, one kill per weak point and the big score popup over the confetti (`level1-boss-down.png`). The phone run
resumes after its Pause tap with the boss summoned: the bar must sit inside the viewport and clear of the HUD in portrait and
landscape (`mobile-level1-boss.png`).
When level3 is in the run, the same `boss` step summons the Kraken: after 3 s of game time ≥ 3 sucker pads must be on screen
above the water (`level3-boss.png`, only pads exposed), and after the pads go the head must surface with only its eye exposed
(`level3-boss-head.png`) before the eye is shot and it sinks in a splash (`level3-boss-down.png`).
When level1 is in the run, a `pickup` step checks its 2–4 weapon pickups (`pickups()`), parks the coaster behind the first
(spread) with time frozen and shoots it with a real bullet: `weaponState()` must report the spread gun, the next pull must
count 3 shots and draw 3 bullets, and `level1-pickup.png` holds the tinted tracer with the `.hud-weapon` badge clear of the HUD;
the pickup must hold through a pause, expire on game time, and a restart must bring back the blaster and every pickup.
`drawCalls`/`triangles` depend on where the camera happens to be (frustum culling,
spawned enemies) and vary run to run; for before/after comparisons use the
camera-independent `scene` totals the smoke also prints (`track objs/tris` = objects
named `track*`; `env=` is the baked sky env map's intensity and bake time; a level
without `scene.environment` fails).
**Perf gate:** `budgets.json` `scene` holds per-level ceilings on the ride screenshot's draw calls (+20% headroom, since they
vary) and on the scene / track objects and triangles (+15%); a level past one fails with `over budget: scene objs=560 (budget 551)`
(`perfGate` in `results.json`). A level whose entry has `knownOver: "#<open issue>"` only prints a WARN line until that issue lands
(then drop the key). `--no-perf-gate` skips the gate for local experiments. Ceilings are budgets: only the Director raises them.


## Test hook (`?e2e=1` → `window.__SC_TEST__`)

Test hook: load the game with `?e2e=1` and use `window.__SC_TEST__`
(`levels()` (each with its `nextLevel` and `unlocked` now), `startLevel(id, seed?)`, `primeCombo(n)` (live chain of n kills, last one now), `setPhase(phase)`, `setSavedScores(scores)`, `daily()` (today's UTC key, seed, level; the run's mode, saved daily bests, streak), `shareText()` (what the results Share button sends for the current level + score), `spawnDigest()` → hash of the run's spawn positions (formation members: their seeded slots), `waveEvents` (every `wave:incoming` / `wave:announce` with its time, level time, due wave and the wave tick before it), `nextWave()` → level time now + when the next wave is due + the last wave tick, `waveTellSeconds`, `timerStep` (seconds of level time + game clock per frame; null is the frame time), `frames`, `drawCalls`, `triangles`, `avgFrameMs`, `maxFrameMs` (longest frame since a test set it to 0), `programs()` (compiled shader programs), `cameraPose()` (position + view direction),
`errors`, `phase()`, `enemies()` → on-screen enemies with projected px, `stats()` → score/kills/combo/multiplier/timeScale/frenzy/timeRemaining/phase/liveEnemies/
onScreenEnemies/shotsFired/hits/bestCombo/runSeed/currentLevel, `autoFire(on)`, `killNearest(n)` (never a boss weak point; fires one real shot,
then resolves hits via `processHit`, the bullet pool's own path), `enemyScreenPoints(n)`,
`fireShot(x, y)` (one real shot through NDC), `bullets()` → drawn count, largest screen radius now / since load, newest bullet's
screen point, `bulletStep` (seconds per frame for every live bullet; 0 freezes them), `endLevel()`, `setTimeScale(s)`, `rideTo` (set a track fraction 0–1 to jump the coaster there), `rideProgress` (its track fraction on the last frame), `rideSpeed` (set 0–1 to put the coaster at that speed), `sceneStats()`, `combat` fire/hit/kill event counters,
`cameraTranslation` {current, max} = translation off the track pose (must be 0), `cameraTrauma`
{current, max} in degrees, `cameraWeight` → bank / pitch / speed + drop FOV kick now and max (degrees), smoothed speed 0–1, wind-streak opacity, the caps the smoke checks (`caps`, from the source constants), `weapon` → the gun's on-screen box, pivot, muzzle tip + last shot point, `holdFeedback`,
`view()` → camera vs canvas aspect + FOV, drawing-buffer size + dpr, `graphics()` → quality setting, its preset, adaptive steps, reduced motion, `audio()` → unlocked?, Tone.js chunk loaded? (`toneLoaded`), long-lived SFX node count, arcade voice pool (`sfxVoices`: budget / live / peak / stolen / dropped), music ducked?, sounds dropped by a caught audio error, `music` (live music buses with their gain + the last few fade ramps), `engine` ('tone' / 'scrim'), `scrim` (score engine: current score, tracks with the score each plays (a `?theme=` option or its own), paused + song position, long-lived nodes, timer running),
`audioBurst(shots, kills)` → rapid SFX + late music notes in one JS turn while the audio clock ticks (kills spaced 35 ms apart on the audio clock, past the SFX throttles; returns `killsPlayed`, the kills that reached the engine), `renderAudio(req, seed?)` → an offline render as base64 PCM (title screen, before audio unlocks; `npm run audio:render`; kinds music / sfxSheet / mix (`stem: 'music'`: without SFX), `engine: 'scrim'`, and `score` for one score through the port alone), `triggerHeld()` → pointer trigger down?,
`shaderWarmup` {done, ms, programs} for the current level, `initTimings()` (ms from navigation to each startup phase, the first time: `core/startupMarks.ts`), `summonBoss()` (the level's boss now instead of at its level time),
`boss()` → stage / hp fraction / exposed weak points on screen (with hp) / the hull's on-screen box, `bossHit(n)` (n hits on exposed
weak points through `processHit`), `bossEvents` spawn/hit/defeated counters, `fireworks()` → mounted?, launches / bursts, live rockets / bursts and the newest burst on screen, `deaths()` → death effects spawned / live, the newest one's style and origin on screen, `particles()` → the biome particle field: mounted?, points, boost-only points, boost strength now, `weaponState()` → active gun, pickup id + remaining fraction, `pickups()` → the level's weapon pickups: id, track fraction, collected?, screen point). See `src/testing/e2eHook.tsx`. Extend it when you need new test
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
