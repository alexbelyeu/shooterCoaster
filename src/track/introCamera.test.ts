import { describe, expect, it } from 'vitest'
import { INTRO_SECONDS } from '@/core/introShot'
import { ORBIT_RATE, introProgress, orbitPose, tourPose, type HeroShot } from './introCamera.hot'
import { TOUR_SPEED_CAP, buildIntroTour, tourDistance, tourTurnRates } from './introTour'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrackCurve } from './curves/createTrackCurve'
import { getTrackDimensions } from './trackDimensions'
import { buildArcTable } from './arcLength'
import { BIOMES, biomeHeightFunction } from '@/levels/environments/biomeRegistry'
import { sampleTrackPath } from '@/utils/terrainNoise'
import { HALL_BOUNDS } from '@/levels/environments/biomes/gym/config'

const v = (x = 0, y = 0, z = 0) => ({ x, y, z })
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const angleDeg = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  const d = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z))
  return (Math.acos(Math.min(Math.max(d, -1), 1)) * 180) / Math.PI
}

/** Ground samples each level's tour build took (the build's dominant cost: terrain noise per path sample). */
const GROUND_SAMPLES: Record<string, number> = {}

/** Each level's tour as `CoasterCamera` builds it (the real ground), with its seat (track start + eye height) and ride direction. */
function levelTours() {
  return getAllLevels().map((level) => {
    const curve = createTrackCurve(level.track)
    const table = buildArcTable(curve)
    const dims = getTrackDimensions(level.track)
    const biome = BIOMES[level.biome]
    const ground = biomeHeightFunction(level.biome, sampleTrackPath((t) => curve.getPointAt(t)))
    const hero = biome.hero
    const heroGround = hero.ground ?? ground(hero.x, hero.z)
    let samples = 0
    const counted = (x: number, z: number) => {
      samples++
      return ground(x, z)
    }
    const tour = buildIntroTour({
      curve, table, seatT: 0, eyeHeight: dims.eyeHeight, trackScale: dims.trackScale, hero, heroGround, ground: counted, bounds: biome.bounds,
    })
    GROUND_SAMPLES[level.id] = samples
    const p = curve.getPointAt(0)
    const t = curve.getTangentAt(0)
    const anchor = v(hero.x, heroGround + hero.focus, hero.z)
    return { id: level.id, tour, ground, anchor, seat: v(p.x, p.y + dims.eyeHeight, p.z), dir: v(t.x, t.y, t.z), scale: dims.trackScale, bounds: biome.bounds }
  })
}

const TOURS = levelTours()
/** Frames a second the tests sample the intro at. */
const FPS = 60

