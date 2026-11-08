/**
 * Score lint beyond the compiler's own errors: every note inside its instrument's useful range (MIDI, inclusive), and
 * the tune in a layered score's base layer.
 */
import type { CompiledSong, ScoreEvent } from './score'

const RANGES: Record<string, [number, number]> = {
  steeldrum: [55, 91], marimba: [45, 96], vibes: [53, 89], celesta: [60, 108], glock: [79, 108],
  xylophone: [65, 108], musicbox: [60, 100], bell: [55, 96],
  organ: [36, 96], pipe: [24, 96], harpsichord: [29, 89],
  strings: [28, 96], pizz: [28, 96], fiddle: [55, 100], harp: [24, 103], guitar: [40, 88], banjo: [48, 86], upright: [28, 60],
  flute: [60, 96], clarinet: [50, 91], oboe: [58, 91], bassoon: [34, 72], accordion: [41, 93],
  trumpet: [54, 86], brass: [40, 88], horn: [41, 77], tuba: [28, 58],
  choir: [45, 81], voices: [45, 81], pad: [36, 84],
  fretless: [28, 67], synbass: [28, 67], timpani: [33, 62],
  chip: [24, 108], sine: [24, 108], square: [24, 108], saw: [24, 108], triangle: [24, 108],
  // arcade palette (SCORE-FORMAT.md, "Instruments")
  fmbass: [28, 62], supersaw: [48, 96], distguitar: [40, 76], orchhit: [36, 84], synbrass: [40, 88],
  riser: [48, 96], downlifter: [48, 96],
}

/** Each melodic instrument's useful range (MIDI, inclusive). */
export const INSTRUMENT_RANGES: Readonly<Record<string, readonly [number, number]>> = RANGES

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteName = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`

/** One message per voice whose notes leave its range (lowest and highest offender). */
export function lintRanges(song: CompiledSong): string[] {
  const out: string[] = []
  song.voices.forEach((voice, vi) => {
    const range = RANGES[voice.inst]
    if (voice.drum || !range) return
    let lo = Infinity, hi = -Infinity
    for (const tl of [song.intro, song.loop]) for (const e of tl.events) if (e.v === vi && e.m) for (const m of e.m) {
      lo = Math.min(lo, m)
      hi = Math.max(hi, m)
    }
    if (lo < range[0] || hi > range[1]) {
      out.push(`"${voice.name}" (${voice.inst}) plays ${noteName(lo)}–${noteName(hi)}; its range is ${noteName(range[0])}–${noteName(range[1])}.`)
    }
  })
  return out
}

/** Pitch sweeps, not lines: whatever their pitch, they never carry a tune. */
const SWEEPS = new Set(['riser', 'downlifter'])

/** Whether every note `voice` plays starts with a note of the same pitch class in `base` (an octave doubling or unison). */
function doubles(voice: ScoreEvent[], base: ScoreEvent[]): boolean {
  const at = new Map<number, Set<number>>()
  for (const e of base) {
    const key = Math.round(e.t * 1e4)
    const pcs = at.get(key) ?? new Set<number>()
    for (const m of e.m!) pcs.add(m % 12)
    at.set(key, pcs)
  }
  return voice.every((e) => e.m!.every((m) => at.get(Math.round(e.t * 1e4))?.has(m % 12)))
}

/**
 * Layers only add (#415): a run opens on `base` alone, so the tune has to be in it. In a score with `layer=` tags, a
 * pitched voice in a higher layer either doubles one base voice (every note it plays starts with the same pitch class
 * in that voice: the xylophone two octaves over the organ) or stays under the base layer's top line (its loop's mean
 * top note no higher than the highest base voice's). One message per voice that breaks it.
 */
export function lintLayers(song: CompiledSong): string[] {
  if (!song.voices.some((v) => v.layer && v.layer !== 'base')) return []
  const lines = song.voices.map((voice, vi) =>
    voice.drum || SWEEPS.has(voice.inst) ? [] : song.loop.events.filter((e) => e.v === vi && e.m?.length),
  )
  const meanTop = (events: ScoreEvent[]) => events.reduce((sum, e) => sum + Math.max(...e.m!), 0) / events.length
  const isBase = (vi: number) => (song.voices[vi].layer ?? 'base') === 'base'
  const baseLines = lines.filter((events, vi) => isBase(vi) && events.length)
  const baseTop = Math.max(-Infinity, ...baseLines.map(meanTop))
  const out: string[] = []
  lines.forEach((events, vi) => {
    if (isBase(vi) || !events.length || meanTop(events) <= baseTop) return
    if (baseLines.some((base) => doubles(events, base))) return
    const { name, layer } = song.voices[vi]
    out.push(`"${name}" (layer=${layer}) plays above the base layer's top line without doubling a base voice: the tune belongs in base, layers only add.`)
  })
  return out
}
