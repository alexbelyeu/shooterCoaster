import { describe, expect, it } from 'vitest'
import { HOP, hopRoute, newHopPose, type HopPose } from './hopGlideMotion'
import { glideWings, hopPose } from './hopGlideMotion.hot'

const WALL = { width: 400, height: 240 }
const route = hopRoute({ u: 200, v: 80 }, WALL, 7)
const at = (t: number, r = route) => ({ ...hopPose(r, t, newHopPose()) })
const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

/** Every pose over the arrival and two loops, `dt` apart. */
function sweep(r = route, dt = 1 / 60): HopPose[] {
  const poses: HopPose[] = []
  for (let t = 0; t < HOP.arrive + 2 * r.loop; t += dt) poses.push(at(t, r))
  return poses
}

describe('hopRoute', () => {
  it('is the same for the same seed', () => {
    expect(hopRoute({ u: 200, v: 80 }, WALL, 7)).toEqual(route)
    expect(hopRoute({ u: 200, v: 80 }, WALL, 8)).not.toEqual(route)
  })

  it('keeps every spot inside the margins, and its hops of a real length', () => {
    for (const r of [route, hopRoute({ u: 0, v: 0 }, WALL, 3), hopRoute({ u: 400, v: 240 }, WALL, 4)]) {
      for (const u of [...r.u, ...r.cu]) expect(u >= HOP.margin && u <= WALL.width - HOP.margin).toBe(true)
      for (const v of [...r.v, ...r.cv]) expect(v >= HOP.margin && v <= WALL.height - HOP.margin).toBe(true)
      const lengths = r.cu.map((u, k) => Math.hypot((r.u[k + 1] ?? r.u[0]) - u, (r.v[k + 1] ?? r.v[0]) - r.cv[k]))
      expect(lengths.filter((d) => d >= HOP.distMin * 0.5).length).toBeGreaterThan(HOP.hops * 0.7)
    }
  })

  it('stays put on a wall narrower than its margins', () => {
    const r = hopRoute({ u: 5, v: 5 }, { width: 30, height: 20 }, 1)
    expect(new Set(r.u)).toEqual(new Set([15]))
    expect(new Set(r.v)).toEqual(new Set([10]))
  })
})

describe('hopPose', () => {
  it('arrives out of the air and lands folded on its first spot', () => {
    const first = at(0)
    expect(first.phase).toBe('arrive')
    expect(first.off).toBeCloseTo(HOP.arriveOut)
    expect(at(HOP.arrive * 0.4).wings).toBeGreaterThan(0.9)
    const landed = at(HOP.arrive)
    expect(landed).toMatchObject({ phase: 'sit', u: route.u[0], v: route.v[0], off: HOP.standoff, wings: 0 })
  })

  it('sits folded on the face, every hop opens its wings and lands on the wall', () => {
    let hops = 0
    let prev: HopPose | null = null
    for (const p of sweep()) {
      if (p.phase === 'sit') {
        expect(p.wings).toBe(0)
        expect(p.off).toBe(HOP.standoff)
      }
      if (prev?.phase === 'hop' && p.phase === 'sit') {
        hops++
        expect(prev.wings).toBeLessThan(0.2)
        expect(prev.off - HOP.standoff).toBeLessThan(2)
      }
      if (p.phase === 'hop' && p.wings > 0.99) expect(p.off).toBeGreaterThan(HOP.standoff)
      prev = p
    }
    expect(hops).toBeGreaterThanOrEqual(2 * HOP.hops - 1)
  })

  it('glides in front of the wall, never inside it or off its edges', () => {
    let minOff = Infinity
    let outside = 0
    for (const p of sweep()) {
      minOff = Math.min(minOff, p.off)
      if (p.u < 0 || p.u > WALL.width || p.v < 0 || p.v > WALL.height) outside++
    }
    expect(minOff).toBe(HOP.standoff)
    expect(outside).toBe(0)
  })

  it('moves and turns smoothly, the loop seam included', () => {
    let worstStep = 0
    let worstTurn = 0
    let prev: HopPose | null = null
    for (const p of sweep(route, 1 / 240)) {
      if (prev && prev.phase !== 'arrive') {
        worstStep = Math.max(worstStep, Math.hypot(p.u - prev.u, p.v - prev.v, p.off - prev.off))
        worstTurn = Math.max(worstTurn, angleGap(p.heading, prev.heading))
      }
      prev = p
    }
    expect(worstStep).toBeLessThan(3)
    expect(worstTurn).toBeLessThan(0.2)
  })

  it('heads the way it hops', () => {
    const k = 3
    let t = HOP.arrive
    for (let i = 0; i < k; i++) t += route.sit[i] + route.hop[i]
    const mid = at(t + route.sit[k] + route.hop[k] / 2)
    expect(mid.phase).toBe('hop')
    const du = route.u[k + 1] - route.cu[k]
    const dv = route.v[k + 1] - route.cv[k]
    expect(angleGap(mid.heading, Math.atan2(-du, dv))).toBeLessThan(1e-6)
  })

  it('is a function of game time alone: a paused clock holds it still', () => {
    for (const t of [0.3, 2.5, 9.1, 47]) expect(at(t)).toEqual(at(t))
  })
})

describe('glideWings', () => {
  it('is folded at take-off and landing, open mid-glide', () => {
    expect(glideWings(0)).toBe(0)
    expect(glideWings(1)).toBe(0)
    expect(glideWings(0.5)).toBe(1)
  })
})
