import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable, tAtLoopDistance } from '@/track/arcLength'
import { rideModel, rideProfile } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS } from '@/track/rideV2'
import { seatUp } from '@/track/trackGeometry'
import { eyeClearance } from '@/track/elements/headChopper'
import { getTrackDimensions } from '@/track/trackDimensions'
import { LOOK_AHEAD_UNITS, lookAheadDirection } from '@/track/cameraRig.hot'
import { tourPose } from '@/track/introCamera.hot'
import { buildIntroTour } from '@/track/introTour'
import { type JunctionMechanic, buildJunction, switchPose } from '@/track/mechanics'
import { gymFloor } from './config'
import { BASE_VERTICAL_FOV, MIN_HORIZONTAL_FOV } from '@/track/cameraFov.hot'
import { RUN_SECONDS } from '@/levels/pacing'
import { getLevelConfig } from '@/levels/LevelRegistry'
import {
  MEDUSA_BODY,
  MEDUSA_HUB,
  MEDUSA_RISE,
  MEDUSA_SIZE,
  SNAKE,
  SNAKE_SLOTS,
  bodyPlacement,
  bustClearance,
  laySnake,
  yawToward,
} from '@/entities/bosses/medusaMotion'
import {
  ARCH,
  BLOCKOUT_BOXES,
  FLAME,
  GYM_SCALE,
  HALL,
  STAR,
  archAxial,
  archOpeningClearance,
  distanceToBox,
  floorAt,
  piece,
  toBlockout,
  toWorld,
  type Vec3,
} from './blockout'
import { GYM_TRACK, RAIL_CLEARANCE } from './gymTrack'
import { meshClearance } from './geometryChecks'
import { buildHall, holdGeometry } from './hallGeometry'
import { gym } from './index'
import { darkSectionDepth } from '@/track/darkSection.hot'

/** The roof trusses' bottom chords (`hallGeometry.ts`). */
const TRUSS_UNDERSIDE = HALL.h - 4.5
const caveRoof = piece('floor', 'ewsmmqw')
/** The Training Area's cave, open to the hall under its roof. */
const CAVE = { minX: caveRoof.x - caveRoof.w / 2, maxX: caveRoof.x + caveRoof.w / 2, roof: caveRoof.base }
/** Vertical half-angle of the view at the coaster camera's base FOV (narrow screens only widen it). */
const VERTICAL_HALF_FOV = BASE_VERTICAL_FOV / 2
/** Seconds from the Medusa's arrival that her crown snake stays in the rider's view (#856). */
const CROWN_IN_VIEW_SECONDS = 2.5
const N = 4000
const DEG = 180 / Math.PI

