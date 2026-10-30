/** Score lint beyond the compiler's own errors: every note inside its instrument's useful range (MIDI, inclusive). */
import type { CompiledSong } from './score'

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
}

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
