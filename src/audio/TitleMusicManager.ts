import type * as Tone from 'tone'
import { tone } from './tone'
import { nextTriggerTime } from './triggerTime'
import { dropSound, guarded } from './soundGuard'
import { sfxChannel, isAudioReady } from './AudioEngine'
import { MUSIC_FADE_S, fadeOutMusicBus, openMusicBus, startTransportAt, type MusicBus } from './musicBus'
import { MUSIC_ENGINE, withScrim } from './musicEngine'

/**
 * Whimsical carnival title-screen music.
 * Layered: music-box melody, warm pad, bouncy bass,
 * sparkle chimes, and soft tambourine.
 * Tempo: 108 BPM — relaxed merry-go-round feel.
 */

interface ToneTitleMusic {
  bus: MusicBus
  melodyBox: Tone.Synth
  padSynth: Tone.PolySynth
  bassSynth: Tone.Synth
  chimeSynth: Tone.Synth
  tamb: Tone.NoiseSynth
  loops: (Tone.Sequence | Tone.Loop)[]
}

/** The whoosh is an SFX that lives with the title; the music is Tone's, or null when the score engine plays it. */
interface TitleTrack {
  whooshFilter: Tone.Filter
  whoosh: Tone.NoiseSynth
  music: ToneTitleMusic | null
}

let track: TitleTrack | null = null

const TITLE_BPM = 108
/** Offline renders: melody, pad and bass all repeat every 4 bars (the sparkle chimes are random). */
export const TITLE_LOOP = { barS: (4 * 60) / TITLE_BPM, bars: 4 }

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

const chimeNotes = ['E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7']

function createWhoosh() {
  const { Filter, NoiseSynth } = tone()
  const whooshFilter = new Filter({ type: 'bandpass', frequency: 300, Q: 1.2 }).connect(sfxChannel)
  const whoosh = new NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.12, decay: 0.25, sustain: 0, release: 0.1 },
    volume: -14,
  }).connect(whooshFilter)
  return { whooshFilter, whoosh }
}

function createMusic(firstNote: number): ToneTitleMusic {
  const { NoiseSynth, PolySynth, Synth } = tone()
  const bus = openMusicBus('title', firstNote)

  // Music-box melody — sine with fast decay for bell-like tone
  const melodyBox = new Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.005,
      decay: 0.3,
      sustain: 0.1,
      release: 0.4,
    },
    volume: -12,
  }).connect(bus.gain)

  const padSynth = new PolySynth(Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.8,
      decay: 0.5,
      sustain: 0.6,
      release: 1.5,
    },
    volume: -18,
  }).connect(bus.gain)

  const bassSynth = new Synth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.01,
      decay: 0.15,
      sustain: 0.3,
      release: 0.2,
    },
    volume: -14,
  }).connect(bus.gain)

  const chimeSynth = new Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: 0.6,
      sustain: 0,
      release: 0.8,
    },
    volume: -20,
  }).connect(bus.gain)

  const tamb = new NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.001,
      decay: 0.06,
      sustain: 0,
    },
    volume: -24,
  }).connect(bus.gain)

  return { bus, melodyBox, padSynth, bassSynth, chimeSynth, tamb, loops: [] }
}

export function startTitleMusic(): void {
  if (track || !isAudioReady()) return
  const { Loop, Sequence } = tone()
  if (MUSIC_ENGINE === 'scrim') {
    track = { ...createWhoosh(), music: null }
    withScrim((p) => p.playScore('title'))
    return
  }
  const start = startTransportAt(TITLE_BPM)
  const t = createMusic(start.time)
  const { melodyBox, padSynth, bassSynth, chimeSynth, tamb } = t
  track = { ...createWhoosh(), music: t }
  const at = `${start.ticks}i`

  const melodyLoop = new Sequence(
    guarded('title melody', (time, note) => {
      if (!note) return
      melodyBox.triggerAttackRelease(note, '8n', nextTriggerTime(melodyBox, time, tone().getContext().currentTime))
    }),
    melodyNotes,
    '8n',
  )
  melodyLoop.loop = true
  melodyLoop.start(at)

  const padLoop = new Sequence(
    guarded('title pad', (time, chord) => {
      if (!chord) return
      padSynth.triggerAttackRelease(chord, '1n', nextTriggerTime(padSynth, time, tone().getContext().currentTime))
    }),
    padChords,
    '1n',
  )
  padLoop.loop = true
  padLoop.start(at)

  const bassLoop = new Sequence(
    guarded('title bass', (time, note) => {
      if (!note) return
      bassSynth.triggerAttackRelease(note, '8n', nextTriggerTime(bassSynth, time, tone().getContext().currentTime))
    }),
    bassNotes,
    '8n',
  )
  bassLoop.loop = true
  bassLoop.start(at)

  // Sparkle chimes — random note every 1.5 beats
  const chimeLoop = new Loop(guarded('title chime', (time) => {
    const note = chimeNotes[Math.floor(Math.random() * chimeNotes.length)]
    chimeSynth.triggerAttackRelease(note, '16n', nextTriggerTime(chimeSynth, time, tone().getContext().currentTime))
  }), '2n.')
  chimeLoop.start(`${start.ticks + tone().getTransport().PPQ}i`) // a beat in

  const tambLoop = new Sequence(
    guarded('title tambourine', (time, hit) => {
      if (!hit) return
      tamb.triggerAttackRelease('16n', nextTriggerTime(tamb, time, tone().getContext().currentTime))
    }),
    tambPattern,
    '8n',
  )
  tambLoop.loop = true
  tambLoop.start(at)

  t.loops.push(melodyLoop, padLoop, bassLoop, chimeLoop, tambLoop)
}

export function stopTitleMusic(): void {
  if (!track) return
  const { music, whoosh, whooshFilter } = track
  track = null
  if (!music) {
    withScrim((p) => p.stopScore('title'))
    window.setTimeout(() => {
      whoosh.dispose()
      whooshFilter.dispose()
    }, MUSIC_FADE_S * 1000)
    return
  }
  const { bus, loops, melodyBox, padSynth, bassSynth, chimeSynth, tamb } = music
  fadeOutMusicBus(bus, [...loops, melodyBox, padSynth, bassSynth, chimeSynth, tamb, whoosh, whooshFilter])
}

/** Built with the title music, so silent before audio unlocks. */
export function playTitleWhoosh(): void {
  if (!track) return
  const { whoosh, whooshFilter } = track
  try {
    const now = nextTriggerTime(whoosh, tone().now(), tone().getContext().currentTime)
    whooshFilter.frequency.cancelScheduledValues(now)
    whooshFilter.frequency.setValueAtTime(300, now)
    whooshFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.4)
    whoosh.triggerAttackRelease(0.3, now)
  } catch (e) {
    dropSound('title whoosh', e)
  }
}
