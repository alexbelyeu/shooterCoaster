import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { RUN_SECONDS } from '@/levels/pacing'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { createTerrainSurface, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import type { EnemyWave, Formation, LevelConfig, WallSurface } from '@/types/level'
import { buildArcTable, type ArcTable } from '@/track/arcLength'
import { rideModel, rideProfile } from '@/track/ridePhysics'
import { getTrackDimensions } from '@/track/trackDimensions'
import { MIN_HORIZONTAL_FOV } from '@/track/cameraFov.hot'
import {
  AIR_CLEARANCE, FORMATIONS, NEAR_FIELD, clampToBounds, entryPoint, formationFrame, formationSlots, groupStep,
  indexAhead, insideBounds, marchHeading, marchMoving, outsideNearField, placeFormationWave, placeTracksideWave, slotOffset, trackPoint,
  inView, placeWallClimbers, placeWallSwarm, rideAheadOfWaves, trackTangent, trackView, tracksideAhead, tracksideBand, tracksideSlots,
  type ChoreographedFormation, type RideAhead, type Vec3,
} from './spawnPlacement'
import {
  ENEMY_PLACEMENT, SWARM_SPACING, WALL_START_SPREAD, WATER_DEPTH, WATER_Y, bystanderSlots, placedBesideTrack, swarmSlots, wallPoint,
} from './enemyPlacement'
import { CLIMB } from '../enemies/climbMotion'
import { HOP } from '../enemies/hopGlideMotion'
import { BIOMES, biomeHeightFunction } from '@/levels/environments/biomeRegistry'
import { REFERENCE_FOV_DEG, maxReadableDistance } from '../enemies/enemyReadability'

/** Share of trackside enemies in front of the rider on their approach, on every level (level 6's tight spline too, #543). */
const IN_FRONT_SHARE = 0.85

const choreographed = (f: Formation | undefined): f is ChoreographedFormation => !!f && f !== 'scatter'
const besideTrack = (w: EnemyWave) => !choreographed(w.formation) && placedBesideTrack(w.type)

function world(level: LevelConfig) {
  const curve = createTrackCurve(level.track)
  const table = buildArcTable(curve)
  const heightFn = biomeHeightFunction(level.biome, sampleTrackPath((t) => curve.getPointAt(t)))
  const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize(level.biome))
  // What EnemySpawner hands each wave: the ride from GO over its entry and its window.
  const { trackScale } = getTrackDimensions(level.track)
  const rides = rideAheadOfWaves(table, rideModel(level.track, table), level.enemies.map((w) => w.spawnDelay ?? 0), level.boss?.at, trackScale)
  const rideFor = (wave: EnemyWave) => rides[level.enemies.indexOf(wave)]
  return { level, table, groundFn, rideFor, trackScale, bounds: BIOMES[level.biome].bounds, keepOff: BIOMES[level.biome].keepOff?.(groundFn, table) ?? [] }
}

const STILL: RideAhead = { entry: 0, window: 0, trackScale: 1 }

const worlds = getAllLevels().filter((l) => l.enemies.some((w) => choreographed(w.formation))).map(world)
const tracksideWorlds = getAllLevels().filter((l) => l.enemies.some(besideTrack)).map(world)

const RIDER_FRACTIONS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** Horizontal distance from `p` to the nearest rail of the lap. */
function railGap(table: ArcTable, p: Vec3): number {
  let gap = Infinity
  for (let i = 0; i < table.count; i++) gap = Math.min(gap, Math.hypot(p.x - table.x[i], p.z - table.z[i]))
  return gap
}

function nearestIndex(table: ArcTable, p: Vec3): number {
  let best = 0
  for (let i = 1; i < table.count; i++) if (dist(trackPoint(table, i), p) < dist(trackPoint(table, best), p)) best = i
  return best
}

