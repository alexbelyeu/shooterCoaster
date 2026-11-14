import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GYM_SCALE, HALL, PIECES, PIT, floorAt, piece, pieceAxes, treeHeadLean, type Panel, type PieceOf } from './blockout'
import { BUILDING, HIDDEN_PIECES, HOLD_COLORS, VOLUME_COLORS, WALL_PAINT } from './config'
import { scatterOn, type ClimbSurface } from './holds'

/**
 * The Climbing Gym's hall, built from Alex's blockout (`blockout.ts`) in its metres and scaled once to the
 * world: every piece where he put it, in its own colours, plus the building round it (walls, roof trusses,
 * ducts, strip lights, maroon steel). Three merged meshes (painted solid, lights, glass) and the holds.
 */

const DEG = Math.PI / 180
const DEFAULT_BACK = 0.5
const SLAB = 0.3

type Paint = THREE.ColorRepresentation | ((x: number, y: number, z: number) => THREE.ColorRepresentation)

interface Parts {
  solid: THREE.BufferGeometry[]
  light: THREE.BufferGeometry[]
  glass: THREE.BufferGeometry[]
  climb: ClimbSurface[]
}

export interface HoldInstances {
  matrices: THREE.Matrix4[]
  colors: THREE.Color[]
}

export interface Hall {
  solid: THREE.BufferGeometry
  light: THREE.BufferGeometry
  glass: THREE.BufferGeometry
  holds: HoldInstances
  volumes: HoldInstances
}

const _c = new THREE.Color()

/** Non-indexed copy of `geo` (disposed), each triangle painted by its centroid in `geo`'s own frame, then placed by `m`. */
function paint(geo: THREE.BufferGeometry, color: Paint, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  if (!g.attributes.normal) g.computeVertexNormals()
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i += 3) {
    if (typeof color === 'function') {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
      _c.set(color(cx, cy, cz))
    } else {
      _c.set(color)
    }
    for (let k = 0; k < 3; k++) _c.toArray(colors, (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g.applyMatrix4(m)
}

/** A piece's frame: local x along it, z the way it faces, y up from its foot. */
function frame(p: { x: number; z: number; rot: number; base: number }, lift = 0): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationY(p.rot * DEG).setPosition(p.x, p.base + lift, p.z)
}

const IDENTITY = new THREE.Matrix4()

/** An axis-aligned box in a frame: along (x), up (y), facing (z). */
function box(minA: number, maxA: number, minY: number, maxY: number, minF: number, maxF: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(maxA - minA, maxY - minY, maxF - minF).translate((minA + maxA) / 2, (minY + maxY) / 2, (minF + maxF) / 2)
}

/** Panel tops, bottom to top, of a profile. */
function panelTops(profile: readonly Panel[]): number[] {
  let y = 0
  return profile.map((p) => (y += p.len * Math.cos(p.angle * DEG)))
}

function panelAt(tops: readonly number[], y: number): number {
  const i = tops.findIndex((top) => y < top)
  return i === -1 ? tops.length - 1 : i
}

/** A wall's cross-section in (facing, up): the climbing face up its panels, then flat back `back` behind its deepest point. */
function profileShape(profile: readonly Panel[], back: number): THREE.Shape {
  const pts = [new THREE.Vector2(0, 0)]
  let f = 0
  let y = 0
  let minF = 0
  for (const panel of profile) {
    f += panel.len * Math.sin(panel.angle * DEG)
    y += panel.len * Math.cos(panel.angle * DEG)
    minF = Math.min(minF, f)
    pts.push(new THREE.Vector2(f, y))
  }
  pts.push(new THREE.Vector2(minF - back, y), new THREE.Vector2(minF - back, 0))
  return new THREE.Shape(pts)
}

/** Extrude a (facing, up) shape `length` along the frame's x, centred. */
function extrudeAlong(shape: THREE.Shape, length: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false })
  return g.applyMatrix4(new THREE.Matrix4().makeTranslation(length / 2, 0, 0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)))
}

/** Faces that look the way the piece faces (the climbing side) and aren't its top. */
function facingSide(facing: { x: number; z: number }) {
  return (nx: number, ny: number, nz: number) => nx * facing.x + nz * facing.z > 0.2 && ny < 0.6
}
const anySide = (_nx: number, ny: number) => ny < 0.6