const curve = createTrackCurve(GYM_TRACK)
const table = buildArcTable(curve)
const speeds = rideModel(GYM_TRACK, table)
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
  it('scales the hall to landmark size, inside the other worlds\' extents (≈ 2000–5200 units across)', () => {
    const length = toWorld({ x: HALL.w, y: 0, z: 0 }).x - toWorld({ x: 0, y: 0, z: 0 }).x
    expect(length).toBeGreaterThanOrEqual(2000)
    expect(length).toBeLessThanOrEqual(5200)
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
  it("lands every storyboard beat on its second (±0.5 s), riding its mechanics' stops (#700)", () => {
    const beats = GYM_TRACK.rideV2?.beats ?? []
    expect(beats.length).toBeGreaterThanOrEqual(7)
    for (const beat of beats) {
      const landed = profile.findIndex((s) => s >= beat.at * table.length) / 10
      expect(Math.abs(landed - beat.second), `beat at ${beat.second} s`).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS + 0.1)
    }
  })

  it('never passes through a blockout piece, the floor or the hall, and never through itself', () => {
    let pieces = Infinity
    let floor = Infinity
    let hall = Infinity
    for (const p of track) {
      for (const box of BLOCKOUT_BOXES) pieces = Math.min(pieces, distanceToBox(box, p))
      floor = Math.min(floor, p.y - floorAt(p.x, p.z))
      // The Training Area's cave opens off the east wall (z 0) under its roof: the ride runs through it (#700).
      const inCave = p.x > CAVE.minX && p.x < CAVE.maxX && p.y < CAVE.roof
      hall = Math.min(hall, p.x, HALL.w - p.x, inCave ? Infinity : p.z, HALL.d - p.z, HALL.h - p.y)
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

  it('keeps clear of everything the hall draws: railings, stairs, benches, props, holds (#695)', () => {
    const hall = buildHall()
    const hold = holdGeometry()
    const holds = hall.holds.matrices.map((m) => hold.clone().applyMatrix4(m))
    const nearest = meshClearance([hall.solid, hall.light, hall.glass, ...holds], RAIL_CLEARANCE)
    expect(nearest.distance, `nearest at ${JSON.stringify(nearest.at)}`).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it('fits the car and rider inside the rail clearance', () => {
    expect((dims.railGauge + dims.railRadius) / GYM_SCALE).toBeLessThan(RAIL_CLEARANCE)
    expect(dims.eyeHeight / GYM_SCALE).toBeLessThan(RAIL_CLEARANCE)
  })

  it('forks the V8 route (#702) off the run across the hall to Alaska, clear of the blockout, the floor, the hall and the rest of the track', () => {
    const junction = buildJunction(curve, GYM_TRACK.mechanics!.find((m): m is JunctionMechanic => m.kind === 'junction')!)
    const branch = Array.from({ length: 801 }, (_, i) => toBlockout(junction.branch.getPointAt(i / 800)))
    let pieces = Infinity
    let floor = Infinity
    let hall = Infinity
    let apart = 0
    let others = Infinity
    const margin = 0.03
    const rest = track.filter((_, i) => i / N < junction.from - margin || i / N > junction.to + margin)
    branch.forEach((p, i) => {
      for (const box of BLOCKOUT_BOXES) pieces = Math.min(pieces, distanceToBox(box, p))
      floor = Math.min(floor, p.y - floorAt(p.x, p.z))
      hall = Math.min(hall, p.x, HALL.w - p.x, p.z, HALL.d - p.z, HALL.h - p.y)
      const m = toBlockout(curve.getPointAt(junction.from + ((junction.to - junction.from) * i) / 800))
      apart = Math.max(apart, Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z))
      for (const q of rest) others = Math.min(others, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z))
    })
    expect(pieces).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(floor).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(hall).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(others).toBeGreaterThanOrEqual(2 * RAIL_CLEARANCE)
    // A real choice: the routes part by metres, not a wiggle.
    expect(apart).toBeGreaterThan(5)
    // Both ways fall between the burst out of the cave and the wall ride's beat.
    const forkSeconds = secondsAt(Math.round(junction.from * N))
    const mergeSeconds = secondsAt(Math.round(junction.to * N))
    expect(forkSeconds).toBeGreaterThan(19)
    expect(mergeSeconds).toBeLessThan(23)
    // The switch sign stands clear of everything solid, on the branch's side.
    const sign = toBlockout(switchPose(curve, junction, dims.eyeHeight).position)
    let signClear = Infinity
    for (const box of BLOCKOUT_BOXES) signClear = Math.min(signClear, distanceToBox(box, sign))
    expect(signClear).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it('threads the Arch: through its opening, clear of the legs and soffit', () => {
    const passage = track.filter((p) => Math.abs(archAxial(p)) <= ARCH.depth / 2 && archOpeningClearance(p) > -ARCH.width)
    expect(passage.length * (table.length / GYM_SCALE / N)).toBeGreaterThan(ARCH.depth - 0.5)
    expect(Math.min(...passage.map(archOpeningClearance))).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it('rolls upside down over the Flame, clear of its flared footprint (#700)', () => {
    const up = new THREE.Vector3()
    let inverted = 0
    let lowest = Infinity
    for (let i = 0; i < N; i++) {
      const p = track[i]
      if (Math.abs(p.x - FLAME.centre.x) > FLAME.halfX || Math.abs(p.z - FLAME.centre.z) > FLAME.halfZ) continue
      lowest = Math.min(lowest, p.y)
      if (seatUp(curve, i / N, up).y < -0.9) inverted++
    }
    expect(inverted).toBeGreaterThan(0)
    expect(lowest - FLAME.top).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it("passes the rider's eye a near miss under the Arch's lintel, measured (#700)", () => {
    const box = {
      min: toWorld({ x: ARCH.centre.x - ARCH.width / 2, y: ARCH.height, z: ARCH.centre.z - ARCH.depth / 2 }),
      max: toWorld({ x: ARCH.centre.x + ARCH.width / 2, y: ARCH.height + 2, z: ARCH.centre.z + ARCH.depth / 2 }),
    }
    const near = eyeClearance(curve, box, dims.eyeHeight) / GYM_SCALE
    expect(near).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(near).toBeLessThan(1.2)
  })

  it("lands a head-chopper beat under the Arch's lintel in the run's first seconds (#926)", () => {
    const underArch = (GYM_TRACK.rideV2?.beats ?? []).filter((beat) => {
      const p = toBlockout(curve.getPointAt(beat.at))
      return Math.abs(archAxial(p)) <= ARCH.depth / 2 && archOpeningClearance(p) > 0
    })
    expect(underArch.map((beat) => beat.second)).toEqual([2])
  })

  it("tours the hall into the seat in the station clear of every piece, riding the track's turn in (#659, #675, #700)", () => {
    const { hero } = gym
    expect(hero.approach).toBeGreaterThan(0)
    const seat = curve.getPointAt(0).clone()
    seat.y += dims.eyeHeight
    const seatDir = curve.getTangentAt(0).clone()
    const tour = buildIntroTour({
      curve, table, seatT: 0, eyeHeight: dims.eyeHeight, trackScale: dims.trackScale, hero, heroGround: hero.ground ?? 0, ground: gymFloor, bounds: gym.bounds,
    })
    const pos = { x: 0, y: 0, z: 0 }
    const dir = { x: 0, y: 0, z: 0 }
    let pieces = Infinity
    let floor = Infinity
    for (let i = 0; i <= 1000; i++) {
      tourPose(tour, i / 1000, seat, seatDir, pos, dir)
      const p = toBlockout(pos)
      for (const box of BLOCKOUT_BOXES) pieces = Math.min(pieces, distanceToBox(box, p))
      floor = Math.min(floor, p.y - floorAt(p.x, p.z))
    }
    expect(pieces).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    expect(floor).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it("rides the Training Area's cave dark (#752): fully dark only under its roof, from the storyboard's ~15 s", () => {
    expect(GYM_TRACK.darkSections).toHaveLength(1)
    const [cave] = GYM_TRACK.darkSections!
    expect(cave.ramp).toBeGreaterThan(0)
    expect(cave.to - cave.from).toBeGreaterThan(4 * cave.ramp)
    // Every point between the ramps is inside the cave's walls, below its roof.
    const outside: number[] = []
    for (let i = 0; i < N; i++) {
      if (darkSectionDepth(GYM_TRACK.darkSections, i / N) < 1) continue
      const p = track[i]
      if (p.x < CAVE.minX || p.x > CAVE.maxX || p.y > CAVE.roof) outside.push(i / N)
    }
    expect(outside).toEqual([])
    // In after the airtime hill, out before the run at Alaska.
    const from = secondsAt(cave.from * N)
    const to = secondsAt(cave.to * N)
    expect(from).toBeGreaterThan(12)
    expect(from).toBeLessThan(16)
    expect(to - from).toBeGreaterThan(2)
    expect(to).toBeLessThan(20)
  })

  it('climbs Alaska to just under the roof trusses, jumps to the Shield and drops into the pit (#700)', () => {
    const top = Math.max(...track.map((p) => p.y))
    expect(top + dims.eyeHeight / GYM_SCALE).toBeLessThan(TRUSS_UNDERSIDE - RAIL_CLEARANCE)
    expect(top).toBeGreaterThan(TRUSS_UNDERSIDE - 2.5)
    expect(GYM_TRACK.mechanics?.map((m) => m.kind)).toEqual(['station', 'junction', 'jumpGap', 'dropTrack'])
  })

  /** The rider's view 0.1·`k` s from GO: the eye and the coaster camera's axes, as the star and crown tests see it. */
  const view = (() => {
    const look = { x: 0, y: 0, z: 0 }
    const v = { eye: new THREE.Vector3(), forward: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() }
    const ahead = new THREE.Vector3()
    const to = new THREE.Vector3()
    return {
      at(k: number) {
        const s = profile[k] % table.length
        const t = s / table.length
        v.eye.copy(curve.getPointAt(t))
        v.eye.y += dims.eyeHeight
        ahead.copy(curve.getPointAt(tAtLoopDistance(table, s + LOOK_AHEAD_UNITS * dims.trackScale)))
        ahead.y += dims.eyeHeight
        ahead.sub(v.eye).normalize()
        lookAheadDirection(curve.getTangentAt(t).clone(), ahead, look)
        v.forward.set(look.x, look.y, look.z)
        v.right.crossVectors(v.forward, THREE.Object3D.DEFAULT_UP).normalize()
        v.up.crossVectors(v.right, v.forward)
        return v.eye
      },
      /** In the narrowest view (narrow screens only widen it vertically). */
      sees(p: { x: number; y: number; z: number }) {
        to.set(p.x, p.y, p.z).sub(v.eye)
        const depth = to.dot(v.forward)
        const across = Math.atan2(to.dot(v.right), depth) * DEG
        const vertical = Math.atan2(to.dot(v.up), depth) * DEG
        return depth > 0 && Math.abs(across) <= MIN_HORIZONTAL_FOV / 2 && Math.abs(vertical) <= VERTICAL_HALF_FOV
      },
    }
  })()

  it('comes out of the helix facing the star as the Medusa rises, and keeps her in view to the run\'s end (#926)', () => {
    const at = getLevelConfig('level6')!.boss!.at
    const star = toWorld(STAR.centre)
    // Every tenth of a second from her rise to the end of the run: the finale is her fight.
    const unseen: number[] = []
    for (let k = at * 10; k <= RUN_SECONDS * 10; k++) {
      view.at(k)
      if (!view.sees(star)) unseen.push(k / 10)
    }
    expect(unseen, 'seconds the star is off screen').toEqual([])
  })

  it("holds the Medusa's crown snake, her last phase ducked, in view for the run at her (#856)", () => {
    const at = getLevelConfig('level6')!.boss!.at
    const crown = SNAKE_SLOTS[SNAKE_SLOTS.length - 1]
    const hub = new THREE.Vector3(...MEDUSA_HUB)
    const facing = new THREE.Vector3(STAR.facing.x, 0, STAR.facing.z).normalize()
    const place = { y: 0, z: 0, scale: 1, pitch: 0 }
    bodyPlacement(10, 0, 1, -1, place)
    // Her root as `Medusa.tsx` places it, turned towards the rider each step.
    const root = new THREE.Object3D()
    root.rotation.order = 'YXZ'
    root.scale.setScalar(place.scale * MEDUSA_SIZE)
    root.position.copy(hub).addScaledVector(facing, place.z * MEDUSA_SIZE)
    root.position.y += place.y * MEDUSA_SIZE
    const toEye = new THREE.Vector3()
    const head = new THREE.Vector3()
    const points = new Float32Array((SNAKE.segments + 1) * 3)
    const n = SNAKE.segments * 3
    const unseen: string[] = []
    for (let k = at * 10; k <= (at + CROWN_IN_VIEW_SECONDS) * 10; k++) {
      const eye = view.at(k)
      toEye.subVectors(eye, hub)
      root.rotation.set(place.pitch, Math.atan2(facing.x, facing.z) + yawToward(toEye.x * facing.z - toEye.z * facing.x, toEye.x * facing.x + toEye.z * facing.z), 0)
      root.updateMatrixWorld()
      toEye.copy(eye)
      root.worldToLocal(toEye)
      toEye.set(toEye.x - crown.root[0], toEye.y - crown.root[1], toEye.z - crown.root[2]).normalize()
      // Swaying and rearing back, the strike cycle up to its lunge (struck at the rider it fills the view for a moment).
      for (let f = 0; f < SNAKE.strikeAt; f += 0.05) {
        laySnake(crown, f * crown.period - crown.offset, 1, true, [toEye.x, toEye.y, toEye.z], points)
        head.set(points[n], points[n + 1], points[n + 2]).applyMatrix4(root.matrixWorld)
        if (!view.sees(head)) unseen.push(`${k / 10} s, ${f.toFixed(2)} of its strike`)
      }
    }
    expect(unseen, 'moments the crown snake is off screen').toEqual([])
  })

  it("keeps the rails and the camera clear of the Medusa's bust from her rise to the run's end, leant out, ducked or not", () => {
    /** Kept between her bust and the rails or the rider's eye, in her own units (world / `MEDUSA_SIZE`). */
    const MARGIN = 20
    const from = getLevelConfig('level6')!.boss!.at
    const local: [number, number, number] = [0, 0, 0]
    let worst = Infinity
    // Risen, leant out (her second phase) and ducked back (her last).
    for (const [lean, duck] of [[0, 0], [1, 0], [0, 1]]) {
      const out = MEDUSA_BODY.out + MEDUSA_RISE.leanOut * lean
      const drop = MEDUSA_RISE.duck * duck
      const pitch = MEDUSA_RISE.leanPitch * lean
      for (let k = from * 10; k <= RUN_SECONDS * 10; k++) {
        const p = curve.getPointAt((profile[k] % table.length) / table.length)
        for (const lift of [0, dims.eyeHeight]) {
          // Into her root's frame (her own units, `MEDUSA_SIZE`): x across, z out of the star, y up; then her turn towards the rider, then her lean.
          const dx = (p.x - MEDUSA_HUB[0]) / MEDUSA_SIZE
          const dz = (p.z - MEDUSA_HUB[2]) / MEDUSA_SIZE
          const x = dx * STAR.facing.z - dz * STAR.facing.x
          const z = dx * STAR.facing.x + dz * STAR.facing.z - out
          const y = (p.y + lift - MEDUSA_HUB[1]) / MEDUSA_SIZE + drop
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