describe('formationSlots', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = formationSlots('v', 25, createRng(1337))
    const b = formationSlots('v', 25, createRng(1337))
    const c = formationSlots('v', 25, createRng(1338))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it.each(Object.keys(FORMATIONS) as ChoreographedFormation[])('%s: keeps the count, groups no larger than the spec', (f) => {
    for (const count of [1, 7, 25, 50]) {
      const slots = formationSlots(f, count, createRng(1))
      expect(slots).toHaveLength(count)
      const sizes = new Map<number, number>()
      for (const s of slots) sizes.set(s.group, (sizes.get(s.group) ?? 0) + 1)
      for (const size of sizes.values()) expect(size).toBeLessThanOrEqual(FORMATIONS[f].groupSize)
      for (const s of slots) expect(s.groupSize).toBe(sizes.get(s.group))
    }
  })

  it('lays a V out leader first, arms alternating and trailing away', () => {
    const n = 9
    const slots = Array.from({ length: n }, (_, i) => slotOffset('v', i, n, 100))
    expect(slots[0]).toEqual({ x: 0, y: 0, z: 0 })
    for (let i = 1; i < n; i += 2) {
      const left = slots[i]
      const right = slots[i + 1]
      expect(left.x).toBeLessThan(0)
      expect(right.x).toBeCloseTo(-left.x)
      expect(right.z).toBeCloseTo(left.z)
      if (i > 1) expect(left.z).toBeGreaterThan(slots[i - 2].z)
    }
  })
})

describe('track frame', () => {
  const { table } = worlds[0]

  it('walks ahead around the loop', () => {
    const i = indexAhead(table, 100, 500)
    expect(table.s[i] - table.s[100]).toBeCloseTo(500, -1)
    const wrapped = indexAhead(table, table.count - 10, 500)
    expect(wrapped).toBeLessThan(table.count / 2)
  })

  it('anchors later groups further ahead, alternating sides', () => {
    const a = formationFrame(table, 0, 'line', 0, STILL, Infinity)
    const b = formationFrame(table, 0, 'line', 1, STILL, Infinity)
    expect(a.sideSign).toBe(1)
    expect(b.sideSign).toBe(-1)
    expect(nearestIndex(table, b.track)).toBeGreaterThan(nearestIndex(table, a.track))
    expect(Math.hypot(a.forward.x, a.forward.z)).toBeCloseTo(1)
    expect(a.forward.x * a.right.x + a.forward.z * a.right.z).toBeCloseTo(0)
  })
})

/** Cosine of the bearing of `p` off the view's horizontal look direction. */
function bearingCos(view: { eye: Vec3; dir: Vec3 }, p: Vec3): number {
  const d = { x: p.x - view.eye.x, z: p.z - view.eye.z }
  return (d.x * view.dir.x + d.z * view.dir.z) / (Math.hypot(d.x, d.z) * Math.hypot(view.dir.x, view.dir.z))
}

const HALF_FOV_COS = Math.cos((MIN_HORIZONTAL_FOV * Math.PI) / 360)

