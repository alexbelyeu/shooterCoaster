/** The page's one AudioContext and its master chain: score → duck → pause gain and arcade → pause gate, both into a hard-knee limiter. */
import { useSettingsStore } from '@/store/useSettingsStore'

let liveContext: AudioContext | null = null
/** The context sounds are built in: the live one, or an offline render's while it runs (`swapInOfflineContext`). */
let context: BaseAudioContext | null = null
/** An offline render scripts its own clock: its context's `currentTime` stays 0 until it renders. */
let clock: (() => number) | null = null
let initialized = false
let starting: Promise<void> | null = null
const readyListeners = new Set<() => void>()

function resumeLiveContext(): void {
  if (liveContext && liveContext.state !== 'running') liveContext.resume().catch(() => {})
}

/**
 * Creates the page's AudioContext, or resumes it, synchronously: call it from every gesture handler that wants sound.
 * iOS Safari starts a context only inside a gesture (a touch `pointerdown` doesn't count, the `click` after it does),
 * so each gesture must resume it, not just the first.
 */
export function unlockAudioContext(): void {
  if (!liveContext && typeof AudioContext !== 'undefined') {
    liveContext = new AudioContext({ latencyHint: 'interactive' })
    // iOS Safari interrupts the context when the tab or portal frame is hidden and resumes it only from a touchend / click.
    window.addEventListener('touchend', resumeLiveContext, { capture: true, passive: true })
    window.addEventListener('click', resumeLiveContext, { capture: true })
  }
  resumeLiveContext()
}

/** Call it from a user gesture: every call resumes the context inside its gesture, since an iOS `pointerdown` can't but the `click` after it can. */
export function initAudio(): Promise<void> {
  unlockAudioContext()
  const ctx = liveContext
  if (!ctx) return Promise.reject(new Error('no Web Audio in this browser'))
  starting ??= ctx
    .resume()
    .then(() => {
      if (!chain) {
        context = ctx
        setChain(createMasterChain(ctx))
      }
      initialized = true
      applyMix()
      syncVolumes(true)
      for (const fn of [...readyListeners]) fn()
      readyListeners.clear()
    })
    .catch((e: unknown) => {
      starting = null
      throw e
    })
  return starting
}

export function isAudioReady(): boolean {
  return initialized
}

/** Runs `fn` now if audio is ready, else once `initAudio` finishes; returns the cancel. */
export function whenAudioReady(fn: () => void): () => void {
  if (initialized) {
    fn()
    return () => {}
  }
  readyListeners.add(fn)
  return () => readyListeners.delete(fn)
}

/** The context to build sounds in; read it only while `isAudioReady()` (or inside an offline render). */
export function audioContext(): BaseAudioContext {
  if (!context) throw new Error('audio used before the first gesture unlocked it')
  return context
}

/** The audio clock: the live context's time, or an offline render's scripted time. 0 before audio unlocks. */
export function audioNow(): number {
  return clock ? clock() : (context?.currentTime ?? 0)
}

const DUCK_OPEN_HZ = 20000
const DUCK_CLOSED_HZ = 800
const DUCK_RAMP_S = 0.25
const PAUSE_MUSIC_DB = -12
const PAUSE_RAMP_S = 0.2
const VOLUME_RAMP_S = 0.08

/** A hard knee, so loud SFX stay under −1 dBTP (decision 2026-10-31-217). */
const HARD_LIMITER = { threshold: -3, ratio: 20, knee: 0, attack: 0.001, release: 0.08 }
/** DynamicsCompressor's built-in make-up gain: 0.6 × the gain it takes off a full-scale signal (Web Audio spec). */
const HARD_LIMITER_MAKEUP_DB = -0.6 * HARD_LIMITER.threshold * (1 - 1 / HARD_LIMITER.ratio)

const dbToGain = (db: number) => Math.pow(10, db / 20)

interface MasterChain {
  limiter: DynamicsCompressorNode
  /** Takes back the limiter's make-up gain. */
  trim: GainNode
  duck: BiquadFilterNode
  musicPause: GainNode
  sfxPause: GainNode
  /** The score engine's music, at the Settings music volume. */
  score: GainNode
  /** The arcade SFX, at the Settings effects volume. */
  arcade: GainNode
}

