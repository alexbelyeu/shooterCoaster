/**
 * Renders every arcade recipe once, in one OfflineAudioContext (laid end to end), then cuts the result into one
 * mono AudioBuffer per sound: silence trimmed, normalised to 0 dBFS peak (`ARCADE_SOUNDS.db` sets the level), loops
 * folded seamless. Runs on the audio rendering thread, off the frame loop; a level bakes in well under its countdown.
 */
import { createRng } from '@/utils/rng'
import type { ArcadeSoundId } from '../sfxDesign'
import { createCore } from '../scrim/synth'
import { RECIPES, type BakeSpec } from './recipes'

export type Bank = Map<ArcadeSoundId, AudioBuffer[]>

const GAP_S = 0.05
/** Trim each sound where it stays this far under its own peak. */
const TRIM_DB = -72
const FADE_S = 0.003
/** The last share of each slot (at most this long) fades its sound out. */
const GATE_FADE_SHARE = 0.25
const GATE_FADE_MAX_S = 0.4
/** "Nothing below 30 Hz": two 12 dB/oct high-passes on the whole bake. */
const HIGH_PASS_HZ = 32

interface Slot {
  id: ArcadeSoundId
  start: number
  length: number
  loopS: number | null
}

export async function bakeBank(spec: BakeSpec, sampleRate: number, seed: number): Promise<Bank> {
  const slots: Slot[] = []
  let t = GAP_S
  for (const r of RECIPES) {
    if (r.when && !r.when(spec)) continue
    for (let v = 0; v < (r.variants ?? 1); v++) {
      const length = r.lengthS(spec, v)
      slots.push({ id: r.id, start: t, length, loopS: r.loopS ? r.loopS(spec) : null })
      t += length + GAP_S
    }
  }
  const ctx = new OfflineAudioContext(1, Math.ceil(t * sampleRate), sampleRate)
  const hp1 = ctx.createBiquadFilter()
  const hp2 = ctx.createBiquadFilter()
  for (const hp of [hp1, hp2]) {
    hp.type = 'highpass'
    hp.frequency.value = HIGH_PASS_HZ
    hp.Q.value = 0.7
  }
  hp1.connect(hp2).connect(ctx.destination)

  // The graph is built in this turn, before the render: a fixed seed makes every bake of a level the same.
  const random = Math.random
  Math.random = createRng(seed)
  try {
    const S = createCore(ctx)
    let i = 0
    for (const r of RECIPES) {
      if (r.when && !r.when(spec)) continue
      for (let v = 0; v < (r.variants ?? 1); v++) {
        const slot = slots[i++]
        r.render(S, gate(ctx, slot, hp1), slot.start, spec, v)
      }
    }
  } finally {
    Math.random = random
  }

  const rendered = (await ctx.startRendering()).getChannelData(0)
  const bank: Bank = new Map()
  for (const s of slots) {
    const from = Math.round(s.start * sampleRate)
    const data = rendered.slice(from, from + Math.round(s.length * sampleRate))
    const pcm = s.loopS ? foldLoop(data, Math.round(s.loopS * sampleRate)) : trimTail(data, sampleRate)
    normalise(pcm)
    const buffer = new AudioBuffer({ length: pcm.length, numberOfChannels: 1, sampleRate })
    buffer.copyToChannel(pcm, 0)
    const list = bank.get(s.id)
    if (list) list.push(buffer)
    else bank.set(s.id, [buffer])
  }
  return bank
}

/** A sound's own way into the bake, faded shut at the end of its slot so a long ring never bleeds into the next sound. */
function gate(ctx: BaseAudioContext, slot: Slot, out: AudioNode): GainNode {
  const g = ctx.createGain()
  const end = slot.start + slot.length
  const fade = Math.min(slot.length * GATE_FADE_SHARE, GATE_FADE_MAX_S)
  g.gain.setValueAtTime(1, end - fade)
  g.gain.linearRampToValueAtTime(0, end)
  g.connect(out)
  return g
}

function peakOf(pcm: Float32Array): number {
  let peak = 0
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]))
  return peak
}

/** Up to where the sound last rises above `TRIM_DB` under its peak, with a short fade-out. */
export function trimTail(pcm: Float32Array<ArrayBuffer>, sampleRate: number): Float32Array<ArrayBuffer> {
  const floor = peakOf(pcm) * Math.pow(10, TRIM_DB / 20)
  let end = pcm.length
  while (end > 1 && Math.abs(pcm[end - 1]) <= floor) end--
  const out = pcm.subarray(0, end)
  const fade = Math.min(end, Math.round(FADE_S * sampleRate))
  for (let i = 0; i < fade; i++) out[end - 1 - i] *= i / fade
  return out
}

/** Wraps everything past `n` samples back onto the start, so the loop's tails ring across its seam. */
export function foldLoop(pcm: Float32Array<ArrayBuffer>, n: number): Float32Array<ArrayBuffer> {
  const out = pcm.slice(0, n)
  for (let i = n; i < pcm.length; i++) out[i % n] += pcm[i]
  return out
}

export function normalise(pcm: Float32Array): void {
  const peak = peakOf(pcm)
  if (peak > 0) for (let i = 0; i < pcm.length; i++) pcm[i] /= peak
}