describe.each(worlds.map((w) => [w.level.id, w] as const))('%s formation waves', (_id, { level, table, groundFn, rideFor, trackScale, bounds }) => {
  const waves = level.enemies.filter((w) => choreographed(w.formation))

  it.each(waves.map((w) => [`${w.type} ${w.formation}`, w] as const))('%s: first group ahead of the rider once it has flown in, nothing in the near field or under the ground', (_name, wave) => {
    const formation = wave.formation as ChoreographedFormation
    const slots = formationSlots(formation, wave.count, createRng(1337))
    const surface = ENEMY_PLACEMENT[wave.type].surface
    const ride = rideFor(wave)
    for (const fraction of RIDER_FRACTIONS) {
      const riderIndex = Math.round(fraction * (table.count - 1))
      const camera = trackPoint(table, riderIndex)
      const landed = trackView(table, indexAhead(table, riderIndex, ride.entry), trackScale)
      const placed = placeFormationWave({ table, riderIndex, camera, formation, origin: wave.formationOrigin, type: wave.type, groundFn, slots, ride, bounds })
      expect(placed).toHaveLength(wave.count)
      let ahead = 0
      placed.forEach((p, i) => {
        const ground = groundFn(p.position.x, p.position.z)
        if (surface === 'air') expect(p.position.y).toBeGreaterThanOrEqual(ground + AIR_CLEARANCE - 1e-6)
        else if (surface === 'water') expect(p.position.y).toBeGreaterThanOrEqual(WATER_Y)
        else expect(p.position.y).toBeGreaterThan(ground)
        expect(dist(p.position, camera)).toBeGreaterThanOrEqual(NEAR_FIELD - 1e-6)
        expect(dist(p.from, camera)).toBeGreaterThanOrEqual(NEAR_FIELD - 1e-6)
        expect(p.entrySeconds).toBeGreaterThanOrEqual(1)
        expect(p.entrySeconds).toBeLessThanOrEqual(2)
        if (formation === 'ring') expect(p.motion).toEqual({ kind: 'hold' })
        else if (formation === 'spiral') expect(p.motion).toBeUndefined()
        else {
          // One heading per group, so its shape holds.
          const leader = placed[slots.findIndex((s) => s.group === slots[i].group)]
          expect(marchHeading(p.motion)).toBeTypeOf('number')
          expect(p.motion).toEqual(leader.motion)
        }
        if (slots[i].group === 0 && bearingCos(landed, p.position) > 0) ahead++
      })
      const firstGroup = slots.filter((s) => s.group === 0).length
      expect(ahead).toBeGreaterThanOrEqual(Math.ceil(firstGroup * 0.8))
    }
  })

  it.each(waves.map((w) => [`${w.type} ${w.formation}`, w] as const))('%s: activated on a turn, each group lands inside the view the rider has when it gets there', (_name, wave) => {
    const formation = wave.formation as ChoreographedFormation
    const slots = formationSlots(formation, wave.count, createRng(1337))
    const ride = rideFor(wave)
    const reach = maxReadableDistance(wave.type)
    const groups = slots.reduce((n, s) => Math.max(n, s.group + 1), 0)
    const step = groupStep(table, formation, groups, ride)
    let turns = 0
    for (let k = 0; k < 200; k++) {
      const riderIndex = Math.round((k / 200) * (table.count - 1))
      const now = trackView(table, riderIndex, trackScale)
      const landed = trackView(table, indexAhead(table, riderIndex, ride.entry), trackScale)
      if (bearingCos(now, { x: now.eye.x + landed.dir.x, y: 0, z: now.eye.z + landed.dir.z }) > Math.cos((15 * Math.PI) / 180)) continue
      turns++
      const placed = placeFormationWave({ table, riderIndex, camera: now.eye, formation, origin: wave.formationOrigin, type: wave.type, groundFn, slots, ride })
      for (let g = 0; g < groups; g++) {
        const view = trackView(table, indexAhead(table, riderIndex, g * step + ride.entry), trackScale)
        const members = placed.filter((_, i) => slots[i].group === g).map((p) => p.position)
        const centre = members.reduce((c, p) => ({ x: c.x + p.x / members.length, y: c.y + p.y / members.length, z: c.z + p.z / members.length }), { x: 0, y: 0, z: 0 })
        expect(bearingCos(view, centre), `rider ${k / 200} group ${g}`).toBeGreaterThan(HALF_FOV_COS)
        if (ENEMY_PLACEMENT[wave.type].surface !== 'water') expect(dist(centre, view.eye)).toBeLessThan(reach)
      }
    }
    expect(turns).toBeGreaterThan(0)
  })

  const marching = waves.filter((w) => ['v', 'line', 'school'].includes(w.formation!) && ENEMY_PLACEMENT[w.type].surface !== 'water')
  it.each(marching.map((w) => [`${w.type} ${w.formation}`, w] as const))('%s: each group marches once the rider reaches it, not from activation (#472)', (_name, wave) => {
    const formation = wave.formation as ChoreographedFormation
    const slots = formationSlots(formation, wave.count, createRng(1337))
    const ride = rideFor(wave)
    const groups = slots.reduce((n, s) => Math.max(n, s.group + 1), 0)
    const step = groupStep(table, formation, groups, ride)
    let waiting = 0
    for (const fraction of RIDER_FRACTIONS) {
      const riderIndex = Math.round(fraction * (table.count - 1))
      const camera = trackView(table, riderIndex, trackScale).eye
      const placed = placeFormationWave({ table, riderIndex, camera, formation, origin: wave.formationOrigin, type: wave.type, groundFn, slots, ride, bounds })
      for (let g = 0; g < groups; g++) {
        const { motion } = placed[slots.findIndex((s) => s.group === g)]
        const there = trackView(table, indexAhead(table, riderIndex, g * step + ride.entry), trackScale)
        expect(marchMoving(motion, there.eye), `rider ${fraction} group ${g}`).toBe(true)
        if (!marchMoving(motion, camera)) waiting++
      }
    }
    if (groups > 1) expect(waiting).toBeGreaterThan(0)
  })

  it.each(waves.map((w) => [`${w.type} ${w.formation}`, w] as const))('%s: groups spread over the window the rider covers', (_name, wave) => {
    const formation = wave.formation as ChoreographedFormation
    const ride = rideFor(wave)
    const groups = Math.ceil(wave.count / FORMATIONS[formation].groupSize)
    const step = groupStep(table, formation, groups, ride)
    expect(step).toBeGreaterThanOrEqual(FORMATIONS[formation].groupGap)
    expect((groups - 1) * step).toBeGreaterThanOrEqual(Math.min(ride.window * ((groups - 1) / groups), 0.75 * table.length * ((groups - 1) / groups)) - 1e-6)
    expect((groups - 1) * step).toBeLessThan(0.75 * table.length + FORMATIONS[formation].groupGap * groups)
  })
})

