import type * as Tone from 'tone'
import { tone } from './tone'
import { nextTriggerTime } from './triggerTime'
import { guarded } from './soundGuard'
import { isAudioReady } from './AudioEngine'
import { fadeOutMusicBus, openMusicBus, startTransportAt, type MusicBus } from './musicBus'
import type { BiomeType } from '@/types/level'

/**
 * Per-biome adaptive background music.
 * Each biome gets its own tempo, chord progression, bass line,
 * and melodic accents — all using soft sine/triangle timbres
 * so the music sits behind gameplay without being jarring.
 *
 * Intensity system (driven by combo/time pressure):
 *   - Pad always plays
 *   - Bass enters at intensity > 0.2
 *   - Lead accents enter at intensity > 0.5
 *   - Perc (theme park only) enters at intensity > 0.3
 */

// ── Biome configs ──────────────────────────────────────────────

interface BiomeConfig {
  tempo: number
  padChords: (string[] | null)[]
  bassNotes: (string | null)[]
  leadNotes: (string | null)[]
  hasPerc: boolean
}

const CONFIGS: Record<BiomeType, BiomeConfig> = {
  // Carnival waltz — bright, bouncy, major key
  themePark: {
    tempo: 108,
    padChords: [
      ['C3', 'E3', 'G3', 'B3'],
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
      ['A3', 'C4', 'E4'],
    ],
    bassNotes: [
      'C2', null, 'G2', null, 'C2', null, 'E2', null,
      'F2', null, 'C3', null, 'F2', null, 'A2', null,
    ],
    leadNotes: [
      'C5', null, 'E5', null, 'G5', null, null, null,
      'F5', null, 'E5', null, 'D5', null, 'C5', null,
    ],
    hasPerc: true,
  },

  // Sparse, mysterious — minor key, long rests
  desert: {
    tempo: 82,
    padChords: [
      ['A2', 'E3', 'A3'], null,
      ['D3', 'F3', 'A3'], null,
      ['E3', 'G3', 'B3'], null,
      ['A2', 'E3', 'A3'], null,
    ],
    bassNotes: [
      'A1', null, null, null, null, null, 'E2', null,
      'D2', null, null, null, null, null, 'A1', null,
    ],
    leadNotes: [
      null, null, 'A4', null, null, null, null, null,
      null, null, null, null, 'C5', null, null, null,
    ],
    hasPerc: false,
  },

  // Flowing, watery — rich major 7ths, gentle arpeggiation
  ocean: {
    tempo: 90,
    padChords: [
      ['Eb3', 'G3', 'Bb3', 'D4'],
      ['C3', 'Eb3', 'G3', 'Bb3'],
      ['Ab3', 'C4', 'Eb4'],
      ['Bb3', 'D4', 'F4'],
    ],
    bassNotes: [
      'Eb2', null, null, 'Bb2', null, null, null, null,
      'Ab2', null, null, 'Eb2', null, null, null, null,
    ],
    leadNotes: [
      'Eb4', null, 'G4', null, 'Bb4', null, null, null,
      null, null, 'G4', null, 'Eb4', null, null, null,
    ],
    hasPerc: false,
  },

  // Crystalline, minimal — open sus voicings, very sparse
  arctic: {
    tempo: 72,
    padChords: [
      ['D3', 'A3', 'E4'], null,
      ['A2', 'E3', 'B3'], null,
      ['E3', 'B3', 'F#4'], null,
      ['G3', 'D4', 'A4'], null,
    ],
    bassNotes: [
      'D2', null, null, null, null, null, null, null,
      'A1', null, null, null, null, null, null, null,
    ],
    leadNotes: [
      null, null, null, null, 'F#5', null, null, null,
      null, null, null, null, null, null, 'A5', null,
    ],
    hasPerc: false,
  },

  // Dark, driving — D minor, relentless urgency
  volcanic: {
    tempo: 140,
    padChords: [
      ['D3', 'F3', 'A3'],
      ['G3', 'Bb3', 'D4'],
      ['A3', 'C4', 'E4'],
      ['Bb3', 'D4', 'F4'],
    ],
    bassNotes: [
      'D2', null, 'D2', null, 'A1', null, 'D2', null,
      'G2', null, 'G2', null, 'D2', null, 'A1', null,
    ],
    leadNotes: [
      null, null, 'D5', null, null, null, null, null,
      null, null, null, null, 'F5', null, null, null,
    ],
    hasPerc: false,
  },
}

// ── State ──────────────────────────────────────────────────────

let padSynth: Tone.PolySynth | null = null
let bassSynth: Tone.Synth | null = null
let percSynth: Tone.NoiseSynth | null = null
let leadSynth: Tone.Synth | null = null

