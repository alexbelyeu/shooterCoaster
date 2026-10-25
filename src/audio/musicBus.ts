import * as Tone from 'tone'
import { musicChannel } from './AudioEngine'
import { dropSound } from './soundGuard'

/**
 * Title and level music each play through their own bus (a gain stage into `musicChannel`), so a
 * track change is a crossfade: the new bus ramps in while the old one ramps out on the same
 * running Transport, then the old bus is disposed with everything that played into it.
 * Nothing here stops or cancels the Transport: that would cut the other track mid-fade.
 */

export const MUSIC_FADE_S = 1

export interface MusicBus {
  name: string
  gain: Tone.Gain
  fading: boolean
}

const live = new Set<MusicBus>()

export interface MusicFade {
  name: string
  ramp: 'in' | 'out'
  /** Gain when the ramp started. */
  from: number
  seconds: number
}

/** The last few ramps, for the e2e crossfade check (a fade can finish between two polls of a ~1 fps page). */
const fades: MusicFade[] = []

function logFade(fade: MusicFade) {
  fades.push(fade)
  if (fades.length > 8) fades.shift()
}

/** A new bus for `name`'s instruments, ramping in from silence. */
export function openMusicBus(name: string): MusicBus {
  const gain = new Tone.Gain(0).connect(musicChannel)
  gain.gain.rampTo(1, MUSIC_FADE_S)
  const bus = { name, gain, fading: false }
  live.add(bus)
  logFade({ name, ramp: 'in', from: 0, seconds: MUSIC_FADE_S })
  return bus
}

/** Ramps the bus out, then disposes `nodes` (loops first, then the instruments) and the bus. */
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

/**
 * Sets the tempo (ramped while another track is still fading out, so it doesn't lurch), starts the
 * Transport if it is stopped, and returns the next bar line in ticks for the new loops to start on.
 */
export function startTransportAt(bpm: number): number {
  const transport = Tone.getTransport()
  if (transport.state === 'started') transport.bpm.rampTo(bpm, MUSIC_FADE_S)
  else transport.bpm.value = bpm
  const bar = transport.PPQ * 4
  const startTicks = Math.ceil(transport.ticks / bar) * bar
  if (transport.state !== 'started') transport.start()
  return startTicks
}

/** e2e: every music bus still connected (gain now; mid-ramp reads between 0 and 1) and the recent ramps. */
export function musicState() {
  const now = Tone.now()
  return {
    buses: [...live].map((b) => ({ name: b.name, gain: b.gain.gain.getValueAtTime(now), fading: b.fading })),
    fades: [...fades],
  }
}