function climbingWall(p: PieceOf<'sport' | 'boulder'>, out: Parts): void {
  const bands = WALL_PAINT[p.id] ?? [p.color ?? BUILDING.wall]
  const tops = panelTops(p.profile)
  const g = paint(extrudeAlong(profileShape(p.profile, p.back ?? DEFAULT_BACK), p.length), (_x, y) => bands[Math.min(bands.length - 1, panelAt(tops, y))], frame(p))
  out.solid.push(g)
  const boulder = p.kind === 'boulder'
  out.climb.push({ positions: g.attributes.position.array, accept: facingSide(pieceAxes(p.rot).facing), density: boulder ? 0.9 : 0.6, volumes: boulder ? 0.05 : 0.012 })
}

/** Footprint ring of a chamfered block, offset `f` out, with a vertex mid each long side (so its two colours split cleanly). */
function footprint(hw: number, hd: number, c: number): [number, number][] {
  return [
    [hw, -hd + c], [hw, hd - c], [hw - c, hd], [0, hd], [-hw + c, hd],
    [-hw, hd - c], [-hw, -hd + c], [-hw + c, -hd], [0, -hd], [hw - c, -hd],
  ]
}

type V3 = [number, number, number]

/** Triangle soup → geometry, each triangle wound so its normal agrees with its `hint`. */
class Soup {
  readonly pos: number[] = []
  tri(a: V3, b: V3, c: V3, hint: V3): void {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const flip = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0
    this.pos.push(...a, ...(flip ? c : b), ...(flip ? b : c))
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.computeVertexNormals()
    return g
  }
}

/** The Flame and the Wave: the footprint lofted up the profile's bands, flaring out and pulling in. */
function block(p: PieceOf<'block'>, out: Parts): void {
  const rings: { f: number; y: number }[] = [{ f: 0, y: 0 }]
  for (const panel of p.profile) {
    const last = rings[rings.length - 1]
    rings.push({ f: last.f + panel.len * Math.sin(panel.angle * DEG), y: last.y + panel.len * Math.cos(panel.angle * DEG) })
  }
  const pts = rings.map((r) => footprint(p.w / 2 + r.f, p.d / 2 + r.f, p.chamfer).map(([x, z]): V3 => [x, r.y, z]))
  const soup = new Soup()
  for (let k = 0; k + 1 < pts.length; k++) {
    const lo = pts[k]
    const hi = pts[k + 1]
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length
      const hint: V3 = [lo[i][0] + lo[j][0], 0, lo[i][2] + lo[j][2]]
      soup.tri(lo[i], lo[j], hi[j], hint)
      soup.tri(lo[i], hi[j], hi[i], hint)
    }
  }
  const top = pts[pts.length - 1]
  const centre: V3 = [0, top[0][1], 0]
  for (let i = 0; i < top.length; i++) soup.tri(centre, top[i], top[(i + 1) % top.length], [0, 1, 0])
  // Two-colour halves along it, and its base band in the second pair (or, with no second pair, colorB under color).
  const baseTop = panelTops(p.profile)[0]
  const upper = p.color2 ? [p.color, p.colorB] : [p.color, p.color]
  const lower = p.color2 ? [p.color2, p.colorB2 ?? p.color2] : [p.colorB, p.colorB]
  const g = paint(soup.geometry(), (x, y) => ((y < baseTop ? lower : upper)[x < 0 ? 0 : 1] ?? BUILDING.wall), frame(p))
  out.solid.push(g)
  out.climb.push({ positions: g.attributes.position.array, accept: anySide, density: 0.9, volumes: 0.06 })
}

/** The Arch: its front elevation (round-topped opening) extruded through its passage, flares included. */
function arch(p: PieceOf<'arch'>, out: Parts): void {
  const o = p.opening / 2
  const spring = p.openingHeight - o
  const shape = new THREE.Shape()
  shape.moveTo(-p.length / 2, 0)
  shape.lineTo(-o, 0)
  shape.lineTo(-o, spring)
  shape.absarc(0, spring, o, Math.PI, 0, true)
  shape.lineTo(o, 0)
  shape.lineTo(p.length / 2, 0)
  shape.lineTo(p.length / 2, p.height)
  shape.lineTo(-p.length / 2, p.height)
  const depth = p.d + 2 * p.flare
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -depth / 2)
  const g = paint(geo, (_x, y) => (y < 0.8 ? '#1d1d1f' : y > p.height - 1.2 ? '#f4f4f6' : (p.color ?? BUILDING.wall)), frame(p))
  out.solid.push(g)
  out.climb.push({ positions: g.attributes.position.array, accept: anySide, density: 0.7, volumes: 0.05 })
}

