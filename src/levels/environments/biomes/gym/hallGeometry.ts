/** The gym's static geometry (#457): each a few merged, vertex-coloured parts (`paintedParts.ts`), one draw call per material. */
import * as THREE from 'three'
import { mergePainted, paintedAt } from '../../shared/paintedParts'
import {
  ARETE_DEPTH, CEILING_Y, HALL, HALL_WALLS, SPORT_HEIGHT, aretePositions, hallPoint, wallLanes, type HallWall,
} from './hall'
import { MAT_MARGIN, type Boulder, type RouteTag, type Volume } from './gymLayout'

const LANE_TONES = ['#eef0f2', '#d6dde6', '#e8e0d4', '#cbd8e4'] as const
const ARETE_COLOR = '#56606e'
const STEEL = '#353d48'
const UPPER_WALL = '#9aa4b0'
const CEILING = '#7d8692'
const BEAM = '#2b313a'
const SKYLIGHT = '#eaf6ff'
const MAT = '#2456a8'
const SLATE = '#4a5563'

const PANEL_DEPTH = 40
/** The upper wall leans this far into the hall from the catwalk to the ceiling: the overhang. */
const OVERHANG = 150
const CATWALK_DEPTH = 80
const RAIL_HEIGHT = 45
const POST_STEP = 110

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler(0, 0, 0, 'YXZ')
const _p = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)

const yawOf = (wall: HallWall) => Math.atan2(wall.normal.x, wall.normal.z)

/** A part in a wall's frame: `u` along, `v` up, `out` off its face; `tilt` leans its top into the hall. */
function onWall(geo: THREE.BufferGeometry, color: string, wall: HallWall, u: number, v: number, out: number, tilt = 0) {
  const p = hallPoint(wall, u, v, out)
  _q.setFromEuler(_e.set(tilt, yawOf(wall), 0))
  return paintedAt(geo, color, _m.compose(_p.set(p.x, p.y, p.z), _q, _s))
}

function wallParts(wall: HallWall, parts: THREE.BufferGeometry[]) {
  for (const [i, lane] of wallLanes(wall).entries()) {
    const width = lane.u1 - lane.u0
    parts.push(onWall(new THREE.BoxGeometry(width, SPORT_HEIGHT, PANEL_DEPTH), LANE_TONES[i % LANE_TONES.length], wall, lane.u0 + width / 2, SPORT_HEIGHT / 2, -PANEL_DEPTH / 2))
  }
  // A three-sided prism's corner points along +z: its flat back on the wall, the edge (the arête) out in the hall.
  const r = (ARETE_DEPTH * 2) / 3
  for (const u of aretePositions(wall)) {
    parts.push(onWall(new THREE.CylinderGeometry(r, r, SPORT_HEIGHT, 3), ARETE_COLOR, wall, u, SPORT_HEIGHT / 2, r / 2))
  }
  const upper = CEILING_Y - SPORT_HEIGHT
  const tilt = Math.atan2(OVERHANG, upper)
  parts.push(onWall(new THREE.BoxGeometry(wall.length, Math.hypot(upper, OVERHANG), PANEL_DEPTH), UPPER_WALL, wall, wall.length / 2, SPORT_HEIGHT + upper / 2, OVERHANG / 2 - PANEL_DEPTH / 2, tilt))
  // The catwalk round the hall at the top of the lanes: deck, rail, posts.
  parts.push(onWall(new THREE.BoxGeometry(wall.length, 12, CATWALK_DEPTH), STEEL, wall, wall.length / 2, SPORT_HEIGHT - 6, CATWALK_DEPTH / 2))
  parts.push(onWall(new THREE.BoxGeometry(wall.length, 5, 5), STEEL, wall, wall.length / 2, SPORT_HEIGHT + RAIL_HEIGHT, CATWALK_DEPTH - 3))
  for (let u = POST_STEP / 2; u < wall.length; u += POST_STEP) {
    parts.push(onWall(new THREE.BoxGeometry(4, RAIL_HEIGHT, 4), STEEL, wall, u, SPORT_HEIGHT + RAIL_HEIGHT / 2, CATWALK_DEPTH - 3))
  }
}

const SKYLIGHT_ROWS = 4
const SKYLIGHT_COLS = 3

