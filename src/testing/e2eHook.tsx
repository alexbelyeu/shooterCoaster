/**
 * Test hook for automated smoke tests and agent playtests.
 *
 * Only active when the page is loaded with `?e2e=1`. It exposes a small
 * read/write surface on `window.__SC_TEST__` so a headless browser can:
 *   - jump straight into any level (skipping title / level select / audio unlock)
 *   - confirm the render loop is advancing (frame counter)
 *   - read basic renderer stats (draw calls, triangles) as a perf signal
 *   - list on-screen enemies with their projected size (readability checks)
 *   - freeze game time so a screenshot matches a query (setTimeScale)
 *   - play: autoFire at the nearest visible enemy, killNearest(n) for
 *     deterministic combat screenshots (fires one real shot, then resolves the
 *     hits through the bullet pool's own processHit path), endLevel() to reach
 *     the results screen (shareText(worldRank?) for what its share menu's Copy link copies, scoreCard(size) for its share image), stats() for score / kills / combo (tier, frenzy slow-mo) / shots / hits,
 *     primeCombo(n) to set up a long chain,
 *     enemyScreenPoints(n) to drive real pointer / touch input at enemies
 *   - count fire / hit / kill events, camera translation / trauma rotation and
 *     the weapon view-model's on-screen box (hit feedback checks)
 *   - read audio state (live SFX node count, slow-mo music duck, music crossfade buses, sounds dropped by a
 *     caught audio error: `dropped` / `lastDrop`), stress it (audioBurst: rapid SFX, every kill tier past the
 *     throttles) and render it offline
 *   - read the camera pose (title fly-by), shader program count and longest frame (first-shot hitch)
 *   - read startup timings (initTimings)
 *   - summon the level's boss now, read it (hp, exposed weak points, on-screen box) and hit it through processHit
 *   - read the graphics quality, its preset and the adaptive dpr steps
 *
 * Keep this file tiny and side-effect free when the flag is off: nothing here
 * runs unless `installE2EApi()` finds `?e2e=1`, and <E2EFrameProbe> is only
 * mounted under the same flag.
 */
import { useEffect } from 'react'
import { dailyKey, dailyLevel, dailySeed, type DailyStreak } from '@/levels/daily'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { medalRun, useGameStore } from '@/store/useGameStore'
import type { RideVariant, RunMode } from '@/types/game'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import { eventBus } from '@/core/EventBus'
import { ENEMY_SILHOUETTE, projectedPx } from '@/entities/enemies/enemyReadability'
import type { EnemyType, EnemyWave, RideBeat } from '@/types/level'
import { levelWeather, weatherSeconds } from '@/levels/environments/shared/weatherPulse'
import type { GamePhase, LeaderboardEntry, ScoreEntry } from '@/types/game'
import { getCollisionTargets, processHit, type CollisionTarget } from '@/combat/CollisionManager'
import { fireAtNDC, showShotAtNDC } from '@/combat/useShooting'
import { hashString } from '@/utils/rng'
import { gameTime } from '@/core/gameClock'
import { startupTimings, type StartupPhase } from '@/core/startupMarks'
import { useSettingsStore } from '@/store/useSettingsStore'
import { qualityProfile, type GraphicsQuality, type QualityProfile } from '@/canvas/graphicsQuality'
import { getAdaptiveSteps } from '@/canvas/useRenderBudget'
import { COMBO_TIERS, TOP_TIER, comboMultiplier } from '@/combat/comboTiers'
import { setTimeScaleOverride } from '@/combat/slowMo.hot'
import { INTRO_HANDOFF_SECONDS, INTRO_SECONDS } from '@/core/introShot'
import { getPointerState } from '@/input/pointerInput'
import { audioContext, initAudio, isAudioReady, isMusicDucked, isPauseMixOn } from '@/audio/AudioEngine'
import { loadArcade, sfx, type VoiceStats } from '@/audio/sfx'
import { droppedSounds } from '@/audio/soundGuard'
import { musicState, type MusicFade } from '@/audio/musicBus'
import { scrimPlayer } from '@/audio/musicEngine'
import type { AudioRenderRequest, AudioRenderResult } from './audioRender'
import { exposedWeakPoints, hpFraction, weakPointHp, type BossState } from '@/entities/bosses/bossModel'
import { clipboardText, sharePayload } from '@/ui/share'
import { setOnlineEndpointOverride } from '@/app/onlineLeaderboard'
import { scoreCardFileName, scoreCardRun, type CardSize } from '@/ui/scoreCard'
import { renderScoreCard } from '@/ui/scoreCardImage'
import { activeWeapon, pickupRemaining } from '@/combat/weapons/weaponTypes'
import type { LivePickup } from '@/combat/pickups/Pickups'
import type { Junction, SwitchPose } from '@/track/mechanics'
import type { TrackCurve } from '@/track/curves/TrackCurve'
import { rideProgress } from '@/track/rideProgress.hot'
import { WAVE_TELL_SECONDS } from '@/entities/spawning/waveSchedule'
import { RIG_MAX_PITCH_DEG, RIG_MAX_ROLL_DEG } from '@/track/cameraRig.hot'
import { STREAK_SPEED_THRESHOLD } from '@/track/windStreaks'
import { MAX_FOV_KICK_DEG } from '@/track/cameraFov.hot'
import { programsAfterWarmup } from '@/core/hitchLog'
import { collectOccluders, countSight, type SightCounts, type SightTarget } from './lineOfSight'
import { LONG_FRAME_MS } from '@/telemetry/telemetryReport'
import { bystanderCount } from '@/combat/bystanders'
import { BYSTANDER_PENALTY } from '@/levels/scoring'

export const isE2E =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')

/**
 * `?e2e=1&gpuSync=1` (#608): each frame first waits for the GPU to finish the one before. Headless Chromium's old
 * headless mode (CI's headless shell) runs the page's frames far ahead of SwiftShader, queueing seconds of GL work,
 * and every screenshot waits for that queue to drain: 8-20 s a shot on the title, a minute more on the ui shard.
 */
const gpuSync = isE2E && new URLSearchParams(window.location.search).has('gpuSync')
const SYNC_PIXEL = new Uint8Array(4)

/** Blocks until the GPU has run every command sent so far (a readPixels from the default framebuffer). */
function waitForGpu(gl: THREE.WebGLRenderer) {
  const target = gl.getRenderTarget()
  gl.setRenderTarget(null)
  const ctx = gl.getContext()
  ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, SYNC_PIXEL)
  gl.setRenderTarget(target)
}

/** A level's weather pulse as `levels()` lists it: its kind, the level time its wave arrives and how long it lasts. */
export interface E2ELevelWeather {
  kind: string
  at: number
  seconds: number
}

function e2eWeather(waves: readonly EnemyWave[]): E2ELevelWeather | null {
  const weather = levelWeather(waves)
  return weather && { kind: weather.kind, at: weather.wave.spawnDelay ?? 0, seconds: weatherSeconds(weather.kind) }
}

export interface RideFeel {
  launch: number
  dip: number
  airtime: number
  lift: number
  rumble: number
}

