import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import { buildArcTable } from '@/track/arcLength'
import { createHeightFunction, createTerrainSurface, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import type { EnemyWave, Formation, LevelConfig } from '@/types/level'
import {
  AIR_CLEARANCE, FORMATIONS, NEAR_FIELD, TRACKSIDE, WATER_Y, enemySurface, entryPoint, formationFrame, formationSlots,
  indexAhead, nearestTrackIndex, outsideNearField, placeFormationWave, placeTracksideWave, placedBesideTrack, slotOffset,
  trackPoint, trackTangent, tracksideSlots, type ChoreographedFormation, type Vec3,
} from './spawnPlacement'

const choreographed = (f: Formation | undefined): f is ChoreographedFormation => !!f && f !== 'scatter'
const besideTrack = (w: EnemyWave) => !choreographed(w.formation) && placedBesideTrack(w.type)

function world(level: LevelConfig) {
  const factory = level.track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
  const curve = factory(level.track.varA, level.track.varB, level.track.varC, level.track.scalar)
  const table = buildArcTable(curve)
  const heightFn = createHeightFunction(level.biome, sampleTrackPath((t) => curve.getPointAt(t)))
  const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize(level.biome))
  return { level, table, groundFn }
}

const worlds = getAllLevels().filter((l) => l.enemies.some((w) => choreographed(w.formation))).map(world)
const tracksideWorlds = getAllLevels().filter((l) => l.enemies.some(besideTrack)).map(world)

const RIDER_FRACTIONS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

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

  it('finds the rider on the track and walks ahead around the loop', () => {
    for (const i of [0, 1000, 5000, table.count - 2]) expect(nearestTrackIndex(table, trackPoint(table, i))).toBe(i)
    const i = indexAhead(table, 100, 500)
    expect(table.s[i] - table.s[100]).toBeCloseTo(500, -1)
    const wrapped = indexAhead(table, table.count - 10, 500)
    expect(wrapped).toBeLessThan(table.count / 2)
  })

  it('anchors later groups further ahead, alternating sides', () => {
    const a = formationFrame(table, 0, 'line', 0)
    const b = formationFrame(table, 0, 'line', 1)
    expect(a.sideSign).toBe(1)
    expect(b.sideSign).toBe(-1)
    expect(nearestTrackIndex(table, b.track)).toBeGreaterThan(nearestTrackIndex(table, a.track))
    expect(Math.hypot(a.forward.x, a.forward.z)).toBeCloseTo(1)
    expect(a.forward.x * a.right.x + a.forward.z * a.right.z).toBeCloseTo(0)
  })
})

describe.each(worlds.map((w) => [w.level.id, w] as const))('%s formation waves', (_id, { level, table, groundFn }) => {
  const waves = level.enemies.filter((w) => choreographed(w.formation))

  it.each(waves.map((w) => [`${w.type} ${w.formation}`, w] as const))('%s: first group ahead of the rider, nothing in the near field or under the ground', (_name, wave) => {
    const formation = wave.formation as ChoreographedFormation
    const slots = formationSlots(formation, wave.count, createRng(1337))
    const surface = enemySurface(wave.type)
    for (const fraction of RIDER_FRACTIONS) {
      const riderIndex = Math.round(fraction * (table.count - 1))
      const camera = trackPoint(table, riderIndex)
      const forward = trackTangent(table, riderIndex)
      const placed = placeFormationWave({ table, riderIndex, camera, formation, origin: wave.formationOrigin, type: wave.type, groundFn, slots })
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
        if (slots[i].group === 0) {
          const d = { x: p.position.x - camera.x, z: p.position.z - camera.z }
          if (d.x * forward.x + d.z * forward.z > 0) ahead++
        }
      })
      const firstGroup = slots.filter((s) => s.group === 0).length
      expect(ahead).toBeGreaterThanOrEqual(Math.ceil(firstGroup * 0.8))
    }
  })
})

describe('level3 school', () => {
  it('lands on water', () => {
    const { level, table, groundFn } = worlds.find((w) => w.level.id === 'level3')!
    const wave = level.enemies.find((w) => w.formation === 'school')!
    const slots = formationSlots('school', wave.count, createRng(7))
    let wet = 0
    let total = 0
    for (const fraction of RIDER_FRACTIONS) {
      const riderIndex = Math.round(fraction * (table.count - 1))
      const placed = placeFormationWave({ table, riderIndex, camera: trackPoint(table, riderIndex), formation: 'school', type: wave.type, groundFn, slots })
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
    expect(tracksideSlots(20, createRng(1337))).toEqual(tracksideSlots(20, createRng(1337)))
    expect(tracksideSlots(20, createRng(1337))).not.toEqual(tracksideSlots(20, createRng(1338)))
  })

  it('puts slots on both sides, inside the ahead and lateral bands', () => {
    const slots = tracksideSlots(200, createRng(3))
    expect(slots.some((s) => s.side < 0) && slots.some((s) => s.side > 0)).toBe(true)
    for (const s of slots) {
      expect(s.ahead).toBeGreaterThanOrEqual(TRACKSIDE.aheadMin)
      expect(s.ahead).toBeLessThanOrEqual(TRACKSIDE.aheadMax)
      expect(Math.abs(s.side)).toBeGreaterThanOrEqual(TRACKSIDE.sideMin)
      expect(Math.abs(s.side)).toBeLessThanOrEqual(TRACKSIDE.sideMax)
    }
  })
})

describe.each(tracksideWorlds.map((w) => [w.level.id, w] as const))('%s trackside waves', (_id, { level, table, groundFn }) => {
  const waves = level.enemies.filter(besideTrack)

  it.each(waves.map((w) => [w.type, w] as const))('%s: ahead of the rider along the track and mostly in front in plan, beside the rails, on the ground, outside the near field', (_name, wave) => {
    const slots = tracksideSlots(wave.count, createRng(1337))
    let inFront = 0
    let total = 0
    for (const fraction of RIDER_FRACTIONS) {
      const riderIndex = Math.round(fraction * (table.count - 1))
      const camera = trackPoint(table, riderIndex)
      const forward = trackTangent(table, riderIndex)
      const placed = placeTracksideWave({ table, riderIndex, camera, groundFn, slots })
      expect(placed).toHaveLength(wave.count)
      placed.forEach((p, i) => {
        const anchor = indexAhead(table, riderIndex, slots[i].ahead)
        const arc = (table.s[anchor] - table.s[riderIndex] + table.length) % table.length
        expect(arc).toBeGreaterThan(TRACKSIDE.aheadMin - 10)
        expect(arc).toBeLessThan(TRACKSIDE.aheadMax + 10)
        const lateral = Math.hypot(p.x - table.x[anchor], p.z - table.z[anchor])
        expect(lateral).toBeGreaterThan(TRACKSIDE.sideMin - 1)
        expect(lateral).toBeLessThan(TRACKSIDE.sideMax + 1)
        expect(p.y).toBeGreaterThan(groundFn(p.x, p.z))
        expect(dist(p, camera)).toBeGreaterThanOrEqual(NEAR_FIELD - 1e-6)
        total++
        if ((p.x - camera.x) * forward.x + (p.z - camera.z) * forward.z > 0) inFront++
      })
    }
    expect(inFront / total).toBeGreaterThan(0.75)
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