/** The Tree, a clean first form (#519 makes it a real trunk): back wall, trunk, the two caves' roofs, the leaning headwall. */
function tree(p: PieceOf<'tree'>, out: Parts): void {
  const w = p.width / 2
  const white = p.color ?? BUILDING.wall
  const m = frame(p)
  const parts = [
    paint(box(-w, w, 0, p.caveHeight, -DEFAULT_BACK, 0), white, m),
    paint(box(-p.trunk / 2, p.trunk / 2, 0, p.caveHeight, 0, p.caveDepth), '#8a6a4a', m),
    paint(box(-w, w, p.caveHeight - 0.6, p.caveHeight, 0, p.caveDepth), '#5f9a62', m),
  ]
  const lean = treeHeadLean(p)
  const head = new THREE.Shape([
    new THREE.Vector2(p.caveDepth, p.caveHeight),
    new THREE.Vector2(p.caveDepth + lean, p.height),
    new THREE.Vector2(-DEFAULT_BACK, p.height),
    new THREE.Vector2(-DEFAULT_BACK, p.caveHeight),
  ])
  const bandY = p.height - 2
  parts.push(paint(extrudeAlong(head, p.width), (_x, y) => (y > bandY ? '#3f8f4e' : white), m))
  const accept = facingSide(pieceAxes(p.rot).facing)
  for (const g of parts) {
    out.solid.push(g)
    // The cave roofs' undersides are climbed too.
    out.climb.push({ positions: g.attributes.position.array, accept: (nx, ny, nz) => accept(nx, ny, nz) || ny < -0.7, density: 0.7, volumes: 0.02 })
  }
}

/** The Starr: an 8-point faceted star, yellow and black halves per point, raised to its hub; it leans with the wall's panel. */
function star(p: PieceOf<'star'>, out: Parts): void {
  const yellow = new Soup()
  const black = new Soup()
  const step = Math.PI / p.points
  const at = (r: number, a: number, z = 0): V3 => [r * Math.cos(a), r * Math.sin(a), z]
  const centre: V3 = [0, 0, p.depth]
  const front: V3 = [0, 0, 1]
  for (let k = 0; k < p.points; k++) {
    const a = Math.PI / 2 + 2 * k * step
    yellow.tri(centre, at(p.inner, a - step), at(p.radius, a), front)
    black.tri(centre, at(p.radius, a), at(p.inner, a + step), front)
  }
  const wall = piece<'sport' | 'boulder'>('sport', 'w-starr')
  const lean = wall.profile[1].angle * DEG
  // A hand's width proud of the wall, so its tips never sink into the panel.
  const m = frame(p).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.15)).multiply(new THREE.Matrix4().makeRotationX(lean))
  out.solid.push(
    paint(yellow.geometry(), p.colorA, m),
    paint(black.geometry(), p.colorB, m),
    paint(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 16).rotateX(Math.PI / 2).translate(0, 0, p.depth), '#2a2d30', m),
  )
}

function slab(p: PieceOf<'floor'>, out: Parts): void {
  // A floor at the main floor's level is the terrain itself.
  if (p.base <= 0) return
  const color = p.id === 'floor-glassgym' ? '#2d2f33' : p.id.startsWith('roof') ? BUILDING.ceiling : BUILDING.concrete
  out.solid.push(paint(box(-p.w / 2, p.w / 2, -SLAB, 0, -p.d / 2, p.d / 2), color, frame(p)))
}