export interface SCTestApi {
  frames: number
  /** Rolling average frame time in ms (last ~120 frames). */
  avgFrameMs: number
  /** Longest frame in ms since a test last set this to 0 (first-shot hitch check, the throttled ride). */
  maxFrameMs: number
  /** Frames of telemetry's `LONG_FRAME_MS` (100) or more since a test last set this to 0 (the throttled ride, #536). */
  longFrames: number
  /** Shader programs the renderer has compiled so far (a rise mid-play is a compile hitch). */
  programs: () => number
  /**
   * Every frame since the level's warm-up finished that compiled programs past its count (#536): a shader
   * the warm-up missed. Cleared when a level's warm-up starts.
   */
  programGrowth: ProgramGrowth[]
  /** The renderer's live GPU textures (render targets included) and geometries (`renderer.info.memory`). */
  gpuMemory: () => { textures: number; geometries: number }
  /** Active camera's world position and unit view direction (title fly-by check). */
  cameraPose: () => { position: [number, number, number]; forward: [number, number, number] } | null
  /** Linear RGBA of the scene's Points `name`'s first point drawn over opaque grey with its centre on a 1x1 float target's pixel centre (#344). */
  pointCentreColour: (name: string) => [number, number, number, number] | null
  drawCalls: number
  triangles: number
  /** Every level in play order, its `nextLevel` and whether the unlock rule opens it now. */
  levels: () => { id: string; name: string; maxScore: number; nextLevel: string | null; unlocked: boolean; weather: E2ELevelWeather | null }[]
  /** Start a level; `seed` pins the run seed (enemy spawns), else `?seed=` or a fresh one; `variant` a Night Ride (#829). */
  startLevel: (id: string, seed?: number, variant?: RideVariant) => void
  /** The current run's `runVariant`: day, or the level's Night Ride. */
  variant: () => RideVariant
  /** `restartRun`, as Replay / R / the pause menu's Restart do: a warm level goes straight to the countdown (#674). */
  restartLevel: () => void
  /** `<count>:<hash>` of the latest run's spawn positions (formation members: their seeded slots); null until a spawner has generated them. */
  spawnDigest: () => string | null
  /** Level time (s) now, when the next wave still to come is due (null once all are in) and the spawner's last wave tick (s); null with no level. */
  nextWave: () => WaveProbe | null
  /** Seconds of level time a `wave:incoming` tell is due before its wave (`WAVE_TELL_SECONDS`). */
  waveTellSeconds: number
  /** Every `wave:incoming` (tell) and `wave:announce` (arrival) since load; a tell is on time when `lastTick < due - waveTellSeconds <= levelTime`. */
  waveEvents: { kind: 'incoming' | 'announce'; label: string; ms: number; levelTime: number | null; due: number | null; lastTick: number | null }[]
  phase: () => string
  /** Jump to a UI phase (e.g. `levelSelect`) without clicking through the screens before it. */
  setPhase: (phase: GamePhase) => void
  /** Replace the saved best scores / stars (persisted to localStorage like real saves). */
  setSavedScores: (scores: Record<string, ScoreEntry>) => void
  /** Replace the local leaderboards (and `lastInitials`), persisted like real saves. */
  setLeaderboards: (boards: Record<string, LeaderboardEntry[]>, lastInitials?: string) => void
  leaderboards: () => { boards: Record<string, LeaderboardEntry[]>; lastInitials: string }
  /** Point the results screen's online board at `endpoint` (the smoke stubs it with `page.route`); null turns it off again. */
  onlineBoard: (endpoint: string | null) => void
  /** The Daily Run: today's UTC key, seed and level, the current run's mode, the saved daily bests and the streak. */
  daily: () => {
    dateKey: string
    seed: number
    level: string
    runMode: RunMode
    savedDaily: Record<string, ScoreEntry>
    streak: DailyStreak
  }
  /**
   * Enemies whose centre is inside the view frustum, largest first, with screen
   * position (CSS px, origin top-left) and projected silhouette size in px.
   * Occlusion by terrain is not considered.
   */
  enemies: () => E2EEnemyOnScreen[]
  errors: string[]
  /**
   * Every phase or level change since load (#933), oldest first, at most `RUN_LOG_MAX`: the page time (ms), the frame,
   * and the top of the stack that made it, so a check that finds the page in another run can say what started it.
   */
  runLog: { ms: number; frame: number; phase: GamePhase; level: string | null; from: string }[]
  /** Counts of 'weapon:fire' / 'enemy:hit' / 'enemy:killed' since load. */
  combat: { fired: number; hits: number; kills: number }
  /** Camera translation off the track pose this frame, and the max seen.
   *  Feedback is rotation-only (issue #65), so this must stay exactly 0. */
  cameraTranslation: { current: number; max: number }
  /** Kill / world-event trauma camera rotation this frame and the max seen (largest of
   *  pitch / yaw / roll, degrees). Kill trauma decays to 0 within 250 ms. */
  cameraTrauma: { current: number; max: number }
  /** Coaster camera weight (#123) applied this frame and the max seen since load:
   *  bank and pitch (degrees, signed; maxima are absolute), the speed + drop FOV widening,
   *  the smoothed ride speed (0–1), the wind-streak opacity (#27) and the caps from the source constants (degrees; `streakSpeed` is the speed the streaks start at).
   *  Ride feel (#697): the launch shove, drop dip, airtime float and chain lift (0–1, before Screen shake), the rail
   *  rumble (degrees, after it), and the peak of each since load (`feelMax`). */
  cameraWeight: {
    roll: number; pitch: number; fovKick: number; maxRoll: number; maxPitch: number; maxFovKick: number
    speed: number; streaks: number; maxStreaks: number
    caps: { roll: number; pitch: number; fovKick: number; streakSpeed: number }
    feel: RideFeel
    feelMax: RideFeel
  }
  /** Track set-pieces (#332): the level's tunnels as track fractions (`spans`), the one the car is in (-1: none) and how
   *  deep (`tunnelDepth`, 0–1), set by the coaster camera. */
  tunnel: { spans: { from: number; to: number }[]; index: number; depth: number }
  /** Dark sections (#752): the level's as track fractions, how dark the ride is now (0–1) and the muzzle flash's light
   *  intensity, set by `DarkSections` each frame. */
  darkSection: { spans: { from: number; to: number }[]; depth: number; flash: number }
  /** The level's weather pulse (#798), set by `Weather` each frame: its strength (0–1), streaks drawn and the fog now
   *  against the biome's own. null on a level without weather. */
  weather: { kind: string; envelope: number; streaks: number; fogNear: number; fogFar: number; baseFogNear: number; baseFogFar: number } | null
  /** First-person weapon view-model on screen (CSS px, origin top-left):
   *  bounding box of its projected bounds and the muzzle tip. null before the
   *  first level frame. */
  weapon: E2EWeaponOnScreen | null
  /** Freeze transient feedback (muzzle flash, hitmarker) at its peak for screenshots. */
  holdFeedback: boolean
  /** Seconds every live bullet flies per frame instead of the frame time, and no bullet expires;
   *  0 freezes them (e.g. a fresh one at the muzzle), null is normal play. */
  bulletStep: number | null
  /** Seconds the level timer and game clock advance per playing frame instead of the frame time; null is normal play. */
  timerStep: number | null
  /** Most seconds the level timer and game clock advance per playing frame (a slower frame counts as this much); null
   *  is normal play. Lets the smoke sample the same moment of a level on any runner; `timerStep` overrides it. */
  timerStepMax: number | null
  /** Level time the timer, game clock and ride stop at, exactly, on the frame that reaches it (#487): the smoke's ride
   *  stops there on any runner, not wherever its poll catches it (10.2-10.7 s on CI). null is normal play. */
  stopAtLevelTime: number | null
  /** True holds the level timer (no time runs out, no wave or boss comes due) while the game clock, enemies, effects and
   *  combo keep running: the smoke's checks then see one moment of the level however long they take on a slow runner. */
  holdLevelTime: boolean
  /** Seconds the coaster rides per second of level time (in steps of at most 3/60 s, the game's per-frame ride cap);
   *  null rides the frame time. With `timerStepMax` it puts the ride at the same track point for a level time on any runner;
   *  the camera's look, rig and shake run on the level time with it. */
  rideRate: number | null
  /** Seconds since the title appeared, held: the title camera's pose stays there (the poster render, `npm run og -- --poster`). null runs it. */
  titleTime: number | null
  /** Idle ms before the title's attract mode (#419); null (every `?e2e=1` page starts so) never enters it. */
  titleAttractIdleMs: number | null
  /** Drawn bullets (#165): count, largest screen radius (fraction of canvas height) now and since load, newest one's CSS px point. */
  bullets: () => E2EBullets
  /** Fire one real shot through NDC (x, y), like a click there. False if not fired (phase, fire delay). */
  fireShot: (x: number, y: number) => boolean
  /**
   * Deterministic scene totals, independent of camera/frustum culling:
   * every visible mesh's triangles (x instance count) and object count, plus a
   * breakdown for objects with a `name` (e.g. `track`, `track-towers`).
   */
  sceneStats: () => SceneStats | null
  /** Every 100 ms (real time, at most once per rendered frame) aim at the nearest
   *  live on-screen enemy and fire a real bullet through the pool. With `hitsPerSecond` (#925: the pacing step and the
   *  ride review) it plays as a player instead, on the game clock so any runner gets the same run: that many hits a game
   *  second on the nearest targets `sight()` counts shootable, the shot's look with no colliding bullet (`showShotAtNDC`) and each hit through processHit, the only path that hits. */
  autoFire: (enabled: boolean, hitsPerSecond?: number) => void
  /** Kill the n nearest live enemies (on-screen ones first; never a boss weak point, see bossHit). Fires one real shot
   *  at the first on-screen victim (bullet, muzzle flash, weapon recoil; may be
   *  throttled by the fire delay), then resolves each victim through
   *  processHit — the bullet pool's own hit path (enemy:hit, hit flash, kill pop;
   *  enemy:killed follows ~80 ms later). Returns how many were hit. */
  killNearest: (n: number) => number
  /** Hit the nearest live bystander (on-screen ones first) through processHit, the bullet pool's own path (#518).
   *  Returns its id and the full `BYSTANDER_PENALTY` (what a hit takes off a score that can pay it), or null when none is live. */
  shootBystander: () => { id: string; penalty: number } | null
  stats: () => SCTestStats
  /** Viewport (CSS px) positions of up to n live on-screen enemies (no boss weak points), nearest
   *  first, so a test can tap / click real input at them. */
  enemyScreenPoints: (n: number) => { x: number; y: number }[]
  /** Set the live combo chain to `count` kills, the last one now (game time), so the next kill extends it. */
  primeCombo: (count: number) => void
  /** Force the results phase. */
  endLevel: () => void
  /** The medal ids the current run has won so far (`levels/medals.ts` `medalsWon`, #879). */
  medalsWon: () => string[]
  /** A level's medal ids in order, and the saved medals to put in the store (and so localStorage). */
  levelMedalIds: (levelId: string) => string[]
  setSavedMedals: (medals: Record<string, string[]>) => void
  /** The longest chain any medal asks for (`levels/medals.ts`): a run primed to it wins its level's combo medal. */
  longestComboMedal: number
  /** What the results share menu's Copy link puts on the clipboard for the current level and score (`text url`), or null (and always null in the portal build, which has no Share). */
  /** `worldRank` (0-based): the line a run on the World top 10 shares (#445). */
  shareText: (worldRank?: number | null) => string | null
  /** The results Share image (#272) for the current level and run, drawn as the share menu draws it: its pixel size,
   *  PNG data URL and download name, or null with no level. */
  scoreCard: (size: CardSize) => Promise<{ width: number; height: number; png: string; fileName: string } | null>
  /** Override the game time scale (0 freezes camera + enemies; 1 hands it back to the slow-mo envelopes, `combat/slowMo.hot.ts`). */
  setTimeScale: (s: number) => void
  /** Pins the intro's tour (#328, #675) at this progress (0 = the reveal, 1 = the seat) in any phase short of the results, until set back to null. */
  introAt: number | null
  /** The coaster camera's shot (#328): riding, the intro's tour or the results orbit. The tour's progress (0–1),
   *  height over the seat, distance and look angle (degrees) off the seat's pose, angle off the landmark and height over
   *  the ground; `marks` the progress of its four shots (#675); `goOffset` is the tour's distance off the seat on its
   *  last frame (GO); `seconds` how long the last intro ran before it handed over to the countdown (#674) and
   *  `skipped` whether a tap or key ended it; `length` is `INTRO_SECONDS`, the tour's fixed length, and `handoff`
   *  `INTRO_HANDOFF_SECONDS`, when Ready comes up (the countdown plays over its last `COUNTDOWN_LEAD_SECONDS`). */
  intro: {
    mode: 'ride' | 'tour' | 'orbit'
    length: number
    handoff: number
    progress: number; height: number; seatOffset: number; seatAngle: number; anchorAngle: number; clearance: number
    marks: { reveal: number; landmark: number; track: number; landing: number } | null
    goOffset: number | null
    orbitSeconds: number
    seconds: number | null
    skipped: boolean
  }
  /** Photo mode's orbit (#828), written by `track/PhotoCamera` each frame while it is on: radians, world units, the
   *  camera's distance from the pivot (the seat's eye at the pause) and its height over the terrain. */
  photo: { on: boolean; yaw: number; pitch: number; radius: number; offset: number; clearance: number }
  /** Set to a track fraction (0–1) to jump the coaster there on its next frame. */
  rideTo: number | null
  /** Set to a speed (0–1 between the level's min and max velocity) to put the coaster at it on its next frame. */
  rideSpeed: number | null
  /** The coaster's track fraction (0–1) on its last frame. */
  rideProgress: number
  /** The current level's v2 ride beats (`TrackParams.rideV2.beats`: a track fraction and the second it lands on); [] without one. */
  rideBeats: () => readonly RideBeat[]
  /** On a v2 ride, the track fraction 1.5 s before its top speed (`rideV2.ts` `planFastestLeadT`), set by `CoasterCamera`; null otherwise. */
  rideFastest: number | null
  // ── View / aspect (issue #66) ──
  /** Active camera projection vs the canvas's on-screen box (squash checks). */
  view: () => E2EView | null
  /** Graphics quality setting (`?quality=` sets it), its preset, and the `auto` step-downs taken (always 0 under `?e2e=1`). */
  graphics: () => { quality: GraphicsQuality; profile: QualityProfile; adaptiveSteps: number; reducedMotion: boolean }
  /** Audio state: unlocked yet, live gameplay SFX nodes (must stay flat while
   *  shooting / killing, 0 after level exit), music low-pass ducked (slow-mo). */
  audio: () => E2EAudio
  /** SFX stress (#115), in one JS turn while the audio clock ticks: rapid
   *  shots + layered kills, then a stinger (the wave tell). Kills step down through every combo tier, spaced past the SFX
   *  throttles, so `killsPlayed` should equal `kills`. Unlocks audio if needed. */
  audioBurst: (shots: number, kills: number) => Promise<E2EAudio & { killsPlayed: number }>
  /** Whether pointer input has the trigger held (released on blur / tab hide). */
  triggerHeld: () => boolean
  /** The shared aim point (CSS px), whichever device moved it last (pointer or gamepad, #819). */
  aimPoint: () => { x: number; y: number }
  /** Offline render of the game's own music / SFX code (`npm run audio:render`, `testing/audioRender.ts`).
   *  Only on the title screen before audio unlocks: the engines build in the offline context while it runs. */
  renderAudio: (req: AudioRenderRequest, seed?: number) => Promise<AudioRenderResult>
  /** The current level's shader warm-up (`canvas/ShaderWarmup.tsx`): finished?, how long it took
   *  from level mount, and the renderer's program count after it. null before the first level. */
  shaderWarmup: { levelId: string; done: boolean; ms: number; programs: number } | null
  /** The current level's lazy scene has loaded, mounted and warmed up: `startLevel` enters `playing` before that (#464). */
  levelReady: () => boolean
  /** ms from navigation to each startup phase (`core/startupMarks.ts`). */
  initTimings: () => Partial<Record<StartupPhase, number>>
  // ── Boss (issue #181) ──
  /**
   * Bring the level's boss in now (tell, then arrival on the next frames) instead of at its level time.
   * Held for this run until its BossSpawner mounts (the level scene is a lazy chunk), never taken by the last run's.
   */
  summonBoss: () => void
  /** The level's boss: stage, hp, exposed weak points on screen, the body's on-screen box. */
  boss: () => E2EBoss
  /**
   * What the rider can shoot right now (#925, `lineOfSight.ts`): live enemies and exposed boss weak points inside the view,
   * at least `MIN_ENEMY_PX` and not behind the world, plus those hidden (`occluded`) or too small (`tiny`). `bossFramed`:
   * the boss is in its fight and one of its weak points is shootable. Walks and raycasts the scene: sample it, not per frame.
   */
  sight: () => E2ESight
  /** n hits on the boss's exposed weak points (nearest first), each through processHit. Returns how many landed. */
  bossHit: (n: number) => number
  /** One hit on each of the boss's live projectiles (the Yeti's snowballs), through processHit. Returns how many landed. */
  projectileHit: () => number
  /** Seconds the boss moves per frame instead of the frame's game time, also with game time frozen (the level timer
   *  holds while it rises into place); null is normal play. */
  bossStep: number | null
  /** Counts of 'boss:spawn' / 'boss:hit' / 'boss:defeated' since load. */
  bossEvents: { spawn: number; hit: number; defeated: number }
  // ── Combo-streak fireworks (issue #182) ──
  /** The level's firework pool (theme park only): mounted?, launches / bursts since mount, live now, the newest burst on screen. */
  fireworks: () => E2EFireworks
  // ── Death effects (issue #29) ──
  /** Death effects since mount, live now, the newest one's style (enemy type, 'bossPart' or 'custom') and origin on screen. */
  deaths: () => E2EDeaths
  // ── Ambient particles (issue #37) ──
  /** The biome particle field: mounted?, always-on and boost-only points, boost strength 0..1 now. */
  particles: () => typeof e2eParticles
  // ── Weapon pickups (issue #185) ──
  /** The run's gun: the active weapon id, the pickup's id (null with none) and its remaining fraction 1 → 0. */
  weaponState: () => { active: string; pickup: string | null; remaining: number }
  /** The level's pickups: id, track parameter, collected? (and popped), and where it is on screen (CSS px, NDC). */
  pickups: () => E2EPickup[]
  // ── Shoot-to-switch junction (issue #702) ──
  /**
   * The level's switch sign (null on a level without a junction): its track t, the junction's fork and merge, the route it
   * is set to, still open?, where it is on screen, and which way the camera rides now (`shared` outside the junction).
   */
  trackSwitch: () => E2ESwitch | null
}

