import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { RUN_SECONDS } from '@/levels/pacing'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { createHeightFunction, createTerrainSurface, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import type { EnemyWave, Formation, LevelConfig } from '@/types/level'
import { buildArcTable, type ArcTable } from '@/track/arcLength'
import { rideProfile, rideSpeeds, riddenBetween } from '@/track/ridePhysics'
import { getTrackDimensions } from '@/track/trackDimensions'
import { MIN_HORIZONTAL_FOV } from '@/track/cameraFov'
import {
  AIR_CLEARANCE, ENTRY_SECONDS, ENTRY_STAGGER, FORMATIONS, NEAR_FIELD, entryPoint, formationFrame, formationSlots, groupStep,
  indexAhead, marchHeading, outsideNearField, placeFormationWave, placeTracksideWave, slotOffset, trackPoint,
  trackTangent, trackView, tracksideAhead, tracksideBand, tracksideSlots,
  type ChoreographedFormation, type RideAhead, type Vec3,
} from './spawnPlacement'
import { ENEMY_PLACEMENT, WATER_DEPTH, WATER_Y, placedBesideTrack } from './enemyPlacement'
import { waveWindows } from './waveSchedule'
import { BIOMES } from '@/levels/environments/biomeRegistry'
import { REFERENCE_FOV_DEG, maxReadableDistance } from '../enemies/enemyReadability'

/** Share of trackside enemies in front of the rider on their approach; the gym's authored spline spirals tightly round the Flame (follow-up issue). */
const inFrontShare = (level: LevelConfig) => (level.track.curve === 'spline' ? 0.7 : 0.85)

const choreographed = (f: Formation | undefined): f is ChoreographedFormation => !!f && f !== 'scatter'
const besideTrack = (w: EnemyWave) => !choreographed(w.formation) && placedBesideTrack(w.type)

function world(level: LevelConfig) {
  const curve = createTrackCurve(level.track)
  const table = buildArcTable(curve)
  const heightFn = createHeightFunction(level.biome, sampleTrackPath((t) => curve.getPointAt(t)), BIOMES[level.biome].floor)
  const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize(level.biome))
  // What EnemySpawner hands each wave: the ride from GO over its entry and its window.
  const profile = rideProfile(table, rideSpeeds(level.track), RUN_SECONDS)
  const { trackScale } = getTrackDimensions(level.track)
  const windows = waveWindows(level.enemies.map((w) => w.spawnDelay ?? 0), level.boss?.at, RUN_SECONDS)
  const rides: RideAhead[] = windows.map(([from, to]) => ({
    entry: riddenBetween(profile, from, from + ENTRY_SECONDS + ENTRY_STAGGER),
    window: riddenBetween(profile, from, to),
    trackScale,
  }))
  const rideFor = (wave: EnemyWave) => rides[level.enemies.indexOf(wave)]
  return { level, table, groundFn, rideFor, trackScale }
}

const STILL: RideAhead = { entry: 0, window: 0, trackScale: 1 }

const worlds = getAllLevels().filter((l) => l.enemies.some((w) => choreographed(w.formation))).map(world)
const tracksideWorlds = getAllLevels().filter((l) => l.enemies.some(besideTrack)).map(world)

const RIDER_FRACTIONS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

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

describe.each(worlds.map((w) => [w.level.id, w] as const))('%s formation waves', (_id, { level, table, groundFn, rideFor, trackScale }) => {
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
      const placed = placeFormationWave({ table, riderIndex, camera, formation, origin: wave.formationOrigin, type: wave.type, groundFn, slots, ride })
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
          expect(marchHeading(p.motion)).toBe(marchHeading(leader.motion))
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

describe.each(tracksideWorlds.map((w) => [w.level.id, w] as const))('%s trackside waves', (_id, { level, table, groundFn, rideFor }) => {
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
      const placed = placeTracksideWave({ table, riderIndex, camera, type: wave.type, groundFn, slots, ride })
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
          expect(lateral).toBeGreaterThan(band.sideMin - 1)
          expect(lateral).toBeLessThan(band.sideMax + 1)
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
    expect(inFront / total).toBeGreaterThan(inFrontShare(level))
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