describe('level3 school', () => {
  it('lands on water', () => {
    const { level, table, groundFn, rideFor } = worlds.find((w) => w.level.id === 'level3')!
    const wave = level.enemies.find((w) => w.formation === 'school')!
    const slots = formationSlots('school', wave.count, createRng(7))
    let wet = 0
    let total = 0
    for (const fraction of RIDER_FRACTIONS) {
      const riderIndex = Math.round(fraction * (table.count - 1))
      const placed = placeFormationWave({ table, riderIndex, camera: trackPoint(table, riderIndex), formation: 'school', type: wave.type, groundFn, slots, ride: rideFor(wave) })
      for (const p of placed) {
        total++
        if (groundFn(p.position.x, p.position.z) < WATER_Y) wet++
      }
    }
    expect(wet / total).toBeGreaterThan(0.95)
  })
})

describe('tracksideSlots', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(tracksideSlots(20, 'ground', createRng(1337))).toEqual(tracksideSlots(20, 'ground', createRng(1337)))
    expect(tracksideSlots(20, 'ground', createRng(1337))).not.toEqual(tracksideSlots(20, 'ground', createRng(1338)))
  })

  it.each(['ground', 'water'] as const)('%s: puts slots on both sides, inside the ahead and lateral bands', (surface) => {
    const band = tracksideBand(surface)
    const slots = tracksideSlots(200, surface, createRng(3))
    expect(slots.some((s) => s.side < 0) && slots.some((s) => s.side > 0)).toBe(true)
    for (const s of slots) {
      expect(s.ahead).toBeGreaterThanOrEqual(band.aheadMin)
      expect(s.ahead).toBeLessThanOrEqual(band.aheadMax)
      expect(Math.abs(s.side)).toBeGreaterThanOrEqual(band.sideMin)
      expect(Math.abs(s.side)).toBeLessThanOrEqual(band.sideMax)
    }
    if (band.near) {
      const nearCount = Math.ceil(slots.length * band.near.share)
      for (const s of slots.slice(0, nearCount)) expect(s.ahead).toBeLessThanOrEqual(band.near.max)
      expect(slots.slice(nearCount).some((s) => s.ahead > band.near!.max)).toBe(true)
    }
  })
})

/** Arc distance before its slot at which a trackside enemy must be in front of the rider. */
const APPROACH = 600

const groundWorlds = tracksideWorlds.filter((w) => w.level.enemies.some((e) => besideTrack(e) && ENEMY_PLACEMENT[e.type].surface === 'ground'))

