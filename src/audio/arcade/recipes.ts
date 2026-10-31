/**
 * The arcade SFX, built from the score engine's synth (`scrim/synth.ts`): each recipe draws one sound into a bake
 * context (`bake.ts`), which renders them all to AudioBuffers once per level. Levels, priorities and sends are in
 * `sfxDesign.ts` (`ARCADE_SOUNDS`); musical ones are written in scale degrees of the level score's key.
 */
import type { BiomeType } from '@/types/level'
import { keyNote, WHISTLE_LENGTHS_S, FIREWORK_SFX, type ArcadeSoundId, type KillSound, type MusicKey } from '../sfxDesign'
import { hitDrum, playInstrument, toolbox, type SynthCore } from '../scrim/synth'

const { G, F, O, perc, partial, noise, noiseSrc } = toolbox

export interface BakeSpec {
  key: MusicKey
  /** One beat of the level score, s. */
  beatS: number
  beats: number
  biome: BiomeType
  boss: boolean
  fireworks: boolean
}

export interface Recipe {
  id: ArcadeSoundId
  /** Takes this long at most (the bake trims the silence after it). */
  lengthS: (b: BakeSpec, variant: number) => number
  render: (S: SynthCore, out: AudioNode, t: number, b: BakeSpec, variant: number) => void
  variants?: number
  /** Folded into a seamless loop of this many seconds. */
  loopS?: (b: BakeSpec) => number
  when?: (b: BakeSpec) => boolean
}

/** Notes of `degrees` in the key, `octave` octaves up, as one chord on `inst`. */
function chord(S: SynthCore, out: AudioNode, inst: string, t: number, d: number, b: BakeSpec, degrees: readonly number[], octave: number, vel: number) {
  const v = vel / Math.sqrt(degrees.length)
  for (const deg of degrees) playInstrument(S, out, inst, t, d, keyNote(b.key, deg, octave), v)
}

/** Notes of `degrees` one after another, `stepS` apart. */
function run(S: SynthCore, out: AudioNode, inst: string, t: number, stepS: number, d: number, b: BakeSpec, degrees: readonly number[], octave: number, vel: number) {
  degrees.forEach((deg, i) => playInstrument(S, out, inst, t + i * stepS, d, keyNote(b.key, deg, octave), vel * (0.8 + 0.2 * (i / degrees.length))))
}

/** A falling pitched oscillator through a closing low-pass: the zap in guns and pops. */
function zap(S: SynthCore, out: AudioNode, t: number, type: OscillatorType, fromHz: number, toHz: number, sweepS: number, tau: number, peak: number) {
  const g = G(S)
  const lp = F(S, 'lowpass', 6000, 0.8)
  lp.connect(g).connect(out)
  const end = perc(g.gain, t, { a: 0.001, tau, peak })
  const o = O(S, type, fromHz, t, end)
  o.frequency.setValueAtTime(fromHz, t)
  o.frequency.exponentialRampToValueAtTime(toHz, t + sweepS)
  lp.frequency.setValueAtTime(7000, t)
  lp.frequency.exponentialRampToValueAtTime(900, t + sweepS * 1.2)
  o.connect(lp)
}

/** Noise through a band-pass swept from `fromHz` to `toHz`, held at `peak` for `s`: whooshes and whistles. */
function sweep(S: SynthCore, out: AudioNode, t: number, s: number, fromHz: number, toHz: number, q: number, peak: number) {
  const src = noiseSrc(S, t, t + s + 0.1)
  const bp = F(S, 'bandpass', fromHz, q)
  bp.frequency.setValueAtTime(fromHz, t)
  bp.frequency.exponentialRampToValueAtTime(toHz, t + s)
  const g = G(S)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + Math.min(0.05, s / 4))
  g.gain.setValueAtTime(peak, t + s - 0.04)
  g.gain.linearRampToValueAtTime(0, t + s + 0.04)
  src.connect(bp).connect(g).connect(out)
}

const fixed = (s: number) => () => s

