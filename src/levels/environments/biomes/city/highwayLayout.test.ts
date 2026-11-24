import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { rideModel } from '@/track/ridePhysics'
import { planDistance } from '@/track/rideV2'
import { planTowers } from '@/track/supportTowers'
import { getTrackDimensions } from '@/track/trackDimensions'
import { trackExtent } from '../../shared/trackScatter'
import { cityTowers, layoutCity } from './cityLayout'
import { STREET_GRID } from './config'
import { DECK, deckHeightAt, HIGHWAY, highwayObstacles, highwayPylons, nearHighway, PYLON, RAMP, routeCoords, routeLength } from './highwayLayout'

// Fitting a new track: move HIGHWAY's ends or deck height until these pass (the first two are the fit)
const level = shippedLevel('level7')
const curve = createTrackCurve(level.track)
const table = buildArcTable(curve)
const length = routeLength(HIGHWAY)
const pylons = highwayPylons(HIGHWAY, table)
/**
 * Rail to deck top when the ride passes over; rail to the deck's underside when it passes under: the rider's eye and a
 * margin, the head-chopper (`cityTrack.ts`) passing as close as that.
 */
const CLEAR = { over: 16, under: getTrackDimensions(level.track).eyeHeight + 2 }

/** Every track sample over the deck's footprint, with the deck's height there. */
const overDeck = Array.from({ length: table.count }, (_, i) => ({ i, ...routeCoords(HIGHWAY, table.x[i], table.z[i]) }))
  .filter(({ u, v }) => Math.abs(v) < DECK.width / 2 + 4 && u > 0 && u < length)
  .map(({ i, u }) => ({ s: table.s[i], y: table.y[i], deck: deckHeightAt(HIGHWAY, u) }))

describe('the elevated highway', () => {
  it('never meets the track: wherever the ride crosses the deck it is well over the road or well under the slab', () => {
    const clashes = overDeck.filter((p) => !(p.y > p.deck + CLEAR.over || p.y < p.deck - DECK.thickness - CLEAR.under))
    expect(clashes).toEqual([])
  })

  it('the ride passes under it before the boss', () => {
    const plan = rideModel(level.track, table).plan
    expect(plan).toBeDefined()
    const bossAt = planDistance(plan!, level.boss!.at)
    const ridden = overDeck.filter((p) => p.s < bossAt)
    const under = ridden.find((p) => p.y < p.deck)
    expect(under, 'under the deck').toBeDefined()
    expect(under!.deck, 'under the full-height deck, not a ramp').toBe(HIGHWAY.deck)
  })

  it('no support tower of the track stands up through the deck', () => {
    const towers = planTowers(curve, table, getTrackDimensions(level.track), () => 0).towers
    const through = towers.filter((t) => {
      const { u, v } = routeCoords(HIGHWAY, t.x, t.z)
      return Math.abs(v) < DECK.width / 2 + 10 && u > -10 && u < length + 10 && t.topY > deckHeightAt(HIGHWAY, u) - DECK.thickness
    })
    expect(through).toEqual([])
  })

  it('stands on pylons along its whole raised length, each off the track and the streets', () => {
    expect(pylons.length).toBeGreaterThan(length / (2 * PYLON.spacing))
    for (let k = 1; k < pylons.length; k++) {
      const gap = Math.hypot(pylons[k].x - pylons[k - 1].x, pylons[k].z - pylons[k - 1].z)
      expect(gap).toBeGreaterThanOrEqual(PYLON.spacing - 1e-6)
    }
    // No unpropped span longer than a block and a half
    const spans = pylons.slice(1).map((p, k) => Math.hypot(p.x - pylons[k].x, p.z - pylons[k].z))
    expect(Math.max(...spans)).toBeLessThan(STREET_GRID.pitch * 1.5)
    expect(routeCoords(HIGHWAY, pylons[0].x, pylons[0].z).u).toBeLessThan(RAMP)
    const onTrack = pylons.filter((p) => {
      let min = Infinity
      for (let i = 0; i < table.count; i++) min = Math.min(min, Math.hypot(table.x[i] - p.x, table.z[i] - p.z))
      return min < PYLON.size / 2 + 20
    })
    expect(onTrack).toEqual([])
    const { pitch, street } = STREET_GRID
    const inStreet = pylons.filter((p) =>
      [p.x, p.z].some((c) => Math.abs(pitch / 2 - Math.abs(c - Math.round(c / pitch) * pitch)) < street / 2 + PYLON.size / 2),
    )
    expect(inStreet).toEqual([])
  })

  it('takes its corridor out of the city: no tower stands in the deck', () => {
    const towers = layoutCity(table, trackExtent(table)).towers
    expect(towers.filter((t) => nearHighway(HIGHWAY, t.x, t.z, Math.hypot(t.w, t.d) / 2))).toEqual([])
  })

  it('keeps the air enemies out of the deck and from under it', () => {
    const obstacles = highwayObstacles(HIGHWAY)
    expect(cityTowers(table, trackExtent(table))).toEqual(expect.arrayContaining(obstacles))
    for (let u = 0; u < length; u += 10) {
      const x = HIGHWAY.from.x + ((HIGHWAY.to.x - HIGHWAY.from.x) * u) / length
      const z = HIGHWAY.from.z + ((HIGHWAY.to.z - HIGHWAY.from.z) * u) / length
      const covered = obstacles.some((b) => Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2 && b.h >= deckHeightAt(HIGHWAY, u))
      expect(covered).toBe(true)
    }
  })
})
