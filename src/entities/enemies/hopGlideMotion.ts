/**
 * The spotted lanternfly's life on a wall (#516), in wall coordinates: `u` across, `v` up and `off` out from the face,
 * world units. It glides in and lands, then sits and crawls a little, hops off and glides in a short arc to another
 * spot, wings open on every hop and folded on landing; its hops loop, so it never runs out. Pure, on game time.
 */
import { createRng } from '@/utils/rng'

export const HOP = {
  /** Its belly off the face while it sits. */
  standoff: 1,
  /** Keeps its spots this far inside the wall's edges. */
  margin: 24,
  /** A hop's length (world units) and how far its glide bows out from the wall per unit of it. */
  distMin: 45,
  distSpan: 70,
  bow: 0.3,
  bowMin: 12,
  /** A hop takes `hopBase` + its length / `hopSpeed` seconds. */
  hopBase: 0.4,
  hopSpeed: 260,
  /** Seconds sat between hops; the first, after its arrival, is at least `sitMin`. */
  sitMin: 1.2,
  sitSpan: 1.6,
  /** How far it crawls while it sits, mostly up the wall. */
  crawl: 9,
  crawlSpread: 0.7,
  /** The arrival glide: from this far out and up, onto its first spot. */
  arrive: 0.9,
  arriveOut: 90,
  arriveUp: 50,
  /** Shares of a glide over which the wings open and fold. */
  open: 0.15,
  fold: 0.2,
  /** Hops before the route repeats (its last hop returns to its first spot). */
  hops: 16,
  /** Seconds to turn to a new heading. */
  turn: 0.3,
} as const

export interface HopRoute {
  /** Where it lands before each sit; the route loops back to the first. */
  u: number[]
  v: number[]
  /** Where each sit's crawl ends, the next hop's take-off. */
  cu: number[]
  cv: number[]
  sit: number[]
  hop: number[]
  /** Seconds of one loop of sits and hops, after the arrival. */
  loop: number
}

export type HopPhase = 'arrive' | 'sit' | 'hop'

export interface HopPose {
  u: number
  v: number
  off: number
  /** Radians in the wall's plane, 0 head up the wall, + turned towards -u (counter-clockwise seen from the front). */
  heading: number
  /** 0 folded (the spotted wedge) to 1 open (the red hindwings). */
  wings: number
  phase: HopPhase
}

export const newHopPose = (): HopPose => ({ u: 0, v: 0, off: HOP.standoff, heading: 0, wings: 0, phase: 'sit' })

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function hopRoute(start: { u: number; v: number }, wall: { width: number; height: number }, seed: number): HopRoute {
  const rng = createRng(seed)
  const mu = Math.min(HOP.margin, wall.width / 2)
  const mv = Math.min(HOP.margin, wall.height / 2)
  const cu = (u: number) => clamp(u, mu, wall.width - mu)
  const cvl = (v: number) => clamp(v, mv, wall.height - mv)
  const route: HopRoute = { u: [cu(start.u)], v: [cvl(start.v)], cu: [], cv: [], sit: [], hop: [], loop: 0 }
  for (let k = 0; k < HOP.hops; k++) {
    const crawl = (rng() * 2 - 1) * HOP.crawlSpread
    const fromU = cu(route.u[k] - Math.sin(crawl) * HOP.crawl)
    const fromV = cvl(route.v[k] + Math.cos(crawl) * HOP.crawl)
    route.cu.push(fromU)
    route.cv.push(fromV)
    route.sit.push((k === 0 ? HOP.sitMin : HOP.sitMin * 0.6) + rng() * HOP.sitSpan)
    let toU: number
    let toV: number
    if (k === HOP.hops - 1) {
      toU = route.u[0]
      toV = route.v[0]
    } else {
      // The longest of a few tries: a hop into a corner is cut short by the margins.
      let best = -1
      toU = fromU
      toV = fromV
      for (let i = 0; i < 4 && best < HOP.distMin; i++) {
        const angle = rng() * Math.PI * 2
        const dist = HOP.distMin + rng() * HOP.distSpan
        const u = cu(fromU + Math.cos(angle) * dist)
        const v = cvl(fromV + Math.sin(angle) * dist)
        const d = Math.hypot(u - fromU, v - fromV)
        if (d > best) {
          best = d
          toU = u
          toV = v
        }
      }
      route.u.push(toU)
      route.v.push(toV)
    }
    route.hop.push(HOP.hopBase + Math.hypot(toU - fromU, toV - fromV) / HOP.hopSpeed)
  }
  route.loop = route.sit.reduce((a, b) => a + b, 0) + route.hop.reduce((a, b) => a + b, 0)
  return route
}