describe.each(groundWorlds.map((w) => [w.level.id, w] as const))('%s ground trackside spread', (_id, { level, table, rideFor }) => {
  const waves = level.enemies.filter((w) => besideTrack(w) && ENEMY_PLACEMENT[w.type].surface === 'ground')

  it.each(waves.map((w) => [w.type, w] as const))('%s: slots spread evenly along the stretch the rider covers in the window', (_name, wave) => {
    const band = tracksideBand('ground')
    const ride = rideFor(wave)
    const aheads = tracksideSlots(wave.count, 'ground', createRng(1337))
      .map((s) => tracksideAhead(table, 'ground', s, ride))
      .sort((a, b) => a - b)
    const end = band.aheadMin + Math.min(ride.window, 0.75 * table.length - band.aheadMin)
    const step = (Math.max(end, band.aheadMax) - band.aheadMin) / wave.count
    expect(aheads[0]).toBeGreaterThanOrEqual(band.aheadMin)
    expect(aheads[0]).toBeLessThanOrEqual(band.aheadMin + step)
    expect(aheads[aheads.length - 1]).toBeGreaterThanOrEqual(end - step)
    expect(aheads[aheads.length - 1]).toBeLessThanOrEqual(0.75 * table.length)
    for (let i = 1; i < aheads.length; i++) expect(aheads[i] - aheads[i - 1]).toBeLessThanOrEqual(2 * step)
  })
})

describe.each(tracksideWorlds.map((w) => [w.level.id, w] as const))('%s trackside waves', (_id, { level, table, groundFn, rideFor, bounds, keepOff }) => {
  const waves = level.enemies.filter(besideTrack)

  it.each(waves.map((w) => [w.type, w] as const))('%s: ahead of the rider along the track, beside the rails, on its surface, outside the near field, in front on the approach', (_name, wave) => {
    const { surface } = ENEMY_PLACEMENT[wave.type]
    const band = tracksideBand(surface)
    const slots = tracksideSlots(wave.count, surface, createRng(1337))
    const ride = rideFor(wave)
    let inFront = 0
    let total = 0
    for (const fraction of RIDER_FRACTIONS) {
      const riderIndex = Math.round(fraction * (table.count - 1))
      const camera = trackPoint(table, riderIndex)
      const placed = placeTracksideWave({ table, riderIndex, camera, type: wave.type, groundFn, slots, ride, bounds, keepOff })
      expect(placed).toHaveLength(wave.count)
      placed.forEach((p, i) => {
        if (surface === 'water') {
          let lateral = Infinity
          for (let a = band.aheadMin; a <= band.aheadMax; a += 10) {
            const j = indexAhead(table, riderIndex, a)
            lateral = Math.min(lateral, Math.hypot(p.x - table.x[j], p.z - table.z[j]))
          }
          expect(lateral).toBeLessThan(band.sideMax + 1)
          expect(groundFn(p.x, p.z)).toBeLessThan(WATER_DEPTH)
          expect(p.y).toBe(WATER_Y)
        } else {
          const anchor = indexAhead(table, riderIndex, tracksideAhead(table, surface, slots[i], ride))
          const arc = (table.s[anchor] - table.s[riderIndex] + table.length) % table.length
          expect(arc).toBeGreaterThan(band.aheadMin - 10)
          expect(arc).toBeLessThan(Math.max(band.aheadMax, band.aheadMin + ride.window) + 10)
          const lateral = Math.hypot(p.x - table.x[anchor], p.z - table.z[anchor])
          if (lateral > band.sideMax + 1) {
            // A blind approach's spot, out along its look (#494): never inside an interior, off every rail and landmark.
            expect(bounds).toBeUndefined()
            expect(railGap(table, p)).toBeGreaterThan(band.sideMin - 1)
            expect(keepOff.every((c) => Math.hypot(p.x - c.x, p.z - c.z) >= c.r)).toBe(true)
          } else {
            expect(lateral).toBeGreaterThan(band.sideMin - 1)
          }
          expect(p.y).toBeGreaterThan(groundFn(p.x, p.z))
        }
        expect(dist(p, camera)).toBeGreaterThanOrEqual(NEAR_FIELD - 1e-6)
        const near = indexAhead(table, riderIndex, tracksideAhead(table, surface, slots[i], ride) - APPROACH)
        const nearPoint = trackPoint(table, near)
        const forward = trackTangent(table, near)
        total++
        if ((p.x - nearPoint.x) * forward.x + (p.z - nearPoint.z) * forward.z > 0) inFront++
      })
    }
    expect(inFront / total).toBeGreaterThan(IN_FRONT_SHARE)
  })
})