/** Mats in ~2.5 m tiles over a black underlay that shows as the seams; rope zones black with a red edge stripe. */
function pad(p: { id: string; x: number; z: number; rot: number; base: number; w: number; d: number; thick: number; color?: string }, out: Parts): void {
  const m = frame(p)
  if (p.id.startsWith('rz-')) {
    const s = 0.25
    out.solid.push(paint(box(-p.w / 2, p.w / 2, 0, 0.1, -p.d / 2, p.d / 2), BUILDING.rail, m))
    out.solid.push(paint(box(-p.w / 2 + s, p.w / 2 - s, 0, 0.15, -p.d / 2 + s, p.d / 2 - s), BUILDING.ropeZone, m))
    return
  }
  if (p.thick < 0.1) {
    out.solid.push(paint(box(-p.w / 2, p.w / 2, 0, 0.08, -p.d / 2, p.d / 2), p.color ?? BUILDING.concrete, m))
    return
  }
  const seam = 0.05
  out.solid.push(paint(box(-p.w / 2, p.w / 2, 0, p.thick - 0.06, -p.d / 2, p.d / 2), BUILDING.seam, m))
  const nx = Math.max(1, Math.round(p.w / 2.5))
  const nz = Math.max(1, Math.round(p.d / 2.5))
  const tw = p.w / nx
  const td = p.d / nz
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = -p.w / 2 + i * tw
      const f = -p.d / 2 + j * td
      out.solid.push(paint(box(a + seam, a + tw - seam, 0, p.thick, f + seam, f + td - seam), p.color ?? BUILDING.pad, m))
    }
  }
}

function prop(p: PieceOf<'prop'>, out: Parts): void {
  const m = frame(p)
  if (p.id.startsWith('p-pitblock')) {
    // Yellow and black padded blocks.
    out.solid.push(paint(box(-p.w / 2, p.w / 2, 0, p.h / 2, -p.d / 2, p.d / 2), '#1d2320', m))
    out.solid.push(paint(box(-p.w / 2, p.w / 2, p.h / 2, p.h, -p.d / 2, p.d / 2), p.color ?? '#f2c230', m))
    return
  }
  out.solid.push(paint(box(-p.w / 2, p.w / 2, 0, p.h, -p.d / 2, p.d / 2), p.color ?? BUILDING.wall, m))
}

/** Window rows: high ones are daylight (lights), the glass gym room is real glass, low ones are the doors. */
function windows(p: PieceOf<'windows'>, out: Parts): void {
  const m = frame(p)
  const spacing = p.length / p.count
  if (p.id === 'win-glassgym') {
    out.glass.push(paint(box(-p.length / 2, p.length / 2, 0, p.h, -0.03, 0.03), BUILDING.glass, m))
    for (let i = 0; i <= p.count; i++) {
      const a = -p.length / 2 + i * spacing
      out.solid.push(paint(box(a - 0.08, a + 0.08, 0, p.h, -0.1, 0.1), BUILDING.steel, m))
    }
    out.solid.push(paint(box(-p.length / 2, p.length / 2, -0.1, 0.1, -0.1, 0.12), BUILDING.steel, m))
    return
  }
  const daylight = p.base >= 10
  for (let i = 0; i < p.count; i++) {
    const c = -p.length / 2 + spacing * (i + 0.5)
    const pane = box(c - p.winW / 2, c + p.winW / 2, 0, p.h, 0.06, 0.12)
    if (daylight) out.light.push(paint(pane, BUILDING.daylight, m))
    else out.solid.push(paint(pane, BUILDING.doorGlass, m))
    out.solid.push(paint(box(c - p.winW / 2 - 0.1, c + p.winW / 2 + 0.1, -0.1, p.h + 0.1, 0.03, 0.09), daylight ? BUILDING.steel : '#1d1d1f', m))
  }
}

/** Auto belay: the device at the top, its webbing down the wall, the black CLIP IN flag on the floor. */
function autobelay(p: PieceOf<'autobelay'>, out: Parts): void {
  const m = frame(p)
  const floor = floorAt(p.x, p.z) - p.base
  out.solid.push(paint(box(-0.25, 0.25, -0.25, 0.25, 0, 0.4), '#2b2d31', m))
  out.solid.push(paint(box(-0.04, 0.04, floor + 1.4, -0.2, 0.18, 0.22), '#3a7bd5', m))
  const flag = new THREE.Shape([new THREE.Vector2(-0.6, 0), new THREE.Vector2(0.6, 0), new THREE.Vector2(0, 1.3)])
  out.solid.push(paint(new THREE.ExtrudeGeometry(flag, { depth: 0.06, bevelEnabled: false }).translate(0, floor, 0.3), '#141416', m))
}