describe('tourPose', () => {
  it('lands exactly on the seat pose at progress 1, on every level', () => {
    for (const s of TOURS) {
      const pos = v()
      const dir = v()
      const bank = tourPose(s.tour, 1, s.seat, s.dir, pos, dir)
      expect({ id: s.id, pos, dir, bank }).toEqual({ id: s.id, pos: s.seat, dir: s.dir, bank: 0 })
    }
  })

  it('tours each level at a steady pace under the speed cap, turning smoothly, and settles into the seat', () => {
    const frames = INTRO_SECONDS * FPS
    const rows = TOURS.map((s) => {
      const pos = v()
      const dir = v()
      tourPose(s.tour, 0, s.seat, s.dir, pos, dir)
      const prev = { ...pos }
      const prevDir = { ...dir }
      let topSpeed = 0
      let topTurn = 0
      for (let i = 1; i <= frames; i++) {
        tourPose(s.tour, introProgress(i / FPS), s.seat, s.dir, pos, dir)
        topSpeed = Math.max(topSpeed, dist(pos, prev) * FPS)
        topTurn = Math.max(topTurn, angleDeg(dir, prevDir) * FPS)
        Object.assign(prev, pos)
        Object.assign(prevDir, dir)
      }
      const turns = tourTurnRates(s.tour)
      tourPose(s.tour, introProgress(INTRO_SECONDS - 1 / FPS), s.seat, s.dir, pos, dir)
      return {
        id: s.id,
        underCap: topSpeed <= TOUR_SPEED_CAP * s.scale,
        // A tour of a few hundred units would be no tour: it covers the level.
        covers: s.tour.length >= 1500 * s.scale || s.bounds !== undefined,
        // The view turns at most this many degrees a second (the gym's hall is tighter, its tour hand-picked, #695).
        smoothTurn: topTurn < (s.bounds ? 120 : 75) && turns.look < (s.bounds ? 120 : 75),
        settles: dist(pos, s.seat) < 0.1 * s.scale && angleDeg(dir, s.dir) < 0.5,
      }
    })
    expect(rows).toEqual(rows.map(({ id }) => ({ id, underCap: true, covers: true, smoothTurn: true, settles: true })))
  })

  it('never judders: the view and the flight change how fast they turn smoothly from frame to frame', () => {
    // A path with corners (straight lines between samples, a ground clamp that bumps and lets go) or a look averaged
    // with one box turns the camera in steps a player feels as judder: 200 to 1900 degrees a second of change in one
    // frame before #675's follow-up, under 40 after it.
    const frames = INTRO_SECONDS * FPS
    const rows = TOURS.map((s) => {
      const p0 = v()
      const p1 = v()
      const p2 = v()
      const d0 = v()
      const d1 = v()
      const top = s.tour.length / INTRO_SECONDS
      let lookStep = 0
      let flightStep = 0
      let prevLook = -1
      let prevFlight = -1
      tourPose(s.tour, 0, s.seat, s.dir, p0, d0)
      tourPose(s.tour, introProgress(1 / FPS), s.seat, s.dir, p1, d1)
      for (let i = 2; i <= frames; i++) {
        tourPose(s.tour, introProgress(i / FPS), s.seat, s.dir, p2, d0)
        const look = angleDeg(d0, d1) * FPS
        if (prevLook >= 0) lookStep = Math.max(lookStep, Math.abs(look - prevLook))
        prevLook = look
        const a = v(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z)
        const b = v(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
        // The flight's heading only counts while it moves: a turn crawling into the seat reads as none.
        if (Math.hypot(a.x, a.y, a.z) * FPS > top / 4) {
          const flight = angleDeg(a, b) * FPS
          if (prevFlight >= 0) flightStep = Math.max(flightStep, Math.abs(flight - prevFlight))
          prevFlight = flight
        } else prevFlight = -1
        Object.assign(p0, p1)
        Object.assign(p1, p2)
        Object.assign(d1, d0)
      }
      return { id: s.id, lookSmooth: lookStep < 15, flightSmooth: flightStep < 60 }
    })
    expect(rows).toEqual(rows.map(({ id }) => ({ id, lookSmooth: true, flightSmooth: true })))
  })

  it('starts high over the seat, passes the landmark looking at it, and keeps clear of the ground', () => {
    const rows = TOURS.map((s) => {
      const pos = v()
      const dir = v()
      tourPose(s.tour, s.tour.marks.reveal, s.seat, s.dir, pos, dir)
      const high = pos.y - s.seat.y >= 100 * s.scale || s.bounds !== undefined
      tourPose(s.tour, s.tour.marks.landmark, s.seat, s.dir, pos, dir)
      const looksAtLandmark = angleDeg(dir, v(s.anchor.x - pos.x, s.anchor.y - pos.y, s.anchor.z - pos.z)) < 20
      // Off the landing (the last 2 % of the intro), never within 20 units × trackScale of the ground, or the seat's own height.
      let lowest = Infinity
      for (let i = 0; i <= 500; i++) {
        tourPose(s.tour, (i / 500) * 0.98, s.seat, s.dir, pos, dir)
        lowest = Math.min(lowest, pos.y - s.ground(pos.x, pos.z))
      }
      const { reveal, landmark, track, landing } = s.tour.marks
      return { id: s.id, high, looksAtLandmark, clear: lowest >= Math.min(20 * s.scale, s.seat.y - s.ground(s.seat.x, s.seat.z)), ordered: reveal < landmark && landmark < track && track < landing && landing < 1 }
    })
    expect(rows).toEqual(rows.map(({ id }) => ({ id, high: true, looksAtLandmark: true, clear: true, ordered: true })))
  })

  it('keeps an interior tour inside its walls', () => {
    const gym = TOURS.find((s) => s.bounds === HALL_BOUNDS)!
    const pos = v()
    const dir = v()
    let outside = 0
    for (let i = 0; i <= 200; i++) {
      tourPose(gym.tour, i / 200, gym.seat, gym.dir, pos, dir)
      if (pos.x < HALL_BOUNDS.minX || pos.x > HALL_BOUNDS.maxX || pos.z < HALL_BOUNDS.minZ || pos.z > HALL_BOUNDS.maxZ || pos.y > HALL_BOUNDS.maxY) outside++
    }
    expect(outside).toBe(0)
  })

  it('eases onto a seat that has moved since the tour was built', () => {
    const s = TOURS[0]
    const moved = v(s.seat.x + 30, s.seat.y, s.seat.z)
    const pos = v()
    const dir = v()
    tourPose(s.tour, 0.5, moved, s.dir, pos, dir)
    const mid = { ...pos }
    tourPose(s.tour, 0.5, s.seat, s.dir, pos, dir)
    expect(mid).toEqual(pos)
    tourPose(s.tour, 1 - 1e-6, moved, s.dir, pos, dir)
    expect(dist(pos, moved)).toBeLessThan(0.01)
  })

  it('banks into the turns and is level at both ends', () => {
    for (const s of TOURS) {
      expect(Math.abs(tourPose(s.tour, 0, s.seat, s.dir, v(), v()))).toBeLessThan(1e-6)
      expect(Math.max(...Array.from(s.tour.bank, Math.abs))).toBeGreaterThan(0)
    }
  })
})

describe('buildIntroTour', () => {
  // It runs on the main thread at level mount: a long task there is what #597 took out. 25 000 samples is ~10 ms of
  // terrain noise on a desktop; a layout whose spline alone is over the speed cap must not pay for its ground.
  it('samples the ground at most 25 000 times on any level', () => {
    const over = Object.entries(GROUND_SAMPLES).filter(([, n]) => n > 25_000)
    expect(over).toEqual([])
    expect(Object.keys(GROUND_SAMPLES)).toHaveLength(TOURS.length)
  })
})

describe('tourDistance', () => {
  it('runs 0 to 1 over the intro, easing out of the reveal and into the seat', () => {
    const samples = Array.from({ length: 121 }, (_, i) => tourDistance(i / 120))
    expect(samples[0]).toBe(0)
    expect(samples[120]).toBeCloseTo(1, 12)
    expect(samples.every((x, i) => i === 0 || x > samples[i - 1])).toBe(true)
    expect(samples[1]).toBeLessThan(1e-3)
    expect(1 - samples[119]).toBeLessThan(1e-3)
  })
})

describe('introProgress', () => {
  it('runs 0 to 1 over the fixed intro on the clock, holding the start before it and the seat after it', () => {
    expect(INTRO_SECONDS).toBeGreaterThanOrEqual(8)
    expect(INTRO_SECONDS).toBeLessThanOrEqual(10)
    expect(introProgress(INTRO_SECONDS / 2)).toBeCloseTo(0.5, 12)
    expect(introProgress(-1)).toBe(0)
    expect(introProgress(INTRO_SECONDS + 5)).toBe(1)
  })
})

describe('orbitPose', () => {
  const flat = () => 0
  const hero: HeroShot = { x: 100, z: -50, focus: 80, orbitRadius: 400, orbitHeight: 200 }

  it('circles the landmark at its radius and height, a turn a minute, looking at its focus', () => {
    const pos = v()
    const target = v()
    orbitPose(hero, 10, 0, 0, flat, undefined, pos, target)
    expect(pos).toEqual(v(500, 210, -50))
    expect(target).toEqual(v(100, 90, -50))
    orbitPose(hero, 10, Math.PI / 2 / ORBIT_RATE, 0, flat, undefined, pos, target)
    expect(pos.x).toBeCloseTo(100, 6)
    expect(pos.z).toBeCloseTo(350, 6)
  })

  it('rises over ground higher than the landmark\'s', () => {
    const pos = v()
    orbitPose(hero, 0, 0, 0, () => 500, undefined, pos, v())
    expect(pos.y).toBeGreaterThan(500)
  })

  it('swings a wall landmark through its arc, inside the hall', () => {
    const gym = BIOMES.gym.hero
    const pos = v()
    const target = v()
    let maxYaw = 0
    let outside = 0
    for (let s = 0; s < 120; s += 0.5) {
      orbitPose(gym, 0, s, 0, flat, HALL_BOUNDS, pos, target)
      maxYaw = Math.max(maxYaw, Math.abs(Math.atan2(pos.z - gym.z, pos.x - gym.x) - gym.facing!))
      if (pos.x < HALL_BOUNDS.minX || pos.x > HALL_BOUNDS.maxX || pos.z < HALL_BOUNDS.minZ || pos.z > HALL_BOUNDS.maxZ || pos.y > HALL_BOUNDS.maxY) outside++
    }
    expect(outside).toBe(0)
    expect(maxYaw).toBeLessThanOrEqual(gym.arc! + 1e-9)
  })
})