describe('level6: inside the hall', () => {
  const w = world(getAllLevels().find((l) => l.id === 'level6')!)
  const { level, table, groundFn, rideFor, bounds } = w
  const hall = BIOMES.gym.bounds!

  it('the gym has bounds, the hall inset by 40 units', () => {
    expect(bounds).toBe(hall)
    expect([hall.minX, hall.maxX, hall.minZ, hall.maxZ]).toEqual([-1240, 1240, -600, 600])
  })

  it('every ground and air placement, entry starts included, lies inside the hall (#546)', () => {
    const outside: string[] = []
    let placements = 0
    const check = (what: string, p: Vec3) => {
      placements++
      if (!insideBounds(p, hall)) outside.push(`${what} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)})`)
    }
    for (const wave of level.enemies.filter((e) => besideTrack(e) || choreographed(e.formation))) {
      const ride = rideFor(wave)
      for (const fraction of RIDER_FRACTIONS) {
        const riderIndex = Math.round(fraction * (table.count - 1))
        const camera = trackPoint(table, riderIndex)
        if (choreographed(wave.formation)) {
          const slots = formationSlots(wave.formation, wave.count, createRng(1337))
          for (const p of placeFormationWave({ table, riderIndex, camera, formation: wave.formation, origin: wave.formationOrigin, type: wave.type, groundFn, slots, ride, bounds })) {
            check(`${wave.type} at ${fraction}`, p.position)
            check(`${wave.type} entry at ${fraction}`, p.from)
          }
        } else {
          const slots = tracksideSlots(wave.count, ENEMY_PLACEMENT[wave.type].surface, createRng(1337))
          for (const p of placeTracksideWave({ table, riderIndex, camera, type: wave.type, groundFn, slots, ride, bounds })) check(`${wave.type} at ${fraction}`, p)
        }
      }
    }
    expect(placements).toBeGreaterThan(700)
    expect(outside).toEqual([])
  })
})

describe('clampToBounds', () => {
  const b = { minX: -10, maxX: 10, minZ: -5, maxZ: 5, maxY: 20 }
  it('holds a point inside the walls and under the roof, and leaves one inside alone', () => {
    expect(clampToBounds({ x: 30, y: 50, z: -9 }, b)).toEqual({ x: 10, y: 20, z: -5 })
    expect(clampToBounds({ x: 1, y: 2, z: 3 }, b)).toEqual({ x: 1, y: 2, z: 3 })
    expect(clampToBounds({ x: 30, y: 50, z: -9 }, undefined)).toEqual({ x: 30, y: 50, z: -9 })
  })
})

describe('level3 opening jellyfish', () => {
  const { level, table, groundFn, rideFor } = tracksideWorlds.find((w) => w.level.id === 'level3')!
  const wave = level.enemies[0]
  const tanV = Math.tan((REFERENCE_FOV_DEG * Math.PI) / 360)
  const tanH = (tanV * 16) / 9
  const reach = maxReadableDistance(wave.type)

  /** Readable enemies in a 16:9 view along the track tangent, for each rider position over ride t 0–0.025 (the smoke's ride sample at any runner speed). */
  function readableThroughOpening(seed: number): number[] {
    const slots = tracksideSlots(wave.count, 'water', createRng(seed))
    const placed = placeTracksideWave({ table, riderIndex: 0, camera: trackPoint(table, 0), type: wave.type, groundFn, slots, ride: rideFor(wave) })
    const counts: number[] = []
    for (let t = 0; t <= 0.025 + 1e-9; t += 0.0025) {
      const i = Math.round(t * (table.count - 1))
      const eye = trackPoint(table, i)
      const f = trackTangent(table, i)
      const h = Math.hypot(f.x, f.z)
      const right = { x: -f.z / h, y: 0, z: f.x / h }
      const up = { x: right.y * f.z - right.z * f.y, y: right.z * f.x - right.x * f.z, z: right.x * f.y - right.y * f.x }
      counts.push(placed.filter((p) => {
        const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }
        const depth = d.x * f.x + d.y * f.y + d.z * f.z
        return depth > 0
          && Math.abs(d.x * right.x + d.z * right.z) <= depth * tanH
          && Math.abs(d.x * up.x + d.y * up.y + d.z * up.z) <= depth * tanV
          && Math.hypot(d.x, d.y, d.z) <= reach
      }).length)
    }
    return counts
  }

  it('keeps at least 4 readable on screen through the opening (seed 1337)', () => {
    expect(Math.min(...readableThroughOpening(1337))).toBeGreaterThanOrEqual(4)
  })

  it('keeps the smoke gate (2) through the opening for any seed', () => {
    for (let seed = 1; seed <= 20; seed++) expect(Math.min(...readableThroughOpening(seed)), `seed ${seed}`).toBeGreaterThanOrEqual(2)
  })
})