const ease = (x: number) => x * x * (3 - 2 * x)

/** Wings over a glide's progress `p`: open fast at take-off, folded again on landing. */
export const glideWings = (p: number) => ease(clamp(p / HOP.open, 0, 1)) * ease(clamp((1 - p) / HOP.fold, 0, 1))

/** Heading of a move by (du, dv) across the wall. */
const headingOf = (du: number, dv: number) => Math.atan2(-du, dv)

function turnTo(from: number, to: number, x: number): number {
  let d = to - from
  d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2
  return from + d * ease(clamp(x, 0, 1))
}

/** Into `out`: no allocation per frame. `t` is game seconds since it mounted, so a paused clock holds it still. */
export function hopPose(route: HopRoute, t: number, out: HopPose): HopPose {
  const u0 = route.u[0]
  const v0 = route.v[0]
  if (t < HOP.arrive) {
    const p = Math.max(0, t) / HOP.arrive
    const e = ease(p)
    out.u = u0
    out.v = v0 + HOP.arriveUp * (1 - e)
    // Out of the air onto the wall: it closes in faster than it sinks, so it never meets the face before its spot.
    out.off = HOP.standoff + (HOP.arriveOut - HOP.standoff) * (1 - p) * (1 - p)
    out.heading = 0
    out.wings = glideWings(p)
    out.phase = 'arrive'
    return out
  }
  let tau = (t - HOP.arrive) % route.loop
  const n = route.sit.length
  for (let k = 0; k < n; k++) {
    const prevHop = k === 0 ? headingOf(route.u[0] - route.cu[n - 1], route.v[0] - route.cv[n - 1]) : headingOf(route.u[k] - route.cu[k - 1], route.v[k] - route.cv[k - 1])
    // Its first sit turns from the arrival's heading (straight up).
    const landed = k === 0 && t - HOP.arrive < route.loop ? 0 : prevHop
    const crawl = headingOf(route.cu[k] - route.u[k], route.cv[k] - route.v[k])
    if (tau < route.sit[k]) {
      const e = ease(tau / route.sit[k])
      out.u = route.u[k] + (route.cu[k] - route.u[k]) * e
      out.v = route.v[k] + (route.cv[k] - route.v[k]) * e
      out.off = HOP.standoff
      out.heading = turnTo(landed, crawl, tau / HOP.turn)
      out.wings = 0
      out.phase = 'sit'
      return out
    }
    tau -= route.sit[k]
    if (tau < route.hop[k] || k === n - 1) {
      const p = Math.min(1, tau / route.hop[k])
      const toU = k === n - 1 ? u0 : route.u[k + 1]
      const toV = k === n - 1 ? v0 : route.v[k + 1]
      const du = toU - route.cu[k]
      const dv = toV - route.cv[k]
      const e = ease(p)
      out.u = route.cu[k] + du * e
      out.v = route.cv[k] + dv * e
      out.off = HOP.standoff + Math.max(HOP.bowMin, HOP.bow * Math.hypot(du, dv)) * Math.sin(Math.PI * p)
      out.heading = turnTo(crawl, headingOf(du, dv), p / (2 * HOP.open))
      out.wings = glideWings(p)
      out.phase = 'hop'
      return out
    }
    tau -= route.hop[k]
  }
  return out
}