/** Kill bodies by death style (`effects/deathStyles.ts`): what the enemy is made of. */
const KILL_BODIES: Record<KillSound, { lengthS: number; render: (S: SynthCore, out: AudioNode, t: number) => void }> = {
  // Balloon: a rubbery snap, a pitched plip and a punch.
  pop: { lengthS: 0.45, render(S, out, t) {
    noise(S, out, t, { type: 'highpass', f: 5000, q: 0.5, a: 0.0005, tau: 0.012, peak: 0.7 })
    noise(S, out, t, { type: 'bandpass', f: 1600, q: 0.6, a: 0.0005, tau: 0.035, peak: 1 })
    partial(S, out, t, 1320, { type: 'triangle', a: 0.001, tau: 0.06, peak: 0.45, bend: 1.5, bendTau: 0.015 })
    partial(S, out, t, 95, { a: 0.001, tau: 0.05, peak: 0.8, bend: 2.2, bendTau: 0.01 })
  } },
  // Bird: a burst of wing flaps falling in pitch.
  flutter: { lengthS: 0.4, render(S, out, t) {
    for (let i = 0; i < 6; i++) noise(S, out, t + i * 0.026, { type: 'bandpass', f: 1250 - i * 110, q: 1.1, a: 0.002, tau: 0.012, peak: 0.85 * (1 - i * 0.12) })
    noise(S, out, t, { type: 'highpass', f: 4000, q: 0.5, a: 0.0005, tau: 0.01, peak: 0.6 })
    partial(S, out, t, 760, { type: 'triangle', a: 0.001, tau: 0.04, peak: 0.35, bend: 1.3, bendTau: 0.02 })
    partial(S, out, t, 110, { a: 0.001, tau: 0.045, peak: 0.7, bend: 2, bendTau: 0.01 })
  } },
  // Stone, snow, scale: a tight low crunch with grit.
  crunch: { lengthS: 0.4, render(S, out, t) {
    for (let i = 0; i < 4; i++) noise(S, out, t + i * 0.011, { type: 'lowpass', f: 2200 - i * 300, q: 0.7, a: 0.0005, tau: 0.02, peak: 0.9 - i * 0.15 })
    partial(S, out, t, 230, { type: 'triangle', a: 0.001, tau: 0.07, peak: 0.6, bend: 1.4, bendTau: 0.02 })
    partial(S, out, t, 72, { a: 0.002, tau: 0.08, peak: 0.9, bend: 2, bendTau: 0.015 })
  } },
  // Water: a splash wash with falling bubbles.
  splash: { lengthS: 0.55, render(S, out, t) {
    noise(S, out, t, { type: 'lowpass', f: 3200, q: 0.5, a: 0.002, tau: 0.11, peak: 0.85 })
    noise(S, out, t, { type: 'highpass', f: 5000, q: 0.5, a: 0.001, tau: 0.04, peak: 0.45 })
    for (let i = 0; i < 4; i++) partial(S, out, t + 0.02 + i * 0.045, 980 - i * 140, { a: 0.002, tau: 0.03, peak: 0.35, bend: 0.6, bendTau: 0.02 })
    partial(S, out, t, 90, { a: 0.002, tau: 0.06, peak: 0.7, bend: 2, bendTau: 0.012 })
  } },
  // Fire: a flare of hiss over a dull thump.
  hiss: { lengthS: 0.55, render(S, out, t) {
    noise(S, out, t, { type: 'highpass', f: 3800, q: 0.5, a: 0.003, tau: 0.13, peak: 0.75 })
    noise(S, out, t, { type: 'bandpass', f: 1400, q: 0.8, a: 0.001, tau: 0.04, peak: 0.7 })
    partial(S, out, t, 2600, { a: 0.001, tau: 0.02, peak: 0.25 })
    partial(S, out, t, 80, { a: 0.002, tau: 0.06, peak: 0.8, bend: 2.4, bendTau: 0.012 })
  } },
}