describe('entryPoint', () => {
  const from = { x: 0, y: -50, z: 0 }
  const to = { x: 100, y: 200, z: 0 }

  it('runs from the start to the slot, past halfway at half time (ease-out)', () => {
    const out = { x: 0, y: 0, z: 0 }
    expect(entryPoint(out, from, to, 0, 0)).toEqual(from)
    expect(entryPoint(out, from, to, 1, 0)).toEqual(to)
    entryPoint(out, from, to, 0.5, 0)
    expect(out.x).toBeGreaterThan(50)
    expect(out.x).toBeLessThan(100)
  })

  it('unwinds a spiral around the start and still lands on the slot', () => {
    const out = { x: 0, y: 0, z: 0 }
    entryPoint(out, from, to, 1, Math.PI * 3)
    expect(out.x).toBeCloseTo(to.x)
    expect(out.z).toBeCloseTo(to.z)
    entryPoint(out, from, to, 0.3, Math.PI * 3)
    expect(Math.abs(out.z)).toBeGreaterThan(1)
  })
})

describe('outsideNearField', () => {
  it('pushes a point straight out to the near field and leaves far points alone', () => {
    const cam = { x: 10, y: 0, z: 0 }
    const far = { x: 100, y: 0, z: 0 }
    expect(outsideNearField(far, cam)).toBe(far)
    const p = outsideNearField({ x: 20, y: 0, z: 0 }, cam)
    expect(p).toEqual({ x: 10 + NEAR_FIELD, y: 0, z: 0 })
    expect(dist(outsideNearField(cam, cam), cam)).toBeCloseTo(NEAR_FIELD)
  })
})