function createMasterChain(ctx: BaseAudioContext): MasterChain {
  const trim = new GainNode(ctx, { gain: dbToGain(-HARD_LIMITER_MAKEUP_DB) })
  trim.connect(ctx.destination)
  const limiter = new DynamicsCompressorNode(ctx, HARD_LIMITER)
  limiter.connect(trim)
  const musicPause = new GainNode(ctx)
  musicPause.connect(limiter)
  const sfxPause = new GainNode(ctx)
  sfxPause.connect(limiter)
  const duck = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: DUCK_OPEN_HZ, Q: 1 })
  duck.connect(musicPause)
  const score = new GainNode(ctx)
  score.connect(duck)
  const arcade = new GainNode(ctx)
  arcade.connect(sfxPause)
  return { limiter, trim, duck, musicPause, sfxPause, score, arcade }
}

/** Built by `initAudio`: read the channels only while `isAudioReady()`. */
let chain: MasterChain | null = null
let ducked = false
let pauseMix = false

// Live bindings: an offline render swaps them for the length of the render.
export let scoreChannel: AudioNode
export let arcadeChannel: AudioNode

function setChain(c: MasterChain) {
  chain = c
  scoreChannel = c.score
  arcadeChannel = c.arcade
}

/** `offlineRender.ts`: a fresh chain in `ctx` on the render's scripted clock, audio marked ready; returns the restore. */
export function swapInOfflineContext(ctx: OfflineAudioContext, renderClock: () => number): () => void {
  const live = { chain, context, initialized, ducked, pauseMix }
  context = ctx
  clock = renderClock
  const offline = createMasterChain(ctx)
  setChain(offline)
  initialized = true
  ducked = false
  pauseMix = false
  syncVolumes(true)
  return () => {
    // Rendered before the first gesture: the channels stay on the offline chain, unread until `initAudio`.
    if (live.chain) setChain(live.chain)
    else chain = null
    context = live.context
    clock = null
    initialized = live.initialized
    ducked = live.ducked
    pauseMix = live.pauseMix
    for (const node of Object.values(offline)) node.disconnect()
  }
}

/**
 * Ramps `param` from where it is now (mid-ramp included); exponential for frequencies. `seconds` 0 sets it at once.
 * `cancelAndHoldAtTime` reads "now" off the automation, which an offline render needs: there `value` is still the start value.
 */
export function rampParam(param: AudioParam, value: number, seconds: number, exponential = false) {
  const now = audioNow()
  if (seconds <= 0) {
    param.cancelScheduledValues(now)
    param.setValueAtTime(value, now)
    return
  }
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now)
  else {
    // Firefox has no hold; its `value` is the live value.
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
  }
  if (exponential) param.exponentialRampToValueAtTime(value, now + seconds)
  else param.linearRampToValueAtTime(value, now + seconds)
}

/** Slow-mo "underwater" low-pass on the music bus. */
export function setMusicDucked(on: boolean, immediate = false): void {
  if (on === ducked) return
  ducked = on
  if (chain) applyDuck(chain, immediate)
}

function applyDuck(c: MasterChain, immediate: boolean) {
  rampParam(c.duck.frequency, ducked ? DUCK_CLOSED_HZ : DUCK_OPEN_HZ, immediate ? 0 : DUCK_RAMP_S, true)
}

export function isMusicDucked(): boolean {
  return ducked
}

/** While paused: music down `PAUSE_MUSIC_DB`, SFX silent. */
export function setPauseMix(on: boolean, immediate = false): void {
  if (on === pauseMix) return
  pauseMix = on
  if (chain) applyPauseMix(chain, immediate)
}

function applyPauseMix(c: MasterChain, immediate: boolean) {
  const seconds = immediate ? 0 : PAUSE_RAMP_S
  rampParam(c.musicPause.gain, pauseMix ? dbToGain(PAUSE_MUSIC_DB) : 1, seconds)
  rampParam(c.sfxPause.gain, pauseMix ? 0 : 1, seconds)
}

/** A run can be paused or in slow-mo before the first gesture: the new chain starts in that mix. */
function applyMix() {
  if (!chain) return
  applyDuck(chain, true)
  applyPauseMix(chain, true)
}

export function isPauseMixOn(): boolean {
  return pauseMix
}

/** Settings volume + mute onto the channels: a short ramp, never a cut (a click); `immediate` for a fresh chain. */
function syncVolumes(immediate = false): void {
  if (!chain) return
  const { sfxVolume, musicVolume, muted } = useSettingsStore.getState()
  const seconds = immediate ? 0 : VOLUME_RAMP_S
  rampParam(chain.score.gain, muted ? 0 : musicVolume, seconds)
  rampParam(chain.arcade.gain, muted ? 0 : sfxVolume, seconds)
}

// Sliders and the mute button apply live, in game or on the title.
useSettingsStore.subscribe((s, prev) => {
  if (s.musicVolume !== prev.musicVolume || s.sfxVolume !== prev.sfxVolume || s.muted !== prev.muted) syncVolumes()
})