export interface E2ESwitch {
  t: number
  from: number
  to: number
  hard: boolean
  riding: 'easy' | 'hard' | 'shared'
  /** The sign still takes a shot: its target is registered, which it is until the car first passes it in the run (#779). */
  open: boolean
  /** The run's kill-count total: a hard-route wave joins it when it arrives (#720). */
  totalEnemies: number
  /** The level's hard-route wave (`EnemyWave.route` 'hard', from its roster's `branch`): banner, size and second; null without one. */
  branchWave: { label: string; count: number; at: number } | null
  x: number
  y: number
  ndcX: number
  ndcY: number
  onScreen: boolean
  distance: number
}

export interface E2EPickup {
  id: string
  t: number
  collected: boolean
  gone: boolean
  x: number
  y: number
  ndcX: number
  ndcY: number
  onScreen: boolean
  distance: number
}

export interface E2EDeaths {
  mounted: boolean
  spawned: number
  live: number
  lastStyle: string
  last: { x: number; y: number; onScreen: boolean } | null
}

export interface E2EFireworks {
  mounted: boolean
  launched: number
  bursts: number
  rocketsLive: number
  burstsLive: number
  /** Newest burst's centre in CSS px, onScreen = inside the canvas and in front of the camera. */
  lastBurst: { x: number; y: number; onScreen: boolean } | null
}

export type E2EBossStage = 'none' | 'waiting' | 'incoming' | 'active' | 'defeated' | 'done'

