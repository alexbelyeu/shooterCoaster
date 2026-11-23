import { describe, expect, it } from 'vitest'
import {
  PHOTO_MAX_PITCH, PHOTO_MIN_PITCH, PHOTO_START_PITCH, orbitPosition, photoFileName, photoLimits, startOrbit, stepOrbit,
  type PhotoOrbit,
} from './photoCamera'

const flat = () => 0
const limits = photoLimits(6, 5200)

describe('photoLimits', () => {
  it('scales the radius with the rider and keeps it well inside the fog', () => {
    expect(limits.minRadius).toBeCloseTo(4.8)
    expect(limits.maxRadius).toBe(180)
    expect(photoLimits(6, 400).maxRadius).toBe(100)
    expect(limits.clearance).toBe(3)
  })

  it('never inverts the range, even in thick fog', () => {
    const tight = photoLimits(6, 1)
    expect(tight.maxRadius).toBe(tight.minRadius)
  })
})

describe('startOrbit', () => {
  it('puts the camera behind the seat on the ride’s heading, a little above', () => {
    const o = startOrbit({ x: 1, y: 0, z: 0 }, limits, { yaw: 0, pitch: 0, radius: 0 })
    expect(Math.cos(o.yaw)).toBeCloseTo(-1)
    expect(o.pitch).toBe(PHOTO_START_PITCH)
    const p = orbitPosition({ x: 0, y: 10, z: 0 }, o, limits, flat, undefined, { x: 0, y: 0, z: 0 })
    expect(p.x).toBeLessThan(0)
    expect(p.y).toBeGreaterThan(10)
    expect(p.z).toBeCloseTo(0)
  })

  it('takes any heading when the ride looks straight up (a loop)', () => {
    const o = startOrbit({ x: 0, y: 1, z: 0 }, limits, { yaw: 9, pitch: 0, radius: 0 })
    expect(o.yaw).toBe(0)
    expect(o.radius).toBeGreaterThanOrEqual(limits.minRadius)
  })
})

describe('stepOrbit', () => {
  it('clamps pitch and radius and wraps yaw', () => {
    const o: PhotoOrbit = { yaw: 3, pitch: 0, radius: 20 }
    stepOrbit(o, 1, 10, 1000, limits)
    expect(o.pitch).toBe(PHOTO_MAX_PITCH)
    expect(o.radius).toBe(limits.maxRadius)
    expect(o.yaw).toBeCloseTo(4 - 2 * Math.PI)
    stepOrbit(o, 0, -10, 1e-6, limits)
    expect(o.pitch).toBe(PHOTO_MIN_PITCH)
    expect(o.radius).toBe(limits.minRadius)
  })

  it('ignores a broken zoom factor', () => {
    const o: PhotoOrbit = { yaw: 0, pitch: 0, radius: 20 }
    for (const z of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) stepOrbit(o, 0, 0, z, limits)
    expect(o.radius).toBe(20)
  })
})

describe('orbitPosition', () => {
  it('sits at the radius from the pivot on open ground', () => {
    const pivot = { x: 5, y: 50, z: -3 }
    const o: PhotoOrbit = { yaw: 0.7, pitch: 0.4, radius: 30 }
    const p = orbitPosition(pivot, o, limits, flat, undefined, { x: 0, y: 0, z: 0 })
    expect(Math.hypot(p.x - pivot.x, p.y - pivot.y, p.z - pivot.z)).toBeCloseTo(30)
  })

  it('never goes under the terrain, at any pitch or yaw', () => {
    const hill = (x: number, z: number) => 20 + 10 * Math.sin(x * 0.1) * Math.cos(z * 0.1)
    const pivot = { x: 0, y: 22, z: 0 }
    const p = { x: 0, y: 0, z: 0 }
    let worst = Infinity
    for (let yaw = -Math.PI; yaw < Math.PI; yaw += 0.2) {
      for (let pitch = PHOTO_MIN_PITCH; pitch <= PHOTO_MAX_PITCH; pitch += 0.1) {
        orbitPosition(pivot, { yaw, pitch, radius: limits.maxRadius }, limits, hill, undefined, p)
        worst = Math.min(worst, p.y - hill(p.x, p.z))
      }
    }
    expect(worst).toBeGreaterThanOrEqual(limits.clearance - 1e-9)
  })

  it('stays inside an interior’s walls', () => {
    const bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40, maxY: 30 }
    const p = orbitPosition({ x: 0, y: 10, z: 0 }, { yaw: 0, pitch: 1.2, radius: 150 }, limits, flat, bounds, { x: 0, y: 0, z: 0 })
    expect(p.x).toBeLessThanOrEqual(40)
    expect(p.y).toBeLessThanOrEqual(30)
  })
})

describe('photoFileName', () => {
  it('names the level and the local time', () => {
    expect(photoFileName('level3', new Date(2026, 10, 21, 9, 5, 7))).toBe('scoaster-level3-20261121-090507.png')
  })
})