/** The stairs down into the pit, red railings both sides. */
function stairs(p: PieceOf<'stairs'>, out: Parts): void {
  const m = frame(p)
  const bottom = PIT.floorY - p.base
  for (let i = 0; i < p.steps; i++) {
    out.solid.push(paint(box(-p.w / 2, p.w / 2, bottom, -(i + 1) * p.rise, i * p.run, (i + 1) * p.run), '#6d7178', m))
  }
  const run = p.steps * p.run
  const drop = p.steps * p.rise
  const slope = Math.atan2(drop, run)
  const length = Math.hypot(run, drop)
  for (const side of [-1, 1]) {
    const a = side * (p.w / 2 + 0.05)
    const rail = new THREE.BoxGeometry(0.08, 0.08, length).rotateX(slope).translate(a, 1 - drop / 2, run / 2)
    out.solid.push(paint(rail, BUILDING.rail, m))
    for (const f of [0.1, run / 2, run - 0.1]) {
      const y = -(f / run) * drop
      out.solid.push(paint(box(a - 0.04, a + 0.04, y - 0.2, y + 1, f - 0.04, f + 0.04), BUILDING.rail, m))
    }
  }
}

/** The pit's edge on the main floor: a concrete face and a red railing, open at the stairs. */
function pitEdge(out: Parts): void {
  const stairsPiece = piece('stairs', 'stairs-starr')
  const x = PIT.maxX
  out.solid.push(paint(box(x, x + HALL.w / 128, PIT.floorY, 0, PIT.minZ, PIT.maxZ), BUILDING.concrete, IDENTITY))
  const gap = [stairsPiece.z - stairsPiece.w / 2 - 0.1, stairsPiece.z + stairsPiece.w / 2 + 0.1]
  for (const [z0, z1] of [[PIT.minZ + 0.5, gap[0]], [gap[1], PIT.maxZ - 0.5]]) {
    out.solid.push(paint(box(x + 0.1, x + 0.18, 0.98, 1.06, z0, z1), BUILDING.rail, IDENTITY))
    for (let z = z0; z <= z1 + 1e-6; z += (z1 - z0) / Math.ceil((z1 - z0) / 2)) {
      out.solid.push(paint(box(x + 0.1, x + 0.18, 0, 1, z - 0.04, z + 0.04), BUILDING.rail, IDENTITY))
    }
  }
  // The pit's grey mats ("Grey mats", the pit's note).
  pad({ id: 'pad-pit', x: (PIT.minX + PIT.maxX) / 2, z: (PIT.minZ + PIT.maxZ) / 2, rot: 0, base: PIT.floorY, w: PIT.maxX - PIT.minX, d: PIT.maxZ - PIT.minZ, thick: 0.35 }, out)
}

/** An axis-aligned box in blockout x / y / z. */
function hallBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: THREE.ColorRepresentation, out: THREE.BufferGeometry[]): void {
  out.push(paint(box(x0, x1, y0, y1, z0, z1), color, IDENTITY))
}