export interface E2EBoss {
  stage: E2EBossStage
  hpFraction: number | null
  weakPointsLeft: number
  /** Exposed weak points: id, hp left, CSS px (origin top-left), NDC, and whether inside the viewport. */
  exposed: { id: string; hp: number; x: number; y: number; ndcX: number; ndcY: number; onScreen: boolean }[]
  /** Projected bounds of the body (CSS px) and its width / height as fractions of the canvas. */
  box: { minX: number; minY: number; maxX: number; maxY: number; widthFrac: number; heightFrac: number } | null
  /** Its live projectiles (the Yeti's snowballs): NDC and whether inside the viewport. */
  projectiles: { ndcX: number; ndcY: number; onScreen: boolean }[]
}

type ScrimState = ReturnType<typeof import('@/audio/scrim/player').scrimState>

export interface E2EAudio {
  ready: boolean
  /** The score player's chunk has loaded (`audio/musicEngine.ts`): only after the first gesture starts the music. */
  engineLoaded: boolean
  /** Long-lived SFX nodes (the arcade engine's voice pool, buses and wind): must not grow while playing. */
  sfxNodes: number
  /** The arcade engine's voice pool: budget, live now, the most at once, stolen / dropped by priority. */
  sfxVoices: VoiceStats | null
  musicDucked: boolean
  /** The pause mix is on: music −12 dB, SFX silent. */
  pauseMix: boolean
  /** Sounds dropped by a caught audio error since load (must stay 0). */
  dropped: number
  lastDrop: string | null
  /** Music buses still connected (`audio/musicBus.ts`) with their gain now, and the last few gain ramps. */
  music: { buses: { name: string; gain: number; fading: boolean }[]; fades: MusicFade[] }
  /** The score engine's tracks (current last), each paused or not with its song position, its long-lived node count,
   *  and whether its scheduler timer runs; null until it has loaded. */
  scrim: ScrimState | null
}

export interface E2EView {
  /** `camera.aspect` of the active (gameplay) camera; null if not perspective. */
  cameraAspect: number | null
  /** Width / height of the canvas element as laid out on screen (CSS px). */
  canvasAspect: number
  canvasWidth: number
  canvasHeight: number
  /** Drawing-buffer size in device pixels and the renderer's pixel ratio. */
  bufferWidth: number
  bufferHeight: number
  dpr: number
  /** Vertical and horizontal field of view in degrees. */
  fov: number | null
  hFov: number | null
}

export interface SceneStats {
  objects: number
  triangles: number
  byName: Record<string, { objects: number; triangles: number }>
  /** scene.environment (the baked sky env map), or null when none is set */
  environment: { name: string; intensity: number; bakeMs: number | null } | null
}

export interface SCTestStats {
  score: number
  kills: number
  combo: number
  timeRemaining: number
  phase: string
  liveEnemies: number
  /** Live enemies in front of the camera and inside the viewport (not occlusion-tested). */
  onScreenEnemies: number
  /** Live bystanders (#518) on screen, as `onScreenEnemies`, and how many were shot this run. */
  onScreenBystanders: number
  /** How many bystanders the current level's roster brings (0: none to check). */
  levelBystanders: number
  bystandersHit: number
  shotsFired: number
  hits: number
  bestCombo: number
  /** Current combo tier multiplier (1, 2, 3, 5). */
  multiplier: number
  timeScale: number
  /** The top-tier slow-mo is running. */
  frenzy: boolean
  runSeed: number
  currentLevel: string | null
}

export interface E2EBullets {
  drawn: number
  screenFrac: number
  maxScreenFrac: number
  newest: { x: number; y: number } | null
}

export interface E2EWeaponOnScreen {
  visible: boolean
  minX: number
  minY: number
  maxX: number
  maxY: number
  tipX: number
  tipY: number
  /** Gun pivot (receiver centre) on screen: pivot → tip is the barrel's direction. */
  pivotX: number
  pivotY: number
  /** Aim point of the last shot (where the tracer ends). */
  shotX: number
  shotY: number
  /** Viewport the box was measured in. */
  width: number
  height: number
}

export interface E2ESight extends SightCounts {
  /** The level timer's elapsed seconds, unrounded (the store's `timeRemaining` moves in whole seconds). */
  levelTime: number
  bossStage: E2EBossStage
  bossFramed: boolean
  /** The shootable enemies by type (#928: how long a wave's own enemies last). */
  byType: Record<string, number>
}

export interface E2EEnemyOnScreen {
  id: string
  type: string
  x: number
  y: number
  px: number
  distance: number
}

/** Live enemy objects, registered by EnemyBase only when the e2e flag is on. */
const enemyRegistry = new Map<string, { type: EnemyType | 'goldenBalloon'; object: THREE.Object3D }>()
export function registerE2EEnemy(id: string, type: EnemyType | 'goldenBalloon', object: THREE.Object3D) {
  if (isE2E) enemyRegistry.set(id, { type, object })
}
export function unregisterE2EEnemy(id: string) {
  if (isE2E) enemyRegistry.delete(id)
}

/** Hash of the current run's spawn positions (all waves + golden balloons), set by EnemySpawner. */
let spawnDigest: string | null = null
export function recordE2ESpawns(positions: readonly { x: number; y: number; z: number }[]) {
  if (!isE2E) return
  const text = positions.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join(';')
  spawnDigest = `${positions.length}:${hashString(text).toString(16)}`
}

/** One frame that compiled shader programs after its level's warm-up (#536). */
export interface ProgramGrowth {
  /** Level timer seconds (the last playing frame's). */
  levelTime: number
  phase: GamePhase
  added: number
  total: number
  /** Bus events since the frame before: what appeared. */
  events: string[]
}

/** Bus events since the frame probe's last frame, for naming what a program compile came with. */
const frameEvents = new Set<string>()
let lastPrograms = 0

function noteProgramGrowth(api: SCTestApi, programs: number) {
  const warmup = api.shaderWarmup
  const added = programsAfterWarmup(programs, lastPrograms, warmup?.done ? warmup.programs : null)
  if (added > 0) {
    api.programGrowth.push({
      levelTime: e2eLevelTime,
      phase: useGameStore.getState().phase,
      added,
      total: programs,
      events: [...frameEvents],
    })
  }
  lastPrograms = programs
  frameEvents.clear()
}

/** The level timer's elapsed seconds, reported by GameTimer every playing frame (for `stopAtLevelTime`). */
let e2eLevelTime = 0
export function noteE2ELevelTime(seconds: number) {
  if (isE2E) e2eLevelTime = seconds
}
/** This frame's step under `stopAtLevelTime`, worked out once: the timer and the ride read the same one whichever runs first. */
const stopStep = { frame: NaN, delta: NaN, step: 0 }
// A hair past the stop, so the timer's remaining seconds round down to the stop's whole second.
const STOP_EPSILON = 1e-6

/** Level time for a playing frame of `delta` seconds: the frame time, unless a test set `timerStep` / `timerStepMax` / `stopAtLevelTime`. */
export function levelTimeStep(delta: number): number {
  const api = isE2E ? window.__SC_TEST__ : undefined
  const step = api?.timerStep ?? (api?.timerStepMax != null ? Math.min(delta, api.timerStepMax) : delta)
  if (api?.stopAtLevelTime == null) return step
  // The animation frame's timestamp is the same for every useFrame callback of one frame.
  const frame = Number(document.timeline.currentTime)
  if (frame !== stopStep.frame || delta !== stopStep.delta) {
    const left = api.stopAtLevelTime - e2eLevelTime
    stopStep.frame = frame
    stopStep.delta = delta
    stopStep.step = left <= 0 ? 0 : Math.min(step, left + STOP_EPSILON)
  }
  return stopStep.step
}

/** True while a test holds the level timer (`holdLevelTime`); never in normal play. */
export function levelTimeHeld(): boolean {
  return isE2E && window.__SC_TEST__?.holdLevelTime === true
}

/** Seconds the coaster rides on a playing frame of `delta` seconds when a test set `rideRate`, else null. */
export function e2eRideSeconds(delta: number): number | null {
  const rate = isE2E ? window.__SC_TEST__?.rideRate : null
  return rate == null ? null : levelTimeStep(delta) * rate
}

/** Idle ms before the title's attract mode: `idleMs` in the game, the test's `titleAttractIdleMs` under e2e (null: never). */
export function e2eAttractIdleMs(idleMs: number): number | null {
  return isE2E ? (window.__SC_TEST__?.titleAttractIdleMs ?? null) : idleMs
}

/** The title camera's time when a test holds it (`titleTime`), else null. */
export function e2eTitleTime(): number | null {
  return isE2E ? (window.__SC_TEST__?.titleTime ?? null) : null
}

/** The mounted spawner's wave schedule, set by EnemySpawner. */
interface WaveProbe {
  levelTime: number
  due: number | null
  lastTick: number | null
}
let waveProbe: (() => WaveProbe) | null = null
export function registerE2EWaves(probe: typeof waveProbe) {
  if (isE2E) waveProbe = probe
}

/** Camera + viewport captured by <E2EFrameProbe> so non-React test calls can aim/project. */
let probeCamera: THREE.Camera | null = null
let probeSize = { width: 1280, height: 720 }
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()

