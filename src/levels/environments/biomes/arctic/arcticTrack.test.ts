import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable, distanceAtT } from '@/track/arcLength'
import { rideModel } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS, planTimeAt } from '@/track/rideV2'
import { eyeClearance } from '@/track/elements/headChopper'
import { getTrackDimensions } from '@/track/trackDimensions'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { TrackParams } from '@/types/level'
import { TRACK_SOFT_RADIUS } from '@/utils/terrainNoise'
import { arctic } from '.'
import { RIBBONS } from './aurora'
import { buildArcticRide, ARCTIC_TRACK } from './arcticTrack'
import { FORTRESS_SITE } from './config'
import { ICE_CAVE, iceCaveCrown, iceCaveSpan } from './iceCaveGeometry'
import { withDarkSections } from '@/track/setPieces'
import { createRng } from '@/utils/rng'
import { buildTrackIndex, trackFrameAt } from '../../shared/trackClearance'
import { scatterNearTrack } from '../../shared/trackScatter'
import { arcticSites } from './decorationSites'

const DEG = 180 / Math.PI
const fortress = arctic.keepOff!(() => 0, buildArcTable(createTrackCurve(ARCTIC_TRACK)))[0]

// The authored ride and the one the game ships (`arcticLevel.ts`, rounded to whole units by `gen-ride-levels.mjs`).
describe.each([
  ['as shipped', getLevelConfig('level4')!.track],
  ['as authored', ARCTIC_TRACK],
] as [string, TrackParams][])("level 4's ride (#866), %s", (_name, track) => {
  const curve = createTrackCurve(track)
  const table = buildArcTable(curve)
  const plan = rideModel(track, table).plan!
  const eye = getTrackDimensions(track).eyeHeight
  const cave = track.darkSections![0]
  const ride = buildArcticRide()

  it('lands every storyboard beat on its second', () => {
    const want = track.ride === 'v2' ? track.rideV2!.beats!.map((b) => b.second) : []
    expect(plan.landed).toHaveLength(want.length)
    plan.landed.forEach((s, i) => expect(Math.abs(s - want[i])).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS))
  })

  it("has the kit's elements: a station, two lift hills, airtime, a helix and the near miss", () => {
    const kinds = ride.markers.map((m) => m.kind)
    for (const k of ['station', 'liftHill', 'airtimeHill', 'slowMotion', 'helix', 'headChopper'] as const) expect(kinds).toContain(k)
    expect(kinds.filter((k) => k === 'liftHill')).toHaveLength(2)
  })

  it('drops at least 60° off the first lift', () => {
    let steepest = 0
    for (let i = 1; i < table.count && table.s[i] < table.length / 3; i++) {
      const ds = table.s[i] - table.s[i - 1]
      if (ds > 0) steepest = Math.max(steepest, Math.asin(Math.min(1, (table.y[i - 1] - table.y[i]) / ds)))
    }
    expect(steepest * DEG).toBeGreaterThanOrEqual(60)
  })

  it('rides the ice cave dark and level, under its mouth close but clear: the near miss', () => {
    expect(cave.look).toBe('ice')
    const from = distanceAtT(table, cave.from)
    const to = distanceAtT(table, cave.to)
    const mouth = curve.getPointAt(cave.from)
    let rise = 0
    for (let i = 0; i < table.count; i++) if (table.s[i] >= from && table.s[i] <= to) rise = Math.max(rise, table.y[i] - mouth.y)
    expect(rise).toBeLessThan(eye / 2)
    const lowest = (1 - 0.06) * iceCaveCrown(0)
    const lip = { min: { x: mouth.x - 60, y: mouth.y + lowest, z: mouth.z - 10 }, max: { x: mouth.x + 60, y: mouth.y + iceCaveCrown(0) + ICE_CAVE.wall, z: mouth.z } }
    const near = eyeClearance(curve, lip, eye, cave.from - 0.01, cave.from + 0.01)
    expect(near).toBeGreaterThan(eye)
    expect(near).toBeLessThan(4 * eye)
    const [enter, leave] = [planTimeAt(plan, from), planTimeAt(plan, to)]
    expect(leave - enter).toBeGreaterThan(2.5)
    expect(leave).toBeLessThan(getLevelConfig('level4')!.enemies.find((w) => w.weather === 'blizzard')!.spawnDelay!)
  })

  it('crests the airtime hill heading into the aurora', () => {
    const crest = ride.markers.find((m) => m.kind === 'slowMotion')!
    const [a, b] = [ride.points[crest.from], ride.points[crest.to]]
    const heading = Math.atan2(b.z - a.z, b.x - a.x)
    expect(Math.abs(heading - RIBBONS[0].azimuth) * DEG).toBeLessThan(20)
  })

  it('wheels round the Ice Fortress in the helix without carving the ground it stands on', () => {
    const helix = ride.markers.find((m) => m.kind === 'helix')!
    const distances = ride.points.slice(helix.from, helix.to + 1).map((p) => Math.hypot(p.x - FORTRESS_SITE.x, p.z - FORTRESS_SITE.z))
    expect(Math.max(...distances)).toBeLessThan(1000)
    let closest = Infinity
    for (let i = 0; i < table.count; i++) closest = Math.min(closest, Math.hypot(table.x[i] - fortress.x, table.z[i] - fortress.z))
    expect(closest).toBeGreaterThan(fortress.r + TRACK_SOFT_RADIUS)
  })

  it('never passes another stretch of itself within 8 eye heights', () => {
    let closest = Infinity
    for (let i = 0; i < table.count; i += 4) {
      for (let j = i + 4; j < table.count; j += 4) {
        const apart = table.s[j] - table.s[i]
        if (apart < 40 * eye || table.length - apart < 40 * eye) continue
        closest = Math.min(closest, Math.hypot(table.x[i] - table.x[j], table.y[i] - table.y[j], table.z[i] - table.z[j]))
      }
    }
    expect(closest).toBeGreaterThan(8 * eye)
  })
})

