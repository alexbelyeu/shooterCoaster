import type * as Tone from 'tone'
import { tone } from './tone'
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
  /** Context time the ramp starts. */
  at: number
  seconds: number
  /** 'in' only: context time of the track's first note. */
  firstNote?: number
}

/** A handed-over track fades anyway if no track opens within this long (a level that never starts its music). */
export const HANDOVER_TIMEOUT_S = 20

const live = new Set<MusicBus>()
/** Buses held at full until the next track opens, then faded from that track's start (#168). */
const handovers = new Map<MusicBus, { nodes: { dispose(): unknown }[]; timer: number }>()
/** For e2e: at ~1 fps a whole fade can happen between two polls. */
const fades: MusicFade[] = []

function logFade(fade: MusicFade) {
  fades.push(fade)
  if (fades.length > 8) fades.shift()
}

/** `firstNote`: context time the track's first note plays. `channel`: the score engine passes its stereo channel. */
export function openMusicBus(name: string, firstNote: number, channel: Tone.Channel = musicChannel): MusicBus {
  const { Gain } = tone()
  const gain = new Gain(0).connect(channel)
  for (const held of [...handovers.keys()]) releaseHandover(held)
  const at = tone().now()
  gain.gain.rampTo(1, MUSIC_FADE_S, at)
  const bus = { name, gain, fading: false }
  live.add(bus)
  logFade({ name, ramp: 'in', from: 0, at, seconds: MUSIC_FADE_S, firstNote })
  return bus
}

/**
 * Disposes `nodes` (loops before instruments) and the bus once the ramp is over.
 * `untilNextTrack`: keep playing until the next `openMusicBus` and fade under it, so a switch that waits on a scene
 * mount (title -> level) still overlaps.
 */
export function fadeOutMusicBus(bus: MusicBus, nodes: { dispose(): unknown }[], untilNextTrack = false): void {
  const held = handovers.get(bus)
  if (held) {
    handovers.delete(bus)
    window.clearTimeout(held.timer)
  }
  if (untilNextTrack) {
    const timer = window.setTimeout(() => releaseHandover(bus), HANDOVER_TIMEOUT_S * 1000)
    handovers.set(bus, { nodes, timer })
    return
  }
  bus.fading = true
  const at = tone().now()
  logFade({ name: bus.name, ramp: 'out', from: bus.gain.gain.getValueAtTime(at), at, seconds: MUSIC_FADE_S })
  try {
    bus.gain.gain.rampTo(0, MUSIC_FADE_S, at)
  } catch (e) {
    dropSound(`${bus.name} music fade`, e)
  }
  window.setTimeout(() => {
    for (const n of nodes) n.dispose()
    bus.gain.dispose()
    live.delete(bus)
  }, MUSIC_FADE_S * 1000 + 100)
}

function releaseHandover(bus: MusicBus) {
  const held = handovers.get(bus)
  if (held) fadeOutMusicBus(bus, held.nodes)
}

/** The next beat, not bar (up to 3.3 s), so the first note lands inside the outgoing fade (#168); the tempo steps to `bpm` on it. */
export function startTransportAt(bpm: number): { ticks: number; time: number } {
  const transport = tone().getTransport()
  if (transport.state !== 'started') {
    transport.bpm.value = bpm
    const time = tone().now()
    transport.start(time)
    return { ticks: 0, time }
  }
  const time = transport.nextSubdivision('4n')
  transport.bpm.cancelScheduledValues(time)
  transport.bpm.setValueAtTime(bpm, time)
  return { ticks: Math.round(transport.getTicksAtTime(time)), time }
}

export function musicState() {
  const now = tone().now()
  return {
    buses: [...live].map((b) => ({ name: b.name, gain: b.gain.gain.getValueAtTime(now), fading: b.fading })),
    fades: [...fades],
  }
}
