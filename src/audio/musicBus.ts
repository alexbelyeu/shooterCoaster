import * as Tone from 'tone'
import { musicChannel } from './AudioEngine'
import { dropSound } from './soundGuard'

/** Each music track plays into its own gain stage, so a track change is a crossfade. Never stop or cancel the Transport: it would cut the other track mid-fade. */

export const MUSIC_FADE_S = 1

export interface MusicBus {
  name: string
  gain: Tone.Gain
  fading: boolean
}

export interface MusicFade {
  name: string
  ramp: 'in' | 'out'
  from: number
  seconds: number
}

const live = new Set<MusicBus>()
/** For e2e: at ~1 fps a whole fade can happen between two polls. */
const fades: MusicFade[] = []

function logFade(fade: MusicFade) {
  fades.push(fade)
  if (fades.length > 8) fades.shift()
}

export function openMusicBus(name: string): MusicBus {
  const gain = new Tone.Gain(0).connect(musicChannel)
  gain.gain.rampTo(1, MUSIC_FADE_S)
  const bus = { name, gain, fading: false }
  live.add(bus)
  logFade({ name, ramp: 'in', from: 0, seconds: MUSIC_FADE_S })
  return bus
}

/** Disposes `nodes` (loops before instruments) and the bus once the ramp is over. */
export function fadeOutMusicBus(bus: MusicBus, nodes: { dispose(): unknown }[]): void {
  bus.fading = true
  logFade({ name: bus.name, ramp: 'out', from: bus.gain.gain.getValueAtTime(Tone.now()), seconds: MUSIC_FADE_S })
  try {
    bus.gain.gain.rampTo(0, MUSIC_FADE_S)
  } catch (e) {
    dropSound(`${bus.name} music fade`, e)
  }
  window.setTimeout(() => {
    for (const n of nodes) n.dispose()
    bus.gain.dispose()
    live.delete(bus)
  }, MUSIC_FADE_S * 1000 + 100)
}

/** Returns the next bar line in ticks, so a new track starts at the top of its phrase; the tempo ramps under a track still fading out. */
export function startTransportAt(bpm: number): number {
  const transport = Tone.getTransport()
  if (transport.state === 'started') transport.bpm.rampTo(bpm, MUSIC_FADE_S)
  else transport.bpm.value = bpm
  const bar = transport.PPQ * 4
  const startTicks = Math.ceil(transport.ticks / bar) * bar
  if (transport.state !== 'started') transport.start()
  return startTicks
}

export function musicState() {
  const now = Tone.now()
  return {
    buses: [...live].map((b) => ({ name: b.name, gain: b.gain.gain.getValueAtTime(now), fading: b.fading })),
    fades: [...fades],
  }
}