function killBody(sound: KillSound): Recipe {
  const body = KILL_BODIES[sound]
  return { id: `kill.${sound}`, lengthS: fixed(body.lengthS), render: (S, out, t) => body.render(S, out, t) }
}

export const RECIPES: readonly Recipe[] = [
  // The blaster: a click, a square zap falling 1.1 kHz → 170 Hz, a sub punch and a breath of air. Dry and short.
  { id: 'fire', variants: 2, lengthS: fixed(0.16), render(S, out, t, _b, variant) {
    const k = variant ? 0.93 : 1
    noise(S, out, t, { type: 'highpass', f: 3500, q: 0.7, a: 0.0005, tau: 0.003, peak: 0.9 })
    zap(S, out, t, 'square', 1100 * k, 170 * k, 0.06, 0.02, 0.55)
    partial(S, out, t, 58 * k, { a: 0.001, tau: 0.026, peak: 0.8, bend: 3, bendTau: 0.012 })
    noise(S, out, t + 0.004, { type: 'bandpass', f: 2200, q: 1.2, a: 0.001, tau: 0.016, peak: 0.35 })
  } },
  // Hit: a bright metallic tink.
  { id: 'hit', lengthS: fixed(0.08), render(S, out, t) {
    partial(S, out, t, 2900, { a: 0.0005, tau: 0.014, peak: 0.6 })
    partial(S, out, t, 4350, { a: 0.0005, tau: 0.008, peak: 0.35 })
    partial(S, out, t, 1450, { type: 'triangle', a: 0.0005, tau: 0.01, peak: 0.3 })
    noise(S, out, t, { type: 'bandpass', f: 6000, q: 1.5, a: 0.0005, tau: 0.004, peak: 0.5 })
  } },
  killBody('pop'),
  killBody('flutter'),
  killBody('crunch'),
  killBody('splash'),
  killBody('hiss'),
  // 2×: a kick under the body.
  { id: 'kill.thump', lengthS: fixed(0.4), render(S, out, t) {
    hitDrum(S, out, 'kick', t, 1)
    hitDrum(S, out, 'tomlo', t, 0.5)
  } },
  // 3×: a coin ding in key (fifth, then octave).
  { id: 'kill.ring', lengthS: fixed(0.8), render(S, out, t, b) {
    playInstrument(S, out, 'glock', t, 0.1, keyNote(b.key, 4, 2), 0.9)
    playInstrument(S, out, 'glock', t + 0.055, 0.2, keyNote(b.key, 7, 2), 1)
  } },
  // 5×: a pinball payout run up the key (the FRENZY sting has the crash; one per kill would wash out the chain).
  { id: 'kill.payout', lengthS: fixed(0.7), render(S, out, t, b) {
    run(S, out, 'glock', t, 0.032, 0.06, b, [0, 2, 4, 7, 9], 1, 0.9)
  } },
  // Chain lost: a chromatic power-down from the fifth, then a falling triangle.
  { id: 'comboBreak', lengthS: fixed(0.6), render(S, out, t, b) {
    const top = keyNote(b.key, 4, 0)
    for (let i = 0; i < 3; i++) playInstrument(S, out, 'chip', t + i * 0.075, 0.06, top - i, 0.8 - i * 0.1)
    zap(S, out, t + 0.225, 'triangle', 330, 90, 0.25, 0.07, 0.5)
  } },
  // FRENZY: two brass stabs on the beat (tonic, then the octave), crash, kick and timpani, a glock run between.
  { id: 'frenzy', lengthS: (b) => b.beatS * 2 + 1.2, render(S, out, t, b) {
    hitDrum(S, out, 'crash', t, 1)
    hitDrum(S, out, 'kick', t, 1)
    playInstrument(S, out, 'timpani', t, 0.4, keyNote(b.key, 0, -2), 1)
    chord(S, out, 'brass', t, b.beatS * 0.45, b, [0, 2, 4, 7], 0, 1.3)
    run(S, out, 'glock', t + b.beatS * 0.25, b.beatS / 8, 0.06, b, [0, 2, 4, 7], 1, 0.7)
    chord(S, out, 'brass', t + b.beatS, b.beatS * 0.9, b, [0, 2, 4, 7], 1, 1.3)
    hitDrum(S, out, 'kick', t + b.beatS, 0.9)
    hitDrum(S, out, 'crash', t + b.beatS, 0.6)
  } },
  // FRENZY lift: one bar on the score's grid, looped while the 5× tier holds: sixteenth hats and an arpeggio.
  { id: 'frenzyLift', lengthS: (b) => b.beatS * b.beats + 0.6, loopS: (b) => b.beatS * b.beats, render(S, out, t, b) {
    const step = b.beatS / 4
    const arp = [0, 2, 4, 7, 9, 7, 4, 2]
    for (let i = 0; i < b.beats * 4; i++) {
      hitDrum(S, out, 'hat', t + i * step, i % 2 ? 0.45 : 0.85)
      if (i % 2 === 0) playInstrument(S, out, 'chip', t + i * step, step * 0.9, keyNote(b.key, arp[(i / 2) % arp.length], 1), 0.55)
    }
  } },
  // Wave incoming: V (major, so harmonic minor too) then I on brass, a tom under each, on the beat.
  { id: 'waveTell', lengthS: (b) => b.beatS * 2 + 0.9, render(S, out, t, b) {
    for (const n of [7, 11, 14]) playInstrument(S, out, 'brass', t, b.beatS * 0.4, b.key.tonic - 12 + n, 1.2 / Math.sqrt(3))
    hitDrum(S, out, 'tommid', t, 0.9)
    chord(S, out, 'brass', t + b.beatS, b.beatS * 0.9, b, [0, 2, 4, 7], 0, 1.3)
    hitDrum(S, out, 'tomlo', t + b.beatS, 1)
    hitDrum(S, out, 'crash', t + b.beatS, 0.45)
  } },
  // The Golden Blimp's balloon: the pop, then coins up the key and a bell on the octave.
  { id: 'goldenBalloon', lengthS: fixed(1.4), when: (b) => b.boss, render(S, out, t, b) {
    KILL_BODIES.pop.render(S, out, t)
    run(S, out, 'glock', t + 0.04, 0.045, 0.08, b, [0, 2, 4, 7, 9], 1, 1)
    playInstrument(S, out, 'bell', t + 0.27, 0.3, keyNote(b.key, 7, 1), 0.8)
  } },
  // Boss arrives: minor i → bVI → V on low brass and timpani, a gong under the last.
  { id: 'bossArrival', lengthS: fixed(3.2), when: (b) => b.boss, render(S, out, t, b) {
    const root = b.key.tonic - 12
    const chords = [[0, 3, 7], [-4, 0, 3], [-5, -1, 2]]
    chords.forEach((c, i) => {
      const at = t + i * 0.32
      const last = i === chords.length - 1
      for (const n of c) playInstrument(S, out, 'brass', at, last ? 0.9 : 0.26, root + n, 0.75)
      playInstrument(S, out, 'timpani', at, 0.3, root - 12 + c[0], 1)
    })
    hitDrum(S, out, 'gong', t + 0.64, 0.9)
  } },
  // Boss hit: a low tom and a metal clank.
  { id: 'bossHit', lengthS: fixed(0.4), when: (b) => b.boss, render(S, out, t) {
    hitDrum(S, out, 'tomlo', t, 1)
    partial(S, out, t, 520, { type: 'square', a: 0.001, tau: 0.03, peak: 0.25 })
    partial(S, out, t, 1230, { a: 0.001, tau: 0.02, peak: 0.25 })
    noise(S, out, t, { type: 'bandpass', f: 2600, q: 2, a: 0.0005, tau: 0.01, peak: 0.4 })
  } },
  // Boss down: a low boom, crash and gong, then a major chord on brass with a glock run.
  { id: 'bossDefeat', lengthS: fixed(3.2), when: (b) => b.boss, render(S, out, t, b) {
    hitDrum(S, out, 'kick', t, 1)
    hitDrum(S, out, 'crash', t, 1)
    hitDrum(S, out, 'gong', t, 0.7)
    noise(S, out, t, { type: 'lowpass', f: 700, q: 0.5, a: 0.005, tau: 0.25, peak: 1 })
    const major = { tonic: b.key.tonic, minor: false }
    const at = t + 0.18
    for (const n of [0, 4, 7, 12]) playInstrument(S, out, 'brass', at, 1, major.tonic + n, 0.6)
    run(S, out, 'glock', at, 0.05, 0.1, { ...b, key: major }, [0, 2, 4, 7, 9, 11, 14], 1, 0.7)
  } },
  // Firework rocket: a whistle rising through a narrow band; baked at three lengths.
  { id: 'fireworkWhistle', variants: WHISTLE_LENGTHS_S.length, lengthS: (_b, v) => WHISTLE_LENGTHS_S[v] + 0.15, when: (b) => b.fireworks,
    render(S, out, t, _b, v) {
      const { startHz, endHz, q } = FIREWORK_SFX.whistle
      sweep(S, out, t, WHISTLE_LENGTHS_S[v], startHz, endHz, q, 1)
    } },
  // Firework burst: a crackling crack over a kick.
  { id: 'fireworkPop', lengthS: fixed(1), when: (b) => b.fireworks, render(S, out, t) {
    noise(S, out, t, { type: 'lowpass', f: 3200, q: 0.5, a: 0.001, tau: 0.08, peak: 1 })
    for (let i = 0; i < 7; i++) noise(S, out, t + 0.06 + i * 0.05 + (i % 3) * 0.013, { type: 'highpass', f: 5000, q: 0.5, a: 0.0005, tau: 0.01, peak: 0.5 - i * 0.05 })
    hitDrum(S, out, 'kick', t, 0.7)
  } },
  // Results stars: bell + glock on the third, fifth and octave.
  ...[2, 4, 7].map((deg, i): Recipe => ({ id: `star${i + 1}` as ArcadeSoundId, lengthS: fixed(1.6), render(S, out, t, b) {
    playInstrument(S, out, 'bell', t, 0.4, keyNote(b.key, deg, 1), 0.9)
    playInstrument(S, out, 'glock', t, 0.2, keyNote(b.key, deg, 2), 0.6)
  } })),
  // Menus: a chip blip, a two-note back, a rising launch over a whoosh.
  { id: 'uiSelect', lengthS: fixed(0.12), render(S, out, t, b) {
    playInstrument(S, out, 'chip', t, 0.03, keyNote(b.key, 4, 1), 0.9)
  } },
  { id: 'uiBack', lengthS: fixed(0.22), render(S, out, t, b) {
    playInstrument(S, out, 'chip', t, 0.04, keyNote(b.key, 4, 1), 0.85)
    playInstrument(S, out, 'chip', t + 0.06, 0.06, keyNote(b.key, 0, 1), 0.85)
  } },
  { id: 'uiLaunch', lengthS: fixed(0.7), render(S, out, t, b) {
    run(S, out, 'chip', t, 0.045, 0.04, b, [0, 2, 4, 7], 1, 0.9)
    sweep(S, out, t, 0.35, 400, 4000, 1.2, 0.5)
  } },
  // Countdown: Ready / Set on the tonic, GO an octave up with the fifth and a crash.
  { id: 'countReady', lengthS: fixed(0.35), render(S, out, t, b) {
    playInstrument(S, out, 'chip', t, 0.12, keyNote(b.key, 0, 1), 1)
  } },
  { id: 'countGo', lengthS: fixed(0.9), render(S, out, t, b) {
    chord(S, out, 'chip', t, 0.35, b, [0, 4, 7], 1, 1.4)
    hitDrum(S, out, 'crash', t, 0.4)
  } },
]
