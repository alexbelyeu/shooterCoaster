import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable, tAtLoopDistance } from '@/track/arcLength'
import { lapSeconds, rideProfile, rideSpeeds } from '@/track/ridePhysics'
import { getTrackDimensions } from '@/track/trackDimensions'
import { LOOK_AHEAD_UNITS, lookAheadDirection } from '@/track/cameraRig'
import { MIN_HORIZONTAL_FOV } from '@/track/cameraFov'
import { RUN_SECONDS } from '@/levels/pacing'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { MEDUSA_BODY, MEDUSA_HUB, MEDUSA_RISE, bustClearance, yawToward } from '@/entities/bosses/medusaMotion'
import {
  ARCH,
  BLOCKOUT_BOXES,
  FLAME,
  GYM_SCALE,
  HALL,
  PIT,
  STAR,
  TREE,
  archAxial,
  archOpeningClearance,
  distanceToBox,
  floorAt,
  glassDistance,
  toBlockout,
  toWorld,
  treeAlong,
  treeFaceDistance,
  type Vec3,
} from './blockout'
import { GYM_TRACK, RAIL_CLEARANCE } from './gymTrack'

/** The Tree climb and the glass room pass count within this many metres of the face / windows. */
const NEAR = 5
/** The spiral's turn is counted while the track is within this many metres of the Flame's centre. */
const SPIRAL_RADIUS = 20
/** Vertical half-angle of the view: the coaster camera's 80° base FOV (narrow screens only widen it). */
const VERTICAL_HALF_FOV = 40
const N = 4000
const DEG = 180 / Math.PI

const curve = createTrackCurve(GYM_TRACK)
const table = buildArcTable(curve)
const speeds = rideSpeeds(GYM_TRACK)
const dims = getTrackDimensions(GYM_TRACK)
/** Arc distance ridden every 0.1 s from GO. */
const profile = rideProfile(table, speeds, RUN_SECONDS + 5)
/** N samples by arc length, in blockout metres. */
const track: Vec3[] = Array.from({ length: N }, (_, i) => {
  const p = curve.getPointAt(i / N)
  return toBlockout({ x: p.x, y: p.y, z: p.z })
})
const secondsAt = (i: number) => profile.findIndex((s) => s >= (i / N) * table.length) / 10

describe('the gym blockout', () => {
  it('scales the hall to landmark size, the length of the generated tracks (≈ 1000–1600 units)', () => {
    const length = toWorld({ x: HALL.w, y: 0, z: 0 }).x - toWorld({ x: 0, y: 0, z: 0 }).x
    expect(length).toBeGreaterThanOrEqual(1000)
    expect(length).toBeLessThanOrEqual(1600)
    expect(toWorld({ x: 0, y: HALL.h, z: HALL.d }).y / (HALL.h * GYM_SCALE)).toBe(1)
  })

  it('round-trips blockout ↔ world', () => {
    const p = { x: 12.5, y: -2, z: 33 }
    const back = toBlockout(toWorld(p))
    expect(Math.hypot(back.x - p.x, back.y - p.y, back.z - p.z)).toBeLessThan(1e-9)
  })

  it('reads every piece into finite boxes', () => {
    const bad = BLOCKOUT_BOXES.filter((b) => ![b.minA, b.maxA, b.minF, b.maxF, b.minY, b.maxY].every(Number.isFinite) || b.minA > b.maxA || b.minF > b.maxF || b.minY > b.maxY)
    expect(bad.map((b) => b.id)).toEqual([])
    expect(BLOCKOUT_BOXES.length).toBeGreaterThan(40)
  })
})