/** Walls, arêtes, the overhanging upper walls, catwalk, ceiling and its beams: one lit draw call. */
export function hallShellGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const wall of HALL_WALLS) wallParts(wall, parts)
  const cx = (HALL.minX + HALL.maxX) / 2
  const cz = (HALL.minZ + HALL.maxZ) / 2
  const sx = HALL.maxX - HALL.minX + 2 * OVERHANG
  const sz = HALL.maxZ - HALL.minZ + 2 * OVERHANG
  parts.push(paintedAt(new THREE.BoxGeometry(sx, 40, sz), CEILING, _m.makeTranslation(cx, CEILING_Y + 20, cz)))
  const step = sz / SKYLIGHT_ROWS
  for (let k = 0; k <= SKYLIGHT_ROWS; k++) {
    parts.push(paintedAt(new THREE.BoxGeometry(sx, 36, 30), BEAM, _m.makeTranslation(cx, CEILING_Y - 18, cz - sz / 2 + k * step)))
  }
  return mergePainted(parts)
}

/** Unlit parts: skylight panes in the ceiling (the hall's light, they bloom) and each route's start tape. */
export function unlitGeometry(tags: readonly RouteTag[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const cx = (HALL.minX + HALL.maxX) / 2
  const cz = (HALL.minZ + HALL.maxZ) / 2
  const w = (HALL.maxX - HALL.minX) / SKYLIGHT_COLS
  const d = (HALL.maxZ - HALL.minZ + 2 * OVERHANG) / SKYLIGHT_ROWS
  for (let r = 0; r < SKYLIGHT_ROWS; r++) {
    for (let c = 0; c < SKYLIGHT_COLS; c++) {
      const x = cx - (SKYLIGHT_COLS * w) / 2 + (c + 0.5) * w
      const z = cz - (SKYLIGHT_ROWS * d) / 2 + (r + 0.5) * d
      parts.push(paintedAt(new THREE.BoxGeometry(w * 0.7, 6, d * 0.55), SKYLIGHT, _m.makeTranslation(x, CEILING_Y - 3, z)))
    }
  }
  for (const t of tags) {
    _q.setFromEuler(_e.set(0, t.yaw, 0))
    parts.push(paintedAt(new THREE.BoxGeometry(34, 8, 2), t.color, _m.compose(_p.set(t.x, t.y, t.z), _q, _s)))
  }
  return mergePainted(parts)
}

/** Volumes on the walls, the boulders and their mats: one lit draw call. */
export function propsGeometry(volumes: readonly Volume[], boulders: readonly Boulder[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const v of volumes) {
    // A frustum standing off the wall, its base flush.
    const geo = new THREE.CylinderGeometry(v.size * 0.75, v.size, 9, v.sides).rotateX(Math.PI / 2).translate(0, 0, 4.5)
    _q.setFromEuler(_e.set(0, v.yaw, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), v.roll))
    parts.push(paintedAt(geo, v.color, _m.compose(_p.set(v.x, v.y, v.z), _q, _s)))
  }
  for (const [i, b] of boulders.entries()) {
    const geo = new THREE.DodecahedronGeometry(1, 0).scale(b.radius, b.height * 0.6, b.radius)
    _q.setFromEuler(_e.set(0, b.yaw, 0))
    parts.push(paintedAt(geo, i % 2 ? SLATE : b.color, _m.compose(_p.set(b.x, b.height * 0.4, b.z), _q, _s)))
    const mat = 2 * (b.radius + MAT_MARGIN)
    parts.push(paintedAt(new THREE.BoxGeometry(mat, 8, mat), MAT, _m.compose(_p.set(b.x, 5, b.z), _q, _s)))
  }
  return mergePainted(parts)
}

/** Hold shapes, each sat on the wall (its back at z ≈ 0) facing +z: jug, crimp, pinch, sloper. */
export function holdGeometries(): THREE.BufferGeometry[] {
  return [
    new THREE.SphereGeometry(9, 7, 5).scale(1.3, 0.8, 0.7).translate(0, 0, 4),
    new THREE.BoxGeometry(20, 7, 8).translate(0, 0, 3),
    new THREE.ConeGeometry(7, 14, 5).rotateX(Math.PI / 2).translate(0, 0, 6),
    new THREE.DodecahedronGeometry(10, 0).scale(1.3, 0.9, 0.5).translate(0, 0, 3),
  ]
}
