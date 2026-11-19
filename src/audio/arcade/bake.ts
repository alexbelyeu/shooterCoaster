/** Every recipe laid end to end in one OfflineAudioContext (rendered off the main thread), cut into mono buffers normalised to 0 dBFS. */
import { createRng } from '@/utils/rng'
import type { ArcadeSoundId } from '../sfxDesign'
import { createCore } from '../scrim/synth'
import { RECIPES, type BakeSpec } from './recipes'

export type Bank = Map<ArcadeSoundId, AudioBuffer[]>

const GAP_S = 0.05
/** Trim each sound where it stays this far under its own peak. */
const TRIM_DB = -72
const FADE_S = 0.003
const GATE_FADE_SHARE = 0.25
const GATE_FADE_MAX_S = 0.4
/** "Nothing below 30 Hz": two 12 dB/oct high-passes on the whole bake. */
const HIGH_PASS_HZ = 32

/** Main-thread work per task while a bank is built: a level's bake lands in its countdown (#625). */
const TASK_BUDGET_MS = 8

interface Slot {
  recipe: (typeof RECIPES)[number]
  variant: number
  start: number
  length: number
  loopS: number | null
}

/** `step` on every item in order, yielding to the event loop each time a task has run `TASK_BUDGET_MS`. */
async function inTasks<T>(items: readonly T[], step: (item: T) => void): Promise<void> {
  let taskStart = performance.now()
  for (const item of items) {
    if (performance.now() - taskStart > TASK_BUDGET_MS) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      taskStart = performance.now()
    }
    step(item)
  }
}

export async function bakeBank(spec: BakeSpec, sampleRate: number, seed: number): Promise<Bank> {
  const slots: Slot[] = []
  let t = GAP_S
  for (const recipe of RECIPES) {
    if (recipe.when && !recipe.when(spec)) continue
    for (let variant = 0; variant < (recipe.variants ?? 1); variant++) {
      const length = recipe.lengthS(spec, variant)
      slots.push({ recipe, variant, start: t, length, loopS: recipe.loopS ? recipe.loopS(spec) : null })
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

  // The graph is built over several tasks, seeded only while each slot's recipe runs (other code runs in between):
  // every bake of a level is the same.
  const rng = createRng(seed)
  const seeded = <R>(fn: () => R): R => {
    const random = Math.random
    Math.random = rng
    try {
      return fn()
    } finally {
      Math.random = random
    }
  }
  const S = seeded(() => createCore(ctx))
  await inTasks(slots, (slot) => seeded(() => slot.recipe.render(S, gate(ctx, slot, hp1), slot.start, spec, slot.variant)))

  const rendered = (await ctx.startRendering()).getChannelData(0)
  const bank: Bank = new Map()
  await inTasks(slots, (s) => {
    const from = Math.round(s.start * sampleRate)
    const data = rendered.slice(from, from + Math.round(s.length * sampleRate))
    const pcm = s.loopS ? foldLoop(data, Math.round(s.loopS * sampleRate)) : trimTail(data, sampleRate)
    normalise(pcm)
    const buffer = new AudioBuffer({ length: pcm.length, numberOfChannels: 1, sampleRate })
    buffer.copyToChannel(pcm, 0)
    const list = bank.get(s.recipe.id)
    if (list) list.push(buffer)
    else bank.set(s.recipe.id, [buffer])
  })
  return bank
}

/** Faded shut at the end of its slot, so a long ring never bleeds into the next sound. */
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

export function trimTail(pcm: Float32Array<ArrayBuffer>, sampleRate: number): Float32Array<ArrayBuffer> {
  const floor = peakOf(pcm) * Math.pow(10, TRIM_DB / 20)
  let end = pcm.length
  while (end > 1 && Math.abs(pcm[end - 1]) <= floor) end--
  const out = pcm.subarray(0, end)
  const fade = Math.min(end, Math.round(FADE_S * sampleRate))
  for (let i = 0; i < fade; i++) out[end - 1 - i] *= i / fade
  return out
}

/** The tail past `n` samples rings on across the loop seam. */
export function foldLoop(pcm: Float32Array<ArrayBuffer>, n: number): Float32Array<ArrayBuffer> {
  const out = pcm.slice(0, n)
  for (let i = n; i < pcm.length; i++) out[i % n] += pcm[i]
  return out
}

export function normalise(pcm: Float32Array): void {
  const peak = peakOf(pcm)
  if (peak > 0) for (let i = 0; i < pcm.length; i++) pcm[i] /= peak
}