describe('the gym track', () => {
  it('rides a 60 s lap (±5 s) with the level speeds', () => {
    expect(Math.abs(lapSeconds(curve, speeds) - RUN_SECONDS)).toBeLessThanOrEqual(5)
  })

  it('never passes through a blockout piece, the floor or the hall, and never through itself', () => {
    let pieces = Infinity
    let floor = Infinity
    let hall = Infinity
    for (const p of track) {
      for (const box of BLOCKOUT_BOXES) pieces = Math.min(pieces, distanceToBox(box, p))
      floor = Math.min(floor, p.y - floorAt(p.x, p.z))
      hall = Math.min(hall, p.x, HALL.w - p.x, p.z, HALL.d - p.z, HALL.h - p.y)
    }
    let self = Infinity
    const metresPerSample = table.length / GYM_SCALE / N
    const apart = Math.ceil(12 / metresPerSample)
    for (let i = 0; i < N; i += 2) {
      for (let j = i + apart; j < N && j <= i + N - apart; j += 2) {
        const a = track[i]
        const b = track[j]
        self = Math.min(self, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z))
      }
    }
    expect(pieces).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(floor).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(hall).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(self).toBeGreaterThanOrEqual(2 * RAIL_CLEARANCE)
  })

  it('fits the car and rider inside the rail clearance', () => {
    expect((dims.railGauge + dims.railRadius) / GYM_SCALE).toBeLessThan(RAIL_CLEARANCE)
    expect(dims.eyeHeight / GYM_SCALE).toBeLessThan(RAIL_CLEARANCE)
  })

  it('threads the Arch: through its opening, clear of the legs and soffit', () => {
    const passage = track.filter((p) => Math.abs(archAxial(p)) <= ARCH.depth / 2 && archOpeningClearance(p) > -ARCH.width)
    expect(passage.length * (table.length / GYM_SCALE / N)).toBeGreaterThan(ARCH.depth - 0.5)
    expect(Math.min(...passage.map(archOpeningClearance))).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it('spirals at least one full turn round the Flame, never over its flared footprint', () => {
    let swept = 0
    let most = 0
    let prev: number | null = null
    let over = 0
    for (const p of [...track, ...track]) {
      const dx = p.x - FLAME.centre.x
      const dz = p.z - FLAME.centre.z
      if (Math.abs(dx) <= FLAME.halfX && Math.abs(dz) <= FLAME.halfZ) over++
      if (Math.hypot(dx, dz) > SPIRAL_RADIUS) {
        swept = 0
        prev = null
        continue
      }
      const angle = Math.atan2(dz, dx)
      if (prev !== null) swept += Math.atan2(Math.sin(angle - prev), Math.cos(angle - prev))
      prev = angle
      most = Math.max(most, Math.abs(swept))
    }
    expect(most * DEG).toBeGreaterThanOrEqual(360)
    expect(over).toBe(0)
  })

  it('climbs the Tree past its caves into the headwall, close to its face, and passes the glass room windows', () => {
    const onFace = track.filter((p) => Math.abs(treeAlong(p)) <= TREE.width / 2 && treeFaceDistance(p) <= NEAR)
    const heights = onFace.map((p) => p.y)
    expect(Math.min(...heights)).toBeLessThan(TREE.caveTopY)
    expect(Math.max(...heights)).toBeGreaterThan(TREE.caveTopY + 2)
    expect(Math.max(...heights)).toBeLessThan(TREE.headTopY)
    expect(Math.min(...track.map(glassDistance))).toBeLessThanOrEqual(NEAR)
  })

  it('dives into the Starr pit between 34 and 40 s, its lowest point down in the pit above the floor', () => {
    let low = 0
    for (let i = 1; i < N; i++) if (track[i].y < track[low].y) low = i
    // The dive starts at the crest the track descends from, all the way down to its lowest point.
    let crest = low
    while (track[(crest - 1 + N) % N].y >= track[crest].y) crest = (crest - 1 + N) % N
    const p = track[low]
    expect(p.x > PIT.minX && p.x < PIT.maxX && p.z > PIT.minZ && p.z < PIT.maxZ).toBe(true)
    expect(p.y).toBeLessThan(0)
    expect(p.y - PIT.floorY).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(secondsAt(crest)).toBeGreaterThanOrEqual(34)
    expect(secondsAt(crest)).toBeLessThanOrEqual(40)
  })

  it('keeps the star in the camera view at least 80% of 40–60 s', () => {
    const star = toWorld(STAR.centre)
    const look = { x: 0, y: 0, z: 0 }
    const eye = new THREE.Vector3()
    const ahead = new THREE.Vector3()
    const right = new THREE.Vector3()
    const up = new THREE.Vector3()
    const forward = new THREE.Vector3()
    const toStar = new THREE.Vector3()
    let seen = 0
    let frames = 0
    for (let k = 400; k <= 600; k++) {
      const s = profile[k] % table.length
      const t = s / table.length
      eye.copy(curve.getPointAt(t))
      eye.y += dims.eyeHeight
      const tangent = curve.getTangentAt(t).clone()
      ahead.copy(curve.getPointAt(tAtLoopDistance(table, s + LOOK_AHEAD_UNITS * dims.trackScale)))
      ahead.y += dims.eyeHeight
      ahead.sub(eye).normalize()
      lookAheadDirection(tangent, ahead, look)
      forward.set(look.x, look.y, look.z)
      right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize()
      up.crossVectors(right, forward)
      toStar.set(star.x, star.y, star.z).sub(eye)
      const depth = toStar.dot(forward)
      const across = Math.atan2(toStar.dot(right), depth) * DEG
      const vertical = Math.atan2(toStar.dot(up), depth) * DEG
      frames++
      if (depth > 0 && Math.abs(across) <= MIN_HORIZONTAL_FOV / 2 && Math.abs(vertical) <= VERTICAL_HALF_FOV) seen++
    }
    expect(seen / frames).toBeGreaterThanOrEqual(0.8)
  })

  it("keeps the rails and the camera clear of the Medusa's bust from her rise to the run's end, leant out or not", () => {
    /** World units kept between her bust and the rails or the rider's eye. */
    const MARGIN = 20
    const from = getLevelConfig('level6')!.boss!.at
    const local: [number, number, number] = [0, 0, 0]
    let worst = Infinity
    for (const lean of [0, 1]) {
      const out = MEDUSA_BODY.out + MEDUSA_RISE.leanOut * lean
      const pitch = MEDUSA_RISE.leanPitch * lean
      for (let k = from * 10; k <= RUN_SECONDS * 10; k++) {
        const p = curve.getPointAt((profile[k] % table.length) / table.length)
        for (const lift of [0, dims.eyeHeight]) {
          // Into her root's frame: x across, z out of the star, y up; then her turn towards the rider, then her lean.
          const dx = p.x - MEDUSA_HUB[0]
          const dz = p.z - MEDUSA_HUB[2]
          const x = dx * STAR.facing.z - dz * STAR.facing.x
          const z = dx * STAR.facing.x + dz * STAR.facing.z - out
          const y = p.y + lift - MEDUSA_HUB[1]
          const yaw = yawToward(x, z + out)
          const xr = x * Math.cos(yaw) - z * Math.sin(yaw)
          const zr = x * Math.sin(yaw) + z * Math.cos(yaw)
          local[0] = xr
          local[1] = y * Math.cos(pitch) + zr * Math.sin(pitch)
          local[2] = -y * Math.sin(pitch) + zr * Math.cos(pitch)
          worst = Math.min(worst, bustClearance(local, MARGIN))
        }
      }
    }
    expect(worst).toBeGreaterThan(1)
  })
})