/** Written by BulletPool every playing frame when the e2e flag is on; read through `bullets()`. */
export const e2eBullets = {
  drawn: 0,
  screenFrac: 0,
  maxScreenFrac: 0,
  hasNewest: false,
  newest: new THREE.Vector3(),
}

/** Written by `effects/Fireworks.tsx` when the e2e flag is on; read through `fireworks()`. */
export const e2eFireworks = {
  mounted: false,
  launched: 0,
  bursts: 0,
  rocketsLive: 0,
  burstsLive: 0,
  hasLast: false,
  last: new THREE.Vector3(),
}

/** Written by `shared/ParticleField.tsx` when the e2e flag is on; read through `particles()`. */
export const e2eParticles = { mounted: false, points: 0, boostPoints: 0, boost: 0 }

/** Written by `canvas/LevelScene.tsx` when the e2e flag is on: the running level's v2 ride beats (its ride is in its world's chunk, #960); read through `rideBeats()`. */
export const e2eRide: { beats: readonly RideBeat[] } = { beats: [] }

/** Written by `combat/pickups/Pickups.tsx` when the e2e flag is on; read through `pickups()`. */
export const e2ePickups: { list: readonly LivePickup[] } = { list: [] }

/** Written by `track/TrackSwitch.tsx` when the e2e flag is on; read through `trackSwitch()`. */
export const e2eSwitch: {
  state: { pose: SwitchPose; main: TrackCurve; junction: Junction; open: () => boolean } | null
} = { state: null }

function readSwitch(): E2ESwitch | null {
  const cam = probeCamera
  const s = e2eSwitch.state
  if (!cam || !s) return null
  cam.getWorldPosition(_w)
  const { position, t } = s.pose
  const { from, to, branch } = s.junction
  const ride = rideProgress()
  let riding: E2ESwitch['riding'] = 'shared'
  if (ride > from + 0.1 * (to - from) && ride < to - 0.1 * (to - from)) {
    const easy = s.main.getPointAt(ride).distanceTo(_w)
    riding = branch.getPointAt((ride - from) / (to - from)).distanceTo(_w) < easy ? 'hard' : 'easy'
  }
  _v.copy(position).project(cam)
  const ahead = _toPickup.copy(position).sub(_w).dot(cam.getWorldDirection(_camDir)) > 0
  return {
    t,
    from,
    to,
    hard: useGameStore.getState().route === 'hard',
    riding,
    open: s.open(),
    totalEnemies: useGameStore.getState().totalEnemies,
    branchWave: readBranchWave(),
    x: ((_v.x + 1) / 2) * probeSize.width,
    y: ((1 - _v.y) / 2) * probeSize.height,
    ndcX: _v.x,
    ndcY: _v.y,
    onScreen: ahead && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1,
    distance: position.distanceTo(_w),
  }
}

function readBranchWave(): E2ESwitch['branchWave'] {
  const level = useGameStore.getState().currentLevel
  const wave = (level ? getLevelConfig(level)?.enemies : undefined)?.find((e) => e.route === 'hard')
  return wave ? { label: wave.waveLabel ?? '', count: wave.count, at: wave.spawnDelay ?? 0 } : null
}

const _toPickup = new THREE.Vector3()
const _camDir = new THREE.Vector3()

function readPickups(): E2EPickup[] {
  const cam = probeCamera
  if (!cam) return []
  cam.getWorldPosition(_w)
  return e2ePickups.list.map((p) => {
    _v.copy(p.position).project(cam)
    const ahead = _toPickup.copy(p.position).sub(_w).dot(cam.getWorldDirection(_camDir)) > 0
    return {
      id: p.id,
      t: p.t,
      collected: p.popAge >= 0,
      gone: p.position.y < -9000,
      x: ((_v.x + 1) / 2) * probeSize.width,
      y: ((1 - _v.y) / 2) * probeSize.height,
      ndcX: _v.x,
      ndcY: _v.y,
      onScreen: ahead && p.popAge < 0 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1,
      distance: p.position.distanceTo(_w),
    }
  })
}

/** Written by `effects/ParticleExplosion.tsx` when the e2e flag is on; read through `deaths()`. */
export const e2eDeaths = {
  mounted: false,
  spawned: 0,
  live: 0,
  lastStyle: '',
  hasLast: false,
  last: new THREE.Vector3(),
}

function readDeaths(): E2EDeaths {
  const d = e2eDeaths
  let last: E2EDeaths['last'] = null
  if (d.hasLast && probeCamera) {
    _v.copy(d.last).project(probeCamera)
    const onScreen = _v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1
    last = { x: ((_v.x + 1) / 2) * probeSize.width, y: ((1 - _v.y) / 2) * probeSize.height, onScreen }
  }
  return { mounted: d.mounted, spawned: d.spawned, live: d.live, lastStyle: d.lastStyle, last }
}

function readFireworks(): E2EFireworks {
  const f = e2eFireworks
  let lastBurst: E2EFireworks['lastBurst'] = null
  if (f.hasLast && probeCamera) {
    _v.copy(f.last).project(probeCamera)
    const onScreen = _v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1
    lastBurst = { x: ((_v.x + 1) / 2) * probeSize.width, y: ((1 - _v.y) / 2) * probeSize.height, onScreen }
  }
  const { mounted, launched, bursts, rocketsLive, burstsLive } = f
  return { mounted, launched, bursts, rocketsLive, burstsLive, lastBurst }
}

function readBullets(): E2EBullets {
  const b = e2eBullets
  let newest: E2EBullets['newest'] = null
  if (b.hasNewest && probeCamera) {
    _v.copy(b.newest).project(probeCamera)
    if (_v.z < 1) newest = { x: ((_v.x + 1) / 2) * probeSize.width, y: ((1 - _v.y) / 2) * probeSize.height }
  }
  return { drawn: b.drawn, screenFrac: b.screenFrac, maxScreenFrac: b.maxScreenFrac, newest }
}

/** Written by BossSpawner / BossBase when the e2e flag is on; read through `boss()`. */
export const e2eBoss: {
  /** The run `summonBoss()` was called in, until that run's BossSpawner takes it. */
  summon: number | null
  stage: E2EBossStage
  handle: { body: THREE.Object3D; parts: ReadonlyMap<string, THREE.Object3D>; state: () => BossState } | null
  /** World positions of its live projectiles, set by a boss that throws them. */
  projectiles: (() => readonly THREE.Vector3[]) | null
} = { summon: null, stage: 'none', handle: null, projectiles: null }

const _box = new THREE.Box3()
const _corner = new THREE.Vector3()

function readBoss(): E2EBoss {
  const h = e2eBoss.handle
  const out: E2EBoss = { stage: e2eBoss.stage, hpFraction: null, weakPointsLeft: 0, exposed: [], box: null, projectiles: [] }
  if (!h) return out
  const state = h.state()
  out.hpFraction = hpFraction(state)
  out.weakPointsLeft = state.hp.filter((hp) => hp > 0).length
  const cam = probeCamera
  if (!cam) return out
  const { width, height } = probeSize
  for (const w of exposedWeakPoints(state)) {
    const part = h.parts.get(w.id)
    if (!part) continue
    part.getWorldPosition(_v).project(cam)
    out.exposed.push({
      id: w.id,
      hp: weakPointHp(state, w.id),
      x: ((_v.x + 1) / 2) * width,
      y: ((1 - _v.y) / 2) * height,
      ndcX: _v.x,
      ndcY: _v.y,
      onScreen: _v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1,
    })
  }
  for (const p of e2eBoss.projectiles?.() ?? []) {
    _v.copy(p).project(cam)
    out.projectiles.push({ ndcX: _v.x, ndcY: _v.y, onScreen: _v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1 })
  }
  _box.setFromObject(h.body)
  if (_box.isEmpty()) return out
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < 8; i++) {
    _corner.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).project(cam)
    if (_corner.z > 1) continue
    const x = Math.min(Math.max(((_corner.x + 1) / 2) * width, 0), width)
    const y = Math.min(Math.max(((1 - _corner.y) / 2) * height, 0), height)
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  if (minX < maxX) out.box = { minX, minY, maxX, maxY, widthFrac: (maxX - minX) / width, heightFrac: (maxY - minY) / height }
  return out
}

const isBossId = (id: string) => id.startsWith('boss:')
const isBossTarget = (t: CollisionTarget) => isBossId(t.id)

