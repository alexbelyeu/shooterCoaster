import * as Tone from 'tone'
import { musicChannel, isAudioReady } from './AudioEngine'

/**
 * Whimsical carnival title-screen music.
 * Layered: music-box melody, warm pad, bouncy bass,
 * sparkle chimes, and soft tambourine.
 * Tempo: 108 BPM — relaxed merry-go-round feel.
 */

let isPlaying = false

// Synths
let melodyBox: Tone.Synth | null = null
let padSynth: Tone.PolySynth | null = null
let bassSynth: Tone.Synth | null = null
let chimeSynth: Tone.Synth | null = null
let tamb: Tone.NoiseSynth | null = null

// Loops
let melodyLoop: Tone.Sequence | null = null
let padLoop: Tone.Sequence | null = null
let bassLoop: Tone.Sequence | null = null
let chimeLoop: Tone.Loop | null = null
let tambLoop: Tone.Sequence | null = null

// — Melody: music-box calliope feel, 2-bar phrase ————————————
const melodyNotes = [
  // Bar 1 — ascending, bouncy
  'C5', 'E5', 'G5', 'E5', 'C5', 'D5', 'E5', null,
  // Bar 2 — descending resolution
  'F5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', null,
  // Bar 3 — build up
  'G4', 'B4', 'D5', 'G5', 'F5', 'E5', 'D5', null,
  // Bar 4 — triumphant finish
  'C5', 'E5', 'G5', 'C6', 'G5', 'E5', 'C5', null,
]

// — Pad: warm major chords, one per bar ————————————
const padChords: (string[] | null)[] = [
  ['C3', 'E3', 'G3', 'B3'],   // Cmaj7
  ['F3', 'A3', 'C4', 'E4'],   // Fmaj7
  ['G3', 'B3', 'D4', 'F4'],   // G7
  ['A3', 'C4', 'E4', 'G4'],   // Am7
]

// — Bass: bouncy root notes, 8th-note pattern per bar ————————
const bassNotes = [
  'C2', 'C2', 'G2', 'C2', 'C2', 'G2', 'E2', 'G2',
  'F2', 'F2', 'C3', 'F2', 'F2', 'C3', 'A2', 'C3',
  'G2', 'G2', 'D3', 'G2', 'G2', 'D3', 'B2', 'D3',
  'A2', 'A2', 'E3', 'A2', 'A2', 'E3', 'C3', 'E3',
]

// — Tambourine pattern (hit / rest) ————————————
const tambPattern = [
  null, 1, null, 1, null, 1, null, 1,
  null, 1, null, 1, null, 1, null, 1,
]

// Sparkle chime notes to pick from
const chimeNotes = ['E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7']

function ensureInstruments() {
  if (melodyBox) return

  // Music-box melody — sine with fast decay for bell-like tone
  melodyBox = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.005,
      decay: 0.3,
      sustain: 0.1,
      release: 0.4,
    },
    volume: -12,
  }).connect(musicChannel)

  // Warm sustained pad
  padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.8,
      decay: 0.5,
      sustain: 0.6,
      release: 1.5,
    },
    volume: -18,
  }).connect(musicChannel)

  // Bouncy triangle bass
  bassSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.01,
      decay: 0.15,
      sustain: 0.3,
      release: 0.2,
    },
    volume: -14,
  }).connect(musicChannel)

  // Sparkle chimes — high sine pings
  chimeSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: 0.6,
      sustain: 0,
      release: 0.8,
    },
    volume: -20,
  }).connect(musicChannel)

  // Soft tambourine — filtered noise
  tamb = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.001,
      decay: 0.06,
      sustain: 0,
    },
    volume: -24,
  }).connect(musicChannel)
}

export function startTitleMusic(): void {
  if (isPlaying || !isAudioReady()) return
  ensureInstruments()

  const transport = Tone.getTransport()
  transport.bpm.value = 108

  // Melody — 8th notes across 4 bars
  melodyLoop = new Tone.Sequence(
    (time, note) => {
      if (note && melodyBox) melodyBox.triggerAttackRelease(note, '8n', time)
    },
    melodyNotes,
    '8n',
  )
  melodyLoop.loop = true
  melodyLoop.start(0)

  // Pad — one chord per bar (whole note)
  padLoop = new Tone.Sequence(
    (time, chord) => {
      if (chord && padSynth) padSynth.triggerAttackRelease(chord, '1n', time)
    },
    padChords,
    '1n',
  )
  padLoop.loop = true
  padLoop.start(0)

  // Bass — 8th notes across 4 bars
  bassLoop = new Tone.Sequence(
    (time, note) => {
      if (note && bassSynth) bassSynth.triggerAttackRelease(note, '8n', time)
    },
    bassNotes,
    '8n',
  )
  bassLoop.loop = true
  bassLoop.start(0)

  // Sparkle chimes — random note every 1.5 beats
  chimeLoop = new Tone.Loop((time) => {
    if (!chimeSynth) return
    const note = chimeNotes[Math.floor(Math.random() * chimeNotes.length)]
    chimeSynth.triggerAttackRelease(note, '16n', time)
  }, '2n.')
  chimeLoop.start('4n') // offset slightly from downbeat

  // Tambourine — offbeat 16th notes
  tambLoop = new Tone.Sequence(
    (time, hit) => {
      if (hit && tamb) tamb.triggerAttackRelease('16n', time)
    },
    tambPattern,
    '8n',
  )
  tambLoop.loop = true
  tambLoop.start(0)

  transport.start()
  isPlaying = true
}

export function stopTitleMusic(): void {
  if (!isPlaying) return

  // Dispose loops so they don't conflict with game music on the shared transport
  melodyLoop?.dispose(); melodyLoop = null
  padLoop?.dispose(); padLoop = null
  bassLoop?.dispose(); bassLoop = null
  chimeLoop?.dispose(); chimeLoop = null
  tambLoop?.dispose(); tambLoop = null

  // Dispose synths so they can be re-created fresh next time
  melodyBox?.dispose(); melodyBox = null
  padSynth?.dispose(); padSynth = null
  bassSynth?.dispose(); bassSynth = null
  chimeSynth?.dispose(); chimeSynth = null
  tamb?.dispose(); tamb = null

  const transport = Tone.getTransport()
  transport.stop()
  transport.cancel()
  isPlaying = false
}

export function isTitleMusicPlaying(): boolean {
  return isPlaying
}
