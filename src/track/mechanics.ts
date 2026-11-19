import type { RideHold, RideMechanic, RideV2Spec, SpeedZone } from '@/types/level'
import { RIDE_V2_DEFAULTS } from './rideV2'

/** What the special ride mechanics (#699) ask of the v2 ride (zones and stops) and of the rails (where they are open). */

/** World units of brake run before a stop (a drop track's top, a turntable): it brakes as late as it can to the crawl. */
export const STOP_APPROACH = 80
/** World units the launch out of a turntable pushes over. */
export const TURNTABLE_LAUNCH = 90

/** The drop track's piece, the car's length of track that falls with it, in world units at an eye height. */
export function dropPieceLength(eyeHeight: number): number {
  return eyeHeight * 3
}

function checkMechanic(m: RideMechanic): void {
  if (!(m.from >= 0 && m.from < m.to && m.to < 1)) throw new Error(`${m.kind}: from and to must be shares of the lap with from < to`)
  if (m.kind === 'station' && m.from !== 0) throw new Error('station: the ride starts in it, so it must be at 0')
  if (m.kind === 'jumpGap' && !(m.boostFrom < m.from)) throw new Error('jumpGap: its booster must come before the lip')
  if ((m.kind === 'dropTrack' || m.kind === 'backwards') && !(m.from > 0 && m.seconds > 0)) {
    throw new Error(`${m.kind}: a stop inside the lap that lasts`)
  }
}

/** Brake to the crawl into `at`, hold `seconds`, then (with `speed`) launch out over `launch` units. */
function stopAt(at: number, seconds: number, length: number, crawl: number, speed?: number, launch = 0): { zones: SpeedZone[]; hold: RideHold } {
  const zones: SpeedZone[] = [{ kind: 'brake', from: Math.max(at - STOP_APPROACH / length, 0), to: at, speed: crawl, stop: true }]
  if (speed) zones.push({ kind: 'launch', from: at, to: at + launch / length, speed })
  return { zones, hold: { at, seconds } }
}

/** `spec` with its mechanics' zones and stops, ahead of its own zones (the first zone over a stretch drives it). */
export function withMechanics(spec: RideV2Spec, mechanics: readonly RideMechanic[] | undefined, length: number): RideV2Spec {
  if (!mechanics?.length) return spec
  const crawl = spec.crawl ?? RIDE_V2_DEFAULTS.crawl
  const gravity = spec.gravity ?? RIDE_V2_DEFAULTS.gravity
  const zones: SpeedZone[] = []
  const holds: RideHold[] = []
  const stop = (s: { zones: SpeedZone[]; hold: RideHold }) => {
    zones.push(...s.zones)
    holds.push(s.hold)
  }
  for (const m of mechanics) {
    checkMechanic(m)
    switch (m.kind) {
      case 'station':
        zones.push({ kind: 'launch', from: m.from, to: m.to, speed: m.speed })
        break
      case 'dropTrack':
        stop(stopAt(m.from, m.seconds, length, crawl))
        break
      case 'jumpGap': {
        // Twice gravity out-pushes the ramp's climb, so the car leaves the lip at the speed its arc was built for.
        const mid = (m.boostFrom + m.from) / 2
        zones.push({ kind: 'brake', from: m.boostFrom, to: mid, speed: m.speed })
        zones.push({ kind: 'launch', from: mid, to: m.from, speed: m.speed, accel: gravity * 2 })
        break
      }
      case 'backwards': {
        const launch = Math.max(Math.min(TURNTABLE_LAUNCH, ((m.to - m.from) * length - STOP_APPROACH) / 2), 0)
        stop(stopAt(m.from, m.seconds, length, crawl, m.speed, launch))
        stop(stopAt(m.to, m.seconds, length, crawl, m.speed, Math.min(TURNTABLE_LAUNCH, (1 - m.to) * length)))
        break
      }
    }
  }
  return { ...spec, zones: [...zones, ...(spec.zones ?? [])], holds: [...holds, ...(spec.holds ?? [])] }
}

/** Arc-distance spans with no rails, ties or towers: a jump's flight, a drop's shaft plus its piece at both ends. */
export function trackGaps(mechanics: readonly RideMechanic[] | undefined, length: number, pieceLength: number): [number, number][] {
  const gaps: [number, number][] = []
  for (const m of mechanics ?? []) {
    if (m.kind === 'jumpGap') gaps.push([m.from * length, m.to * length])
    else if (m.kind === 'dropTrack') gaps.push([m.from * length - pieceLength / 2, m.to * length + pieceLength / 2])
  }
  return gaps
}