let padLoop: Tone.Sequence | null = null
let bassLoop: Tone.Sequence | null = null
let percLoop: Tone.Sequence | null = null
let leadLoop: Tone.Sequence | null = null

let bus: MusicBus | null = null
let currentIntensity = 0
let isPlaying = false

function fadeOutMusicState() {
  const nodes = [padLoop, bassLoop, percLoop, leadLoop, padSynth, bassSynth, percSynth, leadSynth]
  if (bus) fadeOutMusicBus(bus, nodes.filter((n) => n !== null))
  bus = null
  padLoop = bassLoop = percLoop = leadLoop = null
  padSynth = bassSynth = percSynth = leadSynth = null
  isPlaying = false
  currentIntensity = 0
}

// ── Instrument setup ───────────────────────────────────────────

function createInstruments(out: Tone.Gain) {
  const { NoiseSynth, PolySynth, Synth } = tone()
  const pad = new PolySynth(Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 1.0, decay: 0.5, sustain: 0.6, release: 2.0 },
    volume: -24,
  }).connect(out)

  const bass = new Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.25, release: 0.3 },
    volume: -22,
  }).connect(out)

  const perc = new NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    volume: -30,
  }).connect(out)

  const lead = new Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.4 },
    volume: -26,
  }).connect(out)

  return { pad, bass, perc, lead }
}

// ── Public API ─────────────────────────────────────────────────

export function startMusic(biome: BiomeType = 'themePark'): void {
  if (!isAudioReady() || isPlaying) return
  const { Sequence } = tone()

  const cfg = CONFIGS[biome]
  const start = startTransportAt(cfg.tempo)
  bus = openMusicBus('level', start.time)
  // The loops play these locals, not the module slots: a track fading out keeps its synths after a stop clears them.
  const { pad, bass, perc, lead } = createInstruments(bus.gain)
  padSynth = pad
  bassSynth = bass
  percSynth = perc
  leadSynth = lead
  const at = `${start.ticks}i`

  padLoop = new Sequence(
    guarded('music pad', (time, chord) => {
      if (!chord) return
      pad.triggerAttackRelease(chord, '1n', nextTriggerTime(pad, time, tone().getContext().currentTime), 0.3)
    }),
    cfg.padChords,
    '1n',
  )
  padLoop.loop = true
  padLoop.start(at)

  bassLoop = new Sequence(
    guarded('music bass', (time, note) => {
      if (currentIntensity < 0.2) return
      if (!note) return
      bass.triggerAttackRelease(note, '8n', nextTriggerTime(bass, time, tone().getContext().currentTime))
    }),
    cfg.bassNotes,
    '8n',
  )
  bassLoop.loop = true
  bassLoop.start(at)

  leadLoop = new Sequence(
    guarded('music lead', (time, note) => {
      if (currentIntensity < 0.5) return
      if (!note) return
      lead.triggerAttackRelease(note, '8n', nextTriggerTime(lead, time, tone().getContext().currentTime), 0.5)
    }),
    cfg.leadNotes,
    '8n',
  )
  leadLoop.loop = true
  leadLoop.start(at)

  if (cfg.hasPerc) {
    const percPattern = cfg.bassNotes.map((_, i) => (i % 2 === 1 ? 1 : null))
    percLoop = new Sequence(
      guarded('music perc', (time, hit) => {
        if (currentIntensity < 0.3) return
        if (!hit) return
        perc.triggerAttackRelease('32n', nextTriggerTime(perc, time, tone().getContext().currentTime))
      }),
      percPattern,
      '8n',
    )
    percLoop.loop = true
    percLoop.start(at)
  }

  isPlaying = true
}

export function stopMusic(): void {
  if (!isPlaying) return
  fadeOutMusicState()
}

export function setMusicIntensity(intensity: number): void {
  currentIntensity = Math.max(0, Math.min(1, intensity))

  if (padSynth) padSynth.volume.value = -24 + currentIntensity * 2
}

/** Offline renders: bar length and bars per loop (the pad plays one chord per bar; the 8th-note parts divide it). */
export function musicLoop(biome: BiomeType): { barS: number; bars: number } {
  const cfg = CONFIGS[biome]
  return { barS: (4 * 60) / cfg.tempo, bars: cfg.padChords.length }
}

/** The loop's first pad chord: its root is the biome's key, which the wave stinger resolves to (`sfxDesign.test.ts`). */
export function openingChord(biome: BiomeType): readonly string[] {
  return CONFIGS[biome].padChords[0] ?? []
}