function bossHit(n: number): number {
  let landed = 0
  for (let i = 0; i < n; i++) {
    let best: CollisionTarget | null = null
    let bestD = Infinity
    for (const t of getCollisionTargets()) {
      if (!isBossTarget(t)) continue
      const d = probeCamera ? t.getPosition().distanceToSquared(probeCamera.position) : 0
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    if (!best) break
    processHit(best)
    landed++
  }
  return landed
}

/** Target id prefix of a boss's projectiles: not `boss:`, so `bossHit` leaves them and they are shot like enemies. */
export const BOSS_PROJECTILE_PREFIX = 'boss-projectile:'

function projectileHit(): number {
  const live = [...getCollisionTargets()].filter((t) => t.id.startsWith(BOSS_PROJECTILE_PREFIX))
  for (const t of live) processHit(t)
  return live.length
}

function enemiesOnScreen(): E2EEnemyOnScreen[] {
  const cam = probeCamera
  if (!cam) return []
  const fov = cam instanceof THREE.PerspectiveCamera ? cam.fov : 80
  const out: E2EEnemyOnScreen[] = []
  cam.getWorldPosition(_w)
  for (const [id, { type, object }] of enemyRegistry) {
    object.getWorldPosition(_v)
    const distance = _v.distanceTo(_w)
    _v.project(cam)
    if (_v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) continue
    out.push({
      id,
      type,
      x: ((_v.x + 1) / 2) * probeSize.width,
      y: ((1 - _v.y) / 2) * probeSize.height,
      px: projectedPx(ENEMY_SILHOUETTE[type] ?? 50, distance, probeSize.height, fov),
      distance,
    })
  }
  return out.sort((a, b) => b.px - a.px)
}

declare global {
  interface Window {
    __SC_TEST__?: SCTestApi
  }
}

const AUTOFIRE_INTERVAL_MS = 100
let autoFireEnabled = false
let lastAutoFire = 0
const _fwd = new THREE.Vector3()

/** Dead/unmounted enemies report a parking position far below the world. */
function isMounted(t: CollisionTarget) {
  return t.getPosition().y > -9000
}

const NO_SIGHT: E2ESight = { levelTime: 0, shootable: 0, occluded: 0, tiny: 0, ids: [], bossStage: 'none', bossFramed: false, byType: {} }

function readSight(): E2ESight {
  const cam = probeCamera
  const scene = probeScene
  if (!cam || !scene) return { ...NO_SIGHT, levelTime: e2eLevelTime, bossStage: e2eBoss.stage }
  const skip = new Set<THREE.Object3D>()
  for (const { object } of enemyRegistry.values()) skip.add(object)
  if (e2eBoss.handle) {
    skip.add(e2eBoss.handle.body)
    // A weak point is a target, not an occluder: the Kraken's eye (its pupil and glint stand past its hit radius) hid itself.
    for (const part of e2eBoss.handle.parts.values()) skip.add(part)
  }
  const targets: SightTarget[] = []
  for (const t of getCollisionTargets()) {
    if (!isLive(t)) continue
    const radius = Math.sqrt(t.radiusSq)
    const type = enemyRegistry.get(t.id)?.type
    targets.push({ id: t.id, position: t.getPosition().clone(), size: type ? (ENEMY_SILHOUETTE[type] ?? 2 * radius) : 2 * radius, radius })
  }
  const counts = countSight(targets, cam, collectOccluders(scene, cam, skip))
  const bossFramed = e2eBoss.stage === 'active' && counts.ids.some((id) => isBossId(id))
  const byType: Record<string, number> = {}
  for (const id of counts.ids) {
    const type = enemyRegistry.get(id)?.type
    if (type) byType[type] = (byType[type] ?? 0) + 1
  }
  return { ...counts, levelTime: e2eLevelTime, bossStage: e2eBoss.stage, bossFramed, byType }
}

/** Weapon pickups, a junction's switch and bystanders are targets too, but no enemy. */
function isLive(t: CollisionTarget) {
  return t.kind === undefined && isMounted(t)
}

/** NDC of a target if it is in front of the camera and inside the viewport. */
function onScreenNDC(t: CollisionTarget, camera: THREE.Camera, out: THREE.Vector3): boolean {
  camera.getWorldDirection(_fwd)
  _v.copy(t.getPosition()).sub(camera.position)
  if (_v.dot(_fwd) <= 0) return false
  out.copy(t.getPosition()).project(camera)
  return out.z < 1 && Math.abs(out.x) <= 1 && Math.abs(out.y) <= 1
}

/** Live normal enemies, on-screen first, then nearest. Boss weak points are left out: `bossHit` is the one
 *  way a test damages a boss, so a slow run that reaches the boss's level time doesn't kill a part by accident. */
function liveTargetsByDistance(camera: THREE.Camera | null) {
  const list: { t: CollisionTarget; d: number; visible: boolean }[] = []
  const ndc = new THREE.Vector3()
  for (const t of getCollisionTargets()) {
    if (!isLive(t) || isBossTarget(t)) continue
    const d = camera ? t.getPosition().distanceToSquared(camera.position) : 0
    const visible = camera ? onScreenNDC(t, camera, ndc) : false
    list.push({ t, d, visible })
  }
  // On-screen first, then nearest.
  list.sort((a, b) => Number(b.visible) - Number(a.visible) || a.d - b.d)
  return list
}

const _aim = new THREE.Vector3()
/** Hits a game second for `autoFire`'s player mode, and the game time its last hit was due. */
let playerRate: number | null = null
let lastPlayerHit = 0
/** A long frame's hits are capped: a player doesn't land a burst after a stall. */
const PLAYER_MAX_HITS_A_FRAME = 4

function playerFireTick(camera: THREE.Camera, rate: number) {
  const now = gameTime()
  const due = Math.min(PLAYER_MAX_HITS_A_FRAME, Math.floor((now - lastPlayerHit) * rate))
  if (due <= 0) return
  lastPlayerHit = Math.max(lastPlayerHit + due / rate, now - 1 / rate)
  if (useGameStore.getState().phase !== 'playing') return
  const shootable = new Set(readSight().ids)
  camera.getWorldPosition(_w)
  const victims = getCollisionTargets()
    .filter((t) => shootable.has(t.id))
    .map((t) => ({ t, d: t.getPosition().distanceToSquared(_w) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, due)
  if (!victims.length) return
  // The shot's look only: a real bullet, throttled on wall-clock time, would land extra hits
  // that depend on the runner's speed. processHit is the one path that hits here.
  if (onScreenNDC(victims[0].t, camera, _aim)) showShotAtNDC(_aim.x, _aim.y, victims.length)
  for (const { t } of victims) processHit(t)
}

function autoFireTick(camera: THREE.Camera) {
  if (playerRate) return playerFireTick(camera, playerRate)
  const now = performance.now()
  if (now - lastAutoFire < AUTOFIRE_INTERVAL_MS) return
  if (useGameStore.getState().phase !== 'playing') return
  let best: CollisionTarget | null = null
  let bestD = Infinity
  for (const t of getCollisionTargets()) {
    if (!isLive(t) || !onScreenNDC(t, camera, _aim)) continue
    const d = t.getPosition().distanceToSquared(camera.position)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  if (!best) return
  onScreenNDC(best, camera, _aim)
  if (fireAtNDC(_aim.x, _aim.y, camera)) lastAutoFire = now
}

const RUN_LOG_MAX = 40

/** Appends phase / level changes to `runLog`; the subscriber runs inside the store's `set`, so its stack names the caller. */
function logRunChanges(api: SCTestApi) {
  useGameStore.subscribe((next, prev) => {
    if (next.phase === prev.phase && next.currentLevel === prev.currentLevel) return
    // eslint-disable-next-line sc/no-hot-path-alloc -- a phase change, never per frame
    const from = (new Error().stack ?? '').split('\n').slice(2, 6).map((l) => l.trim()).join(' < ')
    api.runLog.push({ ms: Math.round(performance.now()), frame: api.frames, phase: next.phase, level: next.currentLevel, from })
    if (api.runLog.length > RUN_LOG_MAX) api.runLog.shift()
  })
}

export function installE2EApi() {
  if (!isE2E || window.__SC_TEST__) return
  eventBus.taps.add((event) => frameEvents.add(event))
  // The medal table loads with the screens, not the startup JS this hook is part of; it has arrived long before a run ends.
  let medals: typeof import('@/levels/medals') | null = null
  void import('@/levels/medals').then((m) => (medals = m))
  // Throw rather than answer "no medals" while the chunk is on its way: a slow runner's failure then says so.
  const loadedMedals = () => {
    if (!medals) throw new Error('the medals chunk (@/levels/medals) has not loaded yet')
    return medals
  }
  const api: SCTestApi = {
    frames: 0,
    avgFrameMs: 0,
    maxFrameMs: 0,
    longFrames: 0,
    programs: () => probeGl?.info.programs?.length ?? 0,
    gpuMemory: () => ({ textures: probeGl?.info.memory.textures ?? 0, geometries: probeGl?.info.memory.geometries ?? 0 }),
    cameraPose: readCameraPose,
    pointCentreColour,
    drawCalls: 0,
    triangles: 0,
    levels: () => {
      const { isLevelUnlocked } = useGameStore.getState()
      return getAllLevels().map((l) => ({
        id: l.id, name: l.name, maxScore: l.maxScore, nextLevel: l.nextLevel, unlocked: isLevelUnlocked(l.id),
        weather: e2eWeather(l.enemies),
      }))
    },
    startLevel: (id: string, seed?: number, variant?: RideVariant) => useGameStore.getState().startRun(id, { seed, variant }),
    variant: () => useGameStore.getState().runVariant,
    restartLevel: () => useGameStore.getState().restartRun('results'),
    levelReady: () => {
      const { sceneReady, currentLevel } = useGameStore.getState()
      return sceneReady && api.shaderWarmup?.levelId === currentLevel
    },
    setPhase: (phase: GamePhase) => useGameStore.getState().setPhase(phase),
    setSavedScores: (scores: Record<string, ScoreEntry>) => useGameStore.setState({ savedScores: scores }),
    setLeaderboards: (boards, lastInitials) =>
      useGameStore.setState(lastInitials === undefined ? { leaderboards: boards } : { leaderboards: boards, lastInitials }),
    leaderboards: () => {
      const s = useGameStore.getState()
      return { boards: s.leaderboards, lastInitials: s.lastInitials }
    },
    onlineBoard: (endpoint) => setOnlineEndpointOverride(endpoint),
    daily: () => {
      const dateKey = dailyKey(new Date())
      const s = useGameStore.getState()
      return {
        dateKey,
        seed: dailySeed(dateKey),
        level: dailyLevel(dateKey),
        runMode: s.runMode,
        savedDaily: s.savedDaily,
        streak: s.dailyStreak,
      }
    },
    spawnDigest: () => spawnDigest,
    nextWave: () => waveProbe?.() ?? null,
    waveTellSeconds: WAVE_TELL_SECONDS,
    waveEvents: [],
    audio: readAudio,
    audioBurst,
    renderAudio: (req, seed) => import('./audioRender').then((m) => m.renderAudio(req, seed)),
    phase: () => useGameStore.getState().phase,
    enemies: enemiesOnScreen,
    errors: [],
    runLog: [],
    combat: { fired: 0, hits: 0, kills: 0 },
    cameraTranslation: { current: 0, max: 0 },
    cameraTrauma: { current: 0, max: 0 },
    cameraWeight: {
      roll: 0, pitch: 0, fovKick: 0, maxRoll: 0, maxPitch: 0, maxFovKick: 0, speed: 0, streaks: 0, maxStreaks: 0,
      feel: { launch: 0, dip: 0, airtime: 0, lift: 0, rumble: 0 },
      feelMax: { launch: 0, dip: 0, airtime: 0, lift: 0, rumble: 0 },
      caps: { roll: RIG_MAX_ROLL_DEG, pitch: RIG_MAX_PITCH_DEG, fovKick: MAX_FOV_KICK_DEG, streakSpeed: STREAK_SPEED_THRESHOLD },
    },
    tunnel: { spans: [], index: -1, depth: 0 },
    darkSection: { spans: [], depth: 0, flash: 0 },
    weather: null,
    weapon: null,
    holdFeedback: false,
    bulletStep: null,
    timerStep: null,
    timerStepMax: null,
    stopAtLevelTime: null,
    holdLevelTime: false,
    rideRate: null,
    titleTime: null,
    titleAttractIdleMs: null,
    bullets: readBullets,
    fireShot: (x: number, y: number) => (probeCamera ? fireAtNDC(x, y, probeCamera) : false),
    shaderWarmup: null,
    programGrowth: [],
    initTimings: startupTimings,
    sceneStats: () => null,
    autoFire: (enabled: boolean, hitsPerSecond?: number) => {
      autoFireEnabled = enabled
      lastAutoFire = 0
      playerRate = enabled && hitsPerSecond ? hitsPerSecond : null
      lastPlayerHit = gameTime()
    },
    killNearest: (n: number) => {
      const victims = liveTargetsByDistance(probeCamera).slice(0, Math.max(0, n))
      const first = victims[0]
      if (first?.visible && probeCamera && onScreenNDC(first.t, probeCamera, _aim)) {
        fireAtNDC(_aim.x, _aim.y, probeCamera)
      }
      for (const { t } of victims) processHit(t)
      return victims.length
    },
    shootBystander: () => {
      let best: CollisionTarget | null = null
      let bestRank = Infinity
      for (const t of getCollisionTargets()) {
        if (t.kind !== 'bystander' || !isMounted(t)) continue
        const d = probeCamera ? t.getPosition().distanceToSquared(probeCamera.position) : 0
        const rank = probeCamera && onScreenNDC(t, probeCamera, _aim) ? d : d + 1e12
        if (rank < bestRank) {
          bestRank = rank
          best = t
        }
      }
      if (!best) return null
      processHit(best)
      return { id: best.id, penalty: BYSTANDER_PENALTY }
    },
    stats: () => {
      const s = useGameStore.getState()
      let liveEnemies = 0
      let onScreenEnemies = 0
      let onScreenBystanders = 0
      for (const t of getCollisionTargets()) {
        if (t.kind === 'bystander' && isMounted(t) && probeCamera && onScreenNDC(t, probeCamera, _aim)) onScreenBystanders++
        if (!isLive(t)) continue
        liveEnemies++
        if (probeCamera && onScreenNDC(t, probeCamera, _aim)) onScreenEnemies++
      }
      return {
        score: Math.round(s.score),
        kills: s.kills,
        combo: s.combo.count,
        timeRemaining: s.timeRemaining,
        phase: s.phase,
        liveEnemies,
        onScreenEnemies,
        onScreenBystanders,
        levelBystanders: bystanderCount((s.currentLevel ? getLevelConfig(s.currentLevel)?.enemies : undefined) ?? []),
        bystandersHit: s.bystandersHit.length,
        shotsFired: s.shotsFired,
        hits: s.hits,
        bestCombo: s.bestCombo,
        multiplier: s.combo.multiplier,
        timeScale: s.timeScale,
        frenzy: s.frenzy !== 'off',
        runSeed: s.runSeed,
        currentLevel: s.currentLevel,
      }
    },
    enemyScreenPoints: (n: number) => {
      if (!probeCamera) return []
      const out: { x: number; y: number }[] = []
      const ndc = new THREE.Vector3()
      for (const { t, visible } of liveTargetsByDistance(probeCamera)) {
        if (!visible || out.length >= n) break
        onScreenNDC(t, probeCamera, ndc)
        out.push({
          x: ((ndc.x + 1) / 2) * window.innerWidth,
          y: ((1 - ndc.y) / 2) * window.innerHeight,
        })
      }
      return out
    },
    primeCombo: (count: number) =>
      useGameStore.setState({ combo: { count, multiplier: comboMultiplier(count), lastKillTime: gameTime() } }),
    endLevel: () => {
      autoFireEnabled = false
      useGameStore.getState().setPhase('results')
    },
    medalsWon: () => {
      const s = useGameStore.getState()
      return s.currentLevel ? loadedMedals().medalsWon(s.currentLevel, medalRun(s)) : []
    },
    get longestComboMedal() {
      return loadedMedals().LONGEST_COMBO_MEDAL
    },
    levelMedalIds: (levelId) => loadedMedals().levelMedals(levelId).map((m) => m.id),
    setSavedMedals: (medals) => useGameStore.setState({ savedMedals: medals }),
    shareText: (worldRank: number | null = null) => {
      const s = useGameStore.getState()
      // The portal build has no Share (#254): its bundle must not carry the share link (scripts/portal/rules.mjs).
      if (__PORTAL_BUILD__) return null
      const card = s.currentLevel ? scoreCardRun({ ...s, levelId: s.currentLevel, mode: s.runMode, worldRank }) : null
      return card ? clipboardText(sharePayload(card, 'copy')) : null
    },
    scoreCard: async (size: CardSize) => {
      const s = useGameStore.getState()
      const card = s.currentLevel ? scoreCardRun({ ...s, levelId: s.currentLevel, mode: s.runMode }) : null
      if (!card) return null
      const blob = await renderScoreCard(card, size)
      const bitmap = await createImageBitmap(blob)
      const png = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      const out = { width: bitmap.width, height: bitmap.height, png, fileName: scoreCardFileName(card.levelId, card.score) }
      bitmap.close()
      return out
    },
    setTimeScale: (s: number) => setTimeScaleOverride(s === 1 ? null : s),
    introAt: null,
    intro: { mode: 'ride', length: INTRO_SECONDS, handoff: INTRO_HANDOFF_SECONDS, progress: 0, height: 0, seatOffset: 0, seatAngle: 0, anchorAngle: 0, clearance: 0, marks: null, goOffset: null, orbitSeconds: 0, seconds: null, skipped: false },
    photo: { on: false, yaw: 0, pitch: 0, radius: 0, offset: 0, clearance: 0 },
    rideTo: null,
    rideSpeed: null,
    rideProgress: 0,
    rideFastest: null,
    rideBeats: () => e2eRide.beats,
    sight: readSight,
    graphics: () => {
      const { quality, reducedMotion } = useSettingsStore.getState()
      return { quality, profile: qualityProfile(quality), adaptiveSteps: getAdaptiveSteps(), reducedMotion }
    },
    triggerHeld: () => getPointerState().down,
    aimPoint: () => {
      const p = getPointerState()
      return { x: p.x, y: p.y }
    },
    summonBoss: () => { e2eBoss.summon = useGameStore.getState().runId },
    boss: readBoss,
    view: readView,
    bossHit,
    projectileHit,
    bossStep: null,
    bossEvents: { spawn: 0, hit: 0, defeated: 0 },
    fireworks: readFireworks,
    deaths: readDeaths,
    particles: () => ({ ...e2eParticles }),
    weaponState: () => {
      const { weapon } = useGameStore.getState()
      const now = gameTime()
      return { active: activeWeapon(weapon, now).id, pickup: weapon.id, remaining: pickupRemaining(weapon, now) }
    },
    pickups: readPickups,
    trackSwitch: readSwitch,
  }
  eventBus.on('boss:spawn', () => { api.bossEvents.spawn += 1 })
  eventBus.on('boss:hit', () => { api.bossEvents.hit += 1 })
  eventBus.on('boss:defeated', () => { api.bossEvents.defeated += 1 })
  eventBus.on('weapon:fire', () => { api.combat.fired += 1 })
  eventBus.on('enemy:hit', () => { api.combat.hits += 1 })
  eventBus.on('enemy:killed', () => { api.combat.kills += 1 })
  const onWave = (kind: 'incoming' | 'announce') => (label: unknown) => {
    const w = waveProbe?.()
    api.waveEvents.push({ kind, label: String(label), ms: performance.now(), levelTime: w?.levelTime ?? null, due: w?.due ?? null, lastTick: w?.lastTick ?? null })
  }
  eventBus.on('wave:incoming', onWave('incoming'))
  eventBus.on('wave:announce', onWave('announce'))
  window.addEventListener('error', (e) => api.errors.push(String(e.error?.stack ?? e.message)))
  window.addEventListener('unhandledrejection', (e) => api.errors.push(String(e.reason)))
  window.__SC_TEST__ = api
  logRunChanges(api)
}

/** Spin (max 20 ms) until AudioContext.currentTime moves, which it does mid-task. */
function waitForAudioTick() {
  const ctx = audioContext()
  const t0 = ctx.currentTime
  const deadline = performance.now() + 20
  while (ctx.currentTime === t0 && performance.now() < deadline) { /* spin */ }
}

/** Spin (max 100 ms) until AudioContext.currentTime has moved `seconds`. */
function waitForAudioTime(seconds: number) {
  const ctx = audioContext()
  const t0 = ctx.currentTime
  const deadline = performance.now() + 500
  while (ctx.currentTime - t0 < seconds && performance.now() < deadline) { /* spin */ }
}

const BURST_WEAPONS = ['blaster', 'spread', 'rapid', 'piercing'] as const
/** Kills a little apart on the audio clock, as a real fight's are. */
const BURST_KILL_SPACING_S = 0.035
/** The first kill's chain: a step above the top tier, falling to the 1× tier by the last. */
const BURST_TOP_COMBO = COMBO_TIERS[TOP_TIER].minCount + 1

async function audioBurst(shots: number, kills: number) {
  if (!isAudioReady()) await initAudio()
  const { currentLevel } = useGameStore.getState()
  await sfx().prepare(currentLevel, (currentLevel ? getLevelConfig(currentLevel)?.biome : undefined) ?? 'themePark')
  ;(await loadArcade()).resetVoiceStats()
  const s = sfx()
  const killsBefore = s.killsPlayed()
  for (let i = 0; i < shots; i++) {
    s.fire(i % 2 === 1, BURST_WEAPONS[i % BURST_WEAPONS.length])
    if (i < kills) {
      waitForAudioTime(BURST_KILL_SPACING_S)
      const combo = Math.ceil(((kills - i) / kills) * BURST_TOP_COMBO)
      s.hit(combo, null)
      s.kill(combo, 'pop', null)
    }
    waitForAudioTick()
  }
  const killsPlayed = s.killsPlayed() - killsBefore
  s.waveIncoming()
  return { ...readAudio(), killsPlayed }
}

function readAudio(): E2EAudio {
  const d = droppedSounds()
  return {
    ready: isAudioReady(),
    engineLoaded: scrimPlayer() !== null,
    sfxNodes: sfx().nodeCount(),
    sfxVoices: sfx().voices(),
    musicDucked: isMusicDucked(),
    pauseMix: isPauseMixOn(),
    dropped: d.count,
    lastDrop: d.last,
    music: isAudioReady() ? musicState() : { buses: [], fades: [] },
    scrim: scrimPlayer()?.scrimState() ?? null,
  }
}

const _poseDir = new THREE.Vector3()
const _posePos = new THREE.Vector3()

function readCameraPose() {
  const cam = probeCamera
  if (!cam) return null
  cam.getWorldDirection(_poseDir)
  const p = cam.getWorldPosition(_posePos)
  return { position: [p.x, p.y, p.z] as [number, number, number], forward: [_poseDir.x, _poseDir.y, _poseDir.z] as [number, number, number] }
}

function pointCentreColour(name: string): [number, number, number, number] | null {
  const gl = probeGl
  const source = probeScene?.getObjectByName(name)
  if (!gl || !(source instanceof THREE.Points)) return null
  // The first vertex's attributes, at the origin
  const geometry = new THREE.BufferGeometry()
  const attributes = source.geometry.attributes as Record<string, THREE.BufferAttribute>
  for (const [key, attr] of Object.entries(attributes)) {
    const values = new Float32Array(attr.itemSize)
    if (key !== 'position') for (let c = 0; c < attr.itemSize; c++) values[c] = attr.getComponent(0, c)
    geometry.setAttribute(key, new THREE.BufferAttribute(values, attr.itemSize))
  }
  const scene = new THREE.Scene()
  scene.add(new THREE.Points(geometry, source.material))
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100)
  camera.position.set(0, 0, 10)
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType })
  const prevTarget = gl.getRenderTarget()
  const prevClear = gl.getClearColor(new THREE.Color())
  const prevAlpha = gl.getClearAlpha()
  gl.setRenderTarget(target)
  gl.setClearColor(0x808080, 1)
  gl.clear()
  gl.render(scene, camera)
  const px = new Float32Array(4)
  gl.readRenderTargetPixels(target, 0, 0, 1, 1, px)
  gl.setRenderTarget(prevTarget)
  gl.setClearColor(prevClear, prevAlpha)
  target.dispose()
  geometry.dispose()
  return [px[0], px[1], px[2], px[3]]
}

/** Canvas element captured by <E2EFrameProbe> for view(). */
let probeCanvas: HTMLCanvasElement | null = null
let probeGl: THREE.WebGLRenderer | null = null
let probeScene: THREE.Scene | null = null
let probeDpr = 1

function readView(): E2EView | null {
  const cam = probeCamera
  const canvas = probeCanvas
  if (!cam || !canvas) return null
  const r = canvas.getBoundingClientRect()
  const persp = cam instanceof THREE.PerspectiveCamera ? cam : null
  const hFov = persp
    ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(persp.fov) / 2) * persp.aspect))
    : null
  return {
    cameraAspect: persp ? persp.aspect : null,
    canvasAspect: r.height > 0 ? r.width / r.height : 0,
    canvasWidth: r.width,
    canvasHeight: r.height,
    bufferWidth: canvas.width,
    bufferHeight: canvas.height,
    dpr: probeDpr,
    fov: persp ? persp.fov : null,
    hFov,
  }
}

