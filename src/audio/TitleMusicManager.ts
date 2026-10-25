import * as Tone from 'tone'
import { nextTriggerTime } from './triggerTime'
import { dropSound } from './soundGuard'
import { sfxChannel, isAudioReady } from './AudioEngine'
import { fadeOutMusicBus, openMusicBus, startTransportAt, type MusicBus } from './musicBus'

/**
 * Whimsical carnival title-screen music.
 * Layered: music-box melody, warm pad, bouncy bass,
 * sparkle chimes, and soft tambourine.
 * Tempo: 108 BPM — relaxed merry-go-round feel.
 */

interface TitleTrack {
  bus: MusicBus
  melodyBox: Tone.Synth
  padSynth: Tone.PolySynth
  bassSynth: Tone.Synth
  chimeSynth: Tone.Synth
  tamb: Tone.NoiseSynth
  whooshFilter: Tone.Filter
  whoosh: Tone.NoiseSynth
  loops: (Tone.Sequence | Tone.Loop)[]
}

let track: TitleTrack | null = null

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

function createTrack(): TitleTrack {
  const bus = openMusicBus('title')

  // Music-box melody — sine with fast decay for bell-like tone
  const melodyBox = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.005,
      decay: 0.3,
      sustain: 0.1,
      release: 0.4,
    },
    volume: -12,
  }).connect(bus.gain)

  // Warm sustained pad
  const padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.8,
      decay: 0.5,
      sustain: 0.6,
      release: 1.5,
    },
    volume: -18,
  }).connect(bus.gain)

  // Bouncy triangle bass
  const bassSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.01,
      decay: 0.15,
      sustain: 0.3,
      release: 0.2,
    },
    volume: -14,
  }).connect(bus.gain)

  // Sparkle chimes — high sine pings
  const chimeSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: 0.6,
      sustain: 0,
      release: 0.8,
    },
    volume: -20,
  }).connect(bus.gain)

  // Soft tambourine — filtered noise
  const tamb = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.001,
      decay: 0.06,
      sustain: 0,
    },
    volume: -24,
  }).connect(bus.gain)

  // PLAY whoosh: band-passed noise swept upward, on the SFX bus
  const whooshFilter = new Tone.Filter({ type: 'bandpass', frequency: 300, Q: 1.2 }).connect(sfxChannel)
  const whoosh = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.12, decay: 0.25, sustain: 0, release: 0.1 },
    volume: -14,
  }).connect(whooshFilter)

  return { bus, melodyBox, padSynth, bassSynth, chimeSynth, tamb, whooshFilter, whoosh, loops: [] }
}

export function startTitleMusic(): void {
  if (track || !isAudioReady()) return
  const t = createTrack()
  const { melodyBox, padSynth, bassSynth, chimeSynth, tamb } = t
  track = t
  const bar = startTransportAt(108)
  const at = `${bar}i`

  // Melody — 8th notes across 4 bars
  const melodyLoop = new Tone.Sequence(
    (time, note) => {
      if (!note) return
      try {
        melodyBox.triggerAttackRelease(note, '8n', nextTriggerTime(melodyBox, time, Tone.getContext().currentTime))
      } catch (e) {
        dropSound('title melody', e)
      }
    },
    melodyNotes,
    '8n',
  )
  melodyLoop.loop = true
  melodyLoop.start(at)

  // Pad — one chord per bar (whole note)
  const padLoop = new Tone.Sequence(
    (time, chord) => {
      if (!chord) return
      try {
        padSynth.triggerAttackRelease(chord, '1n', nextTriggerTime(padSynth, time, Tone.getContext().currentTime))
      } catch (e) {
        dropSound('title pad', e)
      }
    },
    padChords,
    '1n',
  )
  padLoop.loop = true
  padLoop.start(at)

  // Bass — 8th notes across 4 bars
  const bassLoop = new Tone.Sequence(
    (time, note) => {
      if (!note) return
      try {
        bassSynth.triggerAttackRelease(note, '8n', nextTriggerTime(bassSynth, time, Tone.getContext().currentTime))
      } catch (e) {
        dropSound('title bass', e)
      }
    },
    bassNotes,
    '8n',
  )
  bassLoop.loop = true
  bassLoop.start(at)

  // Sparkle chimes — random note every 1.5 beats
  const chimeLoop = new Tone.Loop((time) => {
    const note = chimeNotes[Math.floor(Math.random() * chimeNotes.length)]
    try {
      chimeSynth.triggerAttackRelease(note, '16n', nextTriggerTime(chimeSynth, time, Tone.getContext().currentTime))
    } catch (e) {
      dropSound('title chime', e)
    }
  }, '2n.')
  chimeLoop.start(`${bar + Tone.getTransport().PPQ}i`) // a beat after the downbeat

  // Tambourine — offbeat 16th notes
  const tambLoop = new Tone.Sequence(
    (time, hit) => {
      if (!hit) return
      try {
        tamb.triggerAttackRelease('16n', nextTriggerTime(tamb, time, Tone.getContext().currentTime))
      } catch (e) {
        dropSound('title tambourine', e)
      }
    },
    tambPattern,
    '8n',
  )
  tambLoop.loop = true
  tambLoop.start(at)

  t.loops.push(melodyLoop, padLoop, bassLoop, chimeLoop, tambLoop)
}

/** Fades the title music out over MUSIC_FADE_S (the level music fades in over it). */
export function stopTitleMusic(): void {
  if (!track) return
  const { bus, loops, melodyBox, padSynth, bassSynth, chimeSynth, tamb, whoosh, whooshFilter } = track
  track = null
  fadeOutMusicBus(bus, [...loops, melodyBox, padSynth, bassSynth, chimeSynth, tamb, whoosh, whooshFilter])
}

/** PLAY's whoosh into the fade-to-black. Built with the title music, so silent before audio unlocks. */
export function playTitleWhoosh(): void {
  if (!track) return
  const { whoosh, whooshFilter } = track
  try {
    const now = nextTriggerTime(whoosh, Tone.now(), Tone.getContext().currentTime)
    whooshFilter.frequency.cancelScheduledValues(now)
    whooshFilter.frequency.setValueAtTime(300, now)
    whooshFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.4)
    whoosh.triggerAttackRelease(0.3, now)
  } catch (e) {
    dropSound('title whoosh', e)
  }
}