describe('placeWallSwarm (#516)', () => {
  const { table, trackScale } = world(getAllLevels()[0])
  const view = trackView(table, 0, trackScale)
  const f = { x: view.dir.x / Math.hypot(view.dir.x, view.dir.z), y: 0, z: view.dir.z / Math.hypot(view.dir.x, view.dir.z) }
  /** A 240 x 200 wall `ahead` along the rider's look, facing back down it at the eye. */
  const wallAt = (id: string, ahead: number): WallSurface => {
    const right = { x: -f.z, y: 0, z: f.x }
    const c = { x: view.eye.x + f.x * ahead, y: view.eye.y, z: view.eye.z + f.z * ahead }
    return { id, origin: { x: c.x - right.x * 120, y: c.y - 80, z: c.z - right.z * 120 }, right, up: { x: 0, y: 1, z: 0 }, width: 240, height: 200 }
  }
  const slots = swarmSlots(14, createRng(5))

  it('clusters a swarm round its centre, wider for more', () => {
    const extent = (n: number) => Math.max(...swarmSlots(n, createRng(2)).map((s) => Math.hypot(s.du, s.dv)))
    for (const s of slots) expect(Math.hypot(s.du, s.dv)).toBeLessThanOrEqual(SWARM_SPACING * Math.sqrt(14))
    expect(extent(30)).toBeGreaterThan(extent(6))
  })

  it('puts the whole swarm on the wall in front of the rider, never the one behind', () => {
    const placed = placeWallSwarm({ table, riderIndex: 0, type: 'lanternfly', walls: [wallAt('behind', -400), wallAt('ahead', 400)], slots, ride: STILL })
    expect(new Set(placed.map((p) => p.wall.id))).toEqual(new Set(['ahead']))
    for (const p of placed) {
      expect(p.u >= HOP.margin && p.u <= 240 - HOP.margin && p.v >= HOP.margin && p.v <= 200 - HOP.margin).toBe(true)
      expect(inView(view, wallPoint(p.wall, p.u, p.v, 0, { x: 0, y: 0, z: 0 }), maxReadableDistance('lanternfly'))).toBe(true)
    }
    expect(placed.map((p) => p.seed)).toEqual(slots.map((s) => s.seed))
  })

  it('needs the level to have walls', () => {
    expect(() => placeWallSwarm({ table, riderIndex: 0, type: 'lanternfly', walls: [], slots, ride: STILL })).toThrow(/walls/)
  })

  it('stands bystander climbers (#518) in a row at the foot of the wall in front of the rider', () => {
    const walls = [wallAt('behind', -400), wallAt('ahead', 400)]
    const climbers = bystanderSlots(4, createRng(9))
    const placed = placeWallClimbers({ table, riderIndex: 0, type: 'climber', walls, slots: climbers, ride: STILL })
    expect(new Set(placed.map((p) => p.wall.id))).toEqual(new Set(['ahead']))
    const us = placed.map((p) => p.u)
    for (const p of placed) {
      expect(p.u >= CLIMB.margin && p.u <= 240 - CLIMB.margin && p.v >= 0 && p.v <= WALL_START_SPREAD * 200).toBe(true)
      expect(inView(view, wallPoint(p.wall, p.u, p.v, 0, { x: 0, y: 0, z: 0 }), maxReadableDistance('climber'))).toBe(true)
    }
    // Squeezed onto a 240-wide wall, still apart: each nudge is at most a quarter of the spacing either way.
    for (let i = 1; i < us.length; i++) expect(us[i] - us[i - 1]).toBeGreaterThan(((240 - 2 * CLIMB.margin) / 4) * 0.5 - 1e-9)
    expect(placed.map((p) => p.seed)).toEqual(climbers.map((s) => s.seed))
  })
})

describe('level2: the opening climb (#494)', () => {
  const { level, table, groundFn, rideFor, trackScale, keepOff } = world(getAllLevels().find((l) => l.id === 'level2')!)
  const wave = level.enemies[0]
  const profile = rideProfile(table, rideModel(level.track, table), RUN_SECONDS)
  // The rig's frustum on the smoke's 1280×720 screen (80° vertical), looking where `trackView` does.
  const tanV = Math.tan((REFERENCE_FOV_DEG / 2) * (Math.PI / 180))
  const tanH = tanV * (1280 / 720)

  it('the scorpions placed at GO (seed 1337): at least 3 in the rig\'s view every second from 1 s to 12 s, the climb included', () => {
    const camera = trackView(table, 0, trackScale).eye
    const placed = placeTracksideWave({
      table, riderIndex: 0, camera, type: wave.type, groundFn, slots: tracksideSlots(wave.count, 'ground', createRng(1337)), ride: rideFor(wave), keepOff,
    })
    const seen: number[] = []
    for (let t = 1; t <= 12; t++) {
      const { eye, dir } = trackView(table, indexAhead(table, 0, profile[t * 10]), trackScale)
      // The camera's right (look × world up) and up (right × look), unit.
      const rl = Math.hypot(dir.x, dir.z)
      const right = { x: -dir.z, y: 0, z: dir.x }
      const up = { x: (-dir.x * dir.y) / rl, y: rl, z: (-dir.z * dir.y) / rl }
      seen.push(placed.filter((p) => {
        const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }
        const depth = d.x * dir.x + d.y * dir.y + d.z * dir.z
        const across = (d.x * right.x + d.z * right.z) / rl
        const high = d.x * up.x + d.y * up.y + d.z * up.z
        return depth > 0 && Math.abs(across) <= tanH * depth && Math.abs(high) <= tanV * depth
      }).length)
    }
    expect(Math.min(...seen), seen.join(',')).toBeGreaterThanOrEqual(3)
  })
})