/** Mount inside <Canvas>. Counts frames and samples renderer stats. */
export function E2EFrameProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const api = window.__SC_TEST__
    if (api) api.sceneStats = () => collectSceneStats(scene)
  }, [scene])
  useFrame((state, delta) => {
    const api = window.__SC_TEST__
    if (!api) return
    if (gpuSync) waitForGpu(gl)
    probeCamera = state.camera
    probeSize = state.size
    probeCanvas = state.gl.domElement
    probeGl = state.gl
    probeScene = state.scene
    probeDpr = state.viewport.dpr
    if (autoFireEnabled) autoFireTick(state.camera)
    // Post-processing renders several passes per frame, and three.js resets
    // gl.info on every render() call by default. Accumulate manually instead:
    // read last frame's totals, then reset before this frame renders.
    if (gl.info.autoReset) gl.info.autoReset = false
    api.frames += 1
    const ms = delta * 1000
    api.avgFrameMs = api.avgFrameMs === 0 ? ms : api.avgFrameMs + (ms - api.avgFrameMs) / 120
    if (ms > api.maxFrameMs) api.maxFrameMs = ms
    if (ms >= LONG_FRAME_MS) api.longFrames++
    api.drawCalls = gl.info.render.calls
    api.triangles = gl.info.render.triangles
    gl.info.reset()
    noteProgramGrowth(api, gl.info.programs?.length ?? 0)
  })
  return null
}

function collectSceneStats(scene: THREE.Scene): SceneStats {
  const env = scene.environment
  const stats: SceneStats = {
    objects: 0,
    triangles: 0,
    byName: {},
    environment: env
      ? { name: env.name, intensity: scene.environmentIntensity, bakeMs: (env.userData.bakeMs as number | undefined) ?? null }
      : null,
  }
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number }
    if (!m.isMesh || !m.geometry) return
    const g = m.geometry
    const verts = g.index ? g.index.count : (g.attributes.position?.count ?? 0)
    const tris = Math.floor(verts / 3) * (m.isInstancedMesh ? (m.count ?? 1) : 1)
    stats.objects += 1
    stats.triangles += tris
    if (m.name) {
      const key = m.name
      const e = (stats.byName[key] ??= { objects: 0, triangles: 0 })
      e.objects += 1
      e.triangles += tris
    }
  })
  return stats
}