describe("level 4's ice cave keeps scenery out (#911)", () => {
  const track = getLevelConfig('level4')!.track
  const plain = buildArcTable(createTrackCurve(track))
  // As `LevelScene` builds it: the vault's span is on the table every prop is placed against.
  const table = withDarkSections(plain, track.darkSections)
  const { fromS, toS } = iceCaveSpan(table, track.darkSections![0])
  const vault: { x: number; z: number }[] = []
  for (let i = 0; i < table.count; i++) if (table.s[i] >= fromS && table.s[i] <= toS) vault.push({ x: table.x[i], z: table.z[i] })
  const underVault = (p: { x: number; z: number }) => vault.some((v) => Math.hypot(p.x - v.x, p.z - v.z) < ICE_CAVE.halfWidth + ICE_CAVE.wall)
  const flat = () => 0
  const scatter = (t: typeof table) =>
    scatterNearTrack({ count: 3000, track: t, heightFn: flat, minDist: 0, maxDist: 900, maxRadius: Infinity, maxSlope: Math.PI / 2, bias: 1.8, rng: createRng(911) })

  it('counts the whole vault as track, so a prop of any clearance keeps out', () => {
    const index = buildTrackIndex(table)
    const open: number[] = []
    for (let s = fromS; s <= toS; s += 10) {
      const f = trackFrameAt(table, s)
      for (let k = -1; k <= 1; k += 0.125) {
        const across = k * ICE_CAVE.halfWidth
        if (!index.near(f.x - f.tz * across, f.z + f.tx * across, 0)) open.push(s)
      }
    }
    expect(open).toEqual([])
  })

  it('places no boulder, ice column, pond, crystal or drift under it', () => {
    const { boulders, columns, ponds } = arcticSites(table, flat)
    expect([...boulders, ...columns, ...ponds].filter(underVault)).toEqual([])
    expect(scatter(table).filter(underVault)).toEqual([])
    // Without the vault on the table the same scatter does land under it: the check above is not vacuous.
    expect(scatter(plain).filter(underVault).length).toBeGreaterThan(0)
  })
})