/** The building: white walls (open to the Training Area and the glass gym room), roof, trusses, ducts, strip lights, maroon steel, murals. */
function building(out: Parts): void {
  const { w: W, d: D, h: H } = HALL
  const t = 0.5
  const low = PIT.floorY
  const training = piece('floor', 'ewsmmqw')
  const tx0 = training.x - training.w / 2
  const tx1 = training.x + training.w / 2
  const tz0 = training.z - training.d / 2
  const glass = piece('windows', 'win-glassgym')
  const gx0 = glass.x - glass.length / 2
  const gx1 = glass.x + glass.length / 2
  const gy0 = glass.base
  const gy1 = glass.base + glass.h
  const wall = BUILDING.wall
  // East wall, open under the Training Area's roof.
  hallBox(-t, tx0, low, H, -t, 0, wall, out.solid)
  hallBox(tx0, tx1, training.base, H, -t, 0, wall, out.solid)
  hallBox(tx1, W + t, low, H, -t, 0, wall, out.solid)
  // The Training Area annex's own walls round its cave.
  hallBox(tx0 - t, tx0, 0, training.base, tz0 - t, 0, wall, out.solid)
  hallBox(tx1, tx1 + t, 0, training.base, tz0 - t, 0, wall, out.solid)
  hallBox(tx0, tx1, 0, training.base, tz0 - t, tz0, wall, out.solid)
  // West wall, open to the glass gym room.
  hallBox(-t, gx0, low, H, D, D + t, wall, out.solid)
  hallBox(gx0, gx1, low, gy0, D, D + t, wall, out.solid)
  hallBox(gx0, gx1, gy1, H, D, D + t, wall, out.solid)
  hallBox(gx1, W + t, low, H, D, D + t, wall, out.solid)
  // The glass gym room behind it: walls, a few machines, its light.
  const room = piece('floor', 'floor-glassgym')
  const rz1 = room.z + room.d / 2
  hallBox(gx0 - t, gx0, gy0, gy1, D, rz1, '#c9ccd0', out.solid)
  hallBox(gx1, gx1 + t, gy0, gy1, D, rz1, '#c9ccd0', out.solid)
  hallBox(gx0, gx1, gy0, gy1, rz1, rz1 + t, '#c9ccd0', out.solid)
  for (const [x, z, w, d, h] of [[59, 46, 2, 0.9, 1.5], [63, 46.5, 2.4, 1, 1.2], [67.5, 44, 1.2, 2.2, 2.2]]) {
    hallBox(x - w / 2, x + w / 2, gy0, gy0 + h, z - d / 2, z + d / 2, '#3a3d42', out.solid)
  }
  hallBox(gx0 + 1, gx1 - 1, room.base + 4 - 0.4, room.base + 4 - 0.3, room.z - 0.2, room.z + 0.2, BUILDING.strip, out.light)
  // North and south end walls, and the roof.
  hallBox(-t, 0, low, H, 0, D, wall, out.solid)
  hallBox(W, W + t, low, H, 0, D, wall, out.solid)
  hallBox(-t, W + t, H, H + t, -t, D + t, BUILDING.ceiling, out.solid)
  // Roof trusses across the hall every 8 m: chords, posts and diagonals.
  const bottom = H - 4.5
  const top = H - 0.6
  for (let x = 4; x < W; x += 8) {
    hallBox(x - 0.15, x + 0.15, bottom, bottom + 0.3, 0, D, BUILDING.steel, out.solid)
    hallBox(x - 0.15, x + 0.15, top - 0.3, top, 0, D, BUILDING.steel, out.solid)
    for (let z = 0; z <= D; z += 5) hallBox(x - 0.08, x + 0.08, bottom, top, z - 0.08, z + 0.08, BUILDING.steel, out.solid)
    for (let z = 0; z < D; z += 5) {
      const rise = top - bottom
      const len = Math.hypot(5, rise)
      const tilt = Math.atan2(rise, 5) * ((z / 5) % 2 === 0 ? 1 : -1)
      out.solid.push(paint(new THREE.BoxGeometry(0.12, 0.12, len).rotateX(-tilt).translate(x, (bottom + top) / 2, z + 2.5), BUILDING.steel, IDENTITY))
    }
  }
  // Maroon steel: columns up the long walls and a ring beam under the roof.
  for (let x = 8; x < W; x += 8) {
    if (x < tx0 || x > tx1) hallBox(x - 0.25, x + 0.25, 0, H, 0, 0.5, BUILDING.beam, out.solid)
    if (x < gx0 || x > gx1) hallBox(x - 0.25, x + 0.25, 0, H, D - 0.5, D, BUILDING.beam, out.solid)
  }
  const ring = H - 5.2
  hallBox(0, W, ring, ring + 0.6, 0, 0.4, BUILDING.beam, out.solid)
  hallBox(0, W, ring, ring + 0.6, D - 0.4, D, BUILDING.beam, out.solid)
  hallBox(0, 0.4, ring, ring + 0.6, 0, D, BUILDING.beam, out.solid)
  hallBox(W - 0.4, W, ring, ring + 0.6, 0, D, BUILDING.beam, out.solid)
  // Silver ducts along the hall, and the long strip lights under the trusses.
  for (const z of [12, 28]) {
    out.solid.push(paint(new THREE.CylinderGeometry(0.6, 0.6, W - 2, 16).rotateZ(Math.PI / 2).translate(W / 2, H - 3, z), BUILDING.duct, IDENTITY))
  }
  for (const z of [5, 15, 25, 35]) hallBox(3, W - 3, bottom - 0.25, bottom - 0.05, z - 0.15, z + 0.15, BUILDING.strip, out.light)
  // Murals: flat colour panels low on the walls (the cubbies' climbing photos, the comp banners, the eagle by the Arch wall).
  const murals: [number, number, number, number, number, number, string][] = [
    [42.2, 46, 2.8, 7.5, 0.02, 0.1, '#2f6db5'],
    [46.2, 50.4, 2.8, 7.5, 0.02, 0.1, '#d9822b'],
    [tx0 + 0.5, training.x - 0.2, training.base + 0.6, training.base + 3, 0.02, 0.1, '#b3262d'],
    [training.x + 0.2, tx1 - 0.5, training.base + 0.6, training.base + 3, 0.02, 0.1, '#2448a8'],
    [W - 0.1, W - 0.02, 3.5, 8, 33.6, 35.6, '#6b4a2e'],
  ]
  for (const [x0, x1, y0, y1, z0, z1, c] of murals) hallBox(x0, x1, y0, y1, z0, z1, c, out.solid)
}

