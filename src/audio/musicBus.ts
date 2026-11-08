import { audioContext, audioNow, rampParam, scoreChannel } from './AudioEngine'
import { dropSound } from './soundGuard'

/** Each score plays into its own gain stage, so a track change is a crossfade. */

export const MUSIC_FADE_S = 1

export interface MusicBus {
  name: string
  gain: GainNode
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

/** `firstNote`: context time the track's first note plays. */
export function openMusicBus(name: string, firstNote: number): MusicBus {
  const gain = new GainNode(audioContext(), { gain: 0 })
  gain.connect(scoreChannel)
  for (const held of [...handovers.keys()]) releaseHandover(held)
  const at = audioNow()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(1, at + MUSIC_FADE_S)
  const bus = { name, gain, fading: false }
  live.add(bus)
  logFade({ name, ramp: 'in', from: 0, at, seconds: MUSIC_FADE_S, firstNote })
  return bus
}

/**
 * Disposes `nodes` and the bus once the ramp is over.
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
  const at = audioNow()
  const level = bus.gain.gain
  const from = level.value
  logFade({ name: bus.name, ramp: 'out', from, at, seconds: MUSIC_FADE_S })
  try {
    rampParam(level, 0, MUSIC_FADE_S)
  } catch (e) {
    dropSound(`${bus.name} music fade`, e)
  }
  window.setTimeout(() => {
    for (const n of nodes) n.dispose()
    bus.gain.disconnect()
    live.delete(bus)
  }, MUSIC_FADE_S * 1000 + 100)
}

function releaseHandover(bus: MusicBus) {
  const held = handovers.get(bus)
  if (held) fadeOutMusicBus(bus, held.nodes)
}

export function musicState() {
  return {
    buses: [...live].map((b) => ({ name: b.name, gain: b.gain.gain.value, fading: b.fading })),
    fades: [...fades],
  }
}
