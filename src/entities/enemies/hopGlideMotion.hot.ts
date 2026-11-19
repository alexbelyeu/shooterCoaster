/** The lanternfly's pose each frame on its `hopRoute` (`hopGlideMotion.ts`, built once at mount). */
import { HOP, type HopPose, type HopRoute } from './hopGlideMotion'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
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

/** Into `out`. `t` is game seconds since it mounted, so a paused clock holds it still. */
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