const toWorld = new THREE.Matrix4().makeTranslation((-HALL.w / 2) * GYM_SCALE, 0, (-HALL.d / 2) * GYM_SCALE).multiply(new THREE.Matrix4().makeScale(GYM_SCALE, GYM_SCALE, GYM_SCALE))

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(list)
  list.forEach((part) => part.dispose())
  if (!g) throw new Error('gym: could not merge the hall')
  return g.applyMatrix4(toWorld)
}

const _q = new THREE.Quaternion()
const _r = new THREE.Quaternion()
const _n = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

function instances(surfaces: readonly ClimbSurface[], key: 'density' | 'volumes', seed: number, size: [number, number], colors: readonly string[]): HoldInstances {
  const out: HoldInstances = { matrices: [], colors: [] }
  surfaces.forEach((s, i) => {
    for (const h of scatterOn(s.positions, s.accept, s[key], seed + i * 101)) {
      const r = size[0] + h.pick * (size[1] - size[0])
      _q.setFromUnitVectors(_z, _n.set(h.nx, h.ny, h.nz)).multiply(_r.setFromAxisAngle(_z, h.roll))
      _p.set(h.x, h.y, h.z).applyMatrix4(toWorld)
      out.matrices.push(new THREE.Matrix4().compose(_p, _q, _s.set(r, r * 0.8, r * 0.5).multiplyScalar(GYM_SCALE)))
      out.colors.push(new THREE.Color(colors[Math.floor(((h.pick * 7919) % 1) * colors.length)]))
    }
  })
  return out
}

/** Build the whole hall in world units (call once per level mount; the caller disposes the geometries). */
export function buildHall(): Hall {
  const out: Parts = { solid: [], light: [], glass: [], climb: [] }
  for (const p of PIECES) {
    if (HIDDEN_PIECES.has(p.id)) continue
    switch (p.kind) {
      case 'sport':
      case 'boulder':
        climbingWall(p, out)
        break
      case 'block':
        block(p, out)
        break
      case 'arch':
        arch(p, out)
        break
      case 'tree':
        tree(p, out)
        break
      case 'star':
        star(p, out)
        break
      case 'floor':
        slab(p, out)
        break
      case 'pad':
        pad(p, out)
        break
      case 'prop':
        prop(p, out)
        break
      case 'windows':
        windows(p, out)
        break
      case 'autobelay':
        autobelay(p, out)
        break
      case 'stairs':
        stairs(p, out)
        break
      case 'pit':
        pitEdge(out)
        break
    }
  }
  building(out)
  const holds = instances(out.climb, 'density', 5170, [0.12, 0.3], HOLD_COLORS)
  const volumes = instances(out.climb, 'volumes', 5171, [0.5, 1.1], VOLUME_COLORS)
  return { solid: merge(out.solid), light: merge(out.light), glass: merge(out.glass), holds, volumes }
}
