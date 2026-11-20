import * as THREE from 'three'
import { GeometryWriter, buildRingedRock } from '../../shared/ringedRock'
import { KELP_HEIGHT, ROCK_CAP_RISE, ROCK_RINGS, STACK_CAP_RISE, STACK_RINGS } from './seaDimensions'

/** Ocean prop geometry with heights baked in: instances only get a uniform scale + yaw. */

const c = (hex: number) => new THREE.Color(hex)

export function createSeaStackGeometry(): THREE.BufferGeometry {
  const lower = c(0x6c665c)
  const ledge = c(0x7d8a52) // weathered moss on the ledges
  const mid = c(0x8f8471)
  const upper = c(0xa39680)
  return buildRingedRock(
    STACK_RINGS,
    8,
    0.1,
    232,
    [lower, ledge, mid, ledge, upper, ledge, upper],
    c(0x6f9a44),
    STACK_CAP_RISE,
  )
}

export function createBreachingRockGeometry(): THREE.BufferGeometry {
  return buildRingedRock(
    ROCK_RINGS,
    7,
    0.14,
    56,
    [c(0x3f4a49), c(0x56605a), c(0x6e6d62)],
    c(0x8b897c),
    ROCK_CAP_RISE,
  )
}

/** A brain-coral dome, a fan of branching coral and a few tube sponges. */
export function createCoralClusterGeometry(): THREE.BufferGeometry {
  const parts: { geo: THREE.BufferGeometry; color: THREE.Color }[] = []
  const brain = new THREE.IcosahedronGeometry(6, 0)
  brain.scale(1, 0.6, 1)
  brain.translate(-3, 1.5, 2)
  parts.push({ geo: brain, color: c(0xff7a1f) })

  for (let i = 0; i < 5; i++) {
    const h = 11 + (i % 3) * 2.5
    const branch = new THREE.ConeGeometry(1.5, h, 5, 1, true)
    branch.translate(0, h / 2, 0)
    branch.rotateZ(0.25 + (i % 2) * 0.25)
    branch.rotateY((i / 5) * Math.PI * 2)
    branch.translate(5, 0, -3)
    parts.push({ geo: branch, color: c(0xff3b4e) })
  }

  for (let i = 0; i < 3; i++) {
    const h = 7 + i * 2
    const tube = new THREE.CylinderGeometry(1.8, 2.3, h, 5, 1, true)
    tube.translate(-6 + i * 3.2, h / 2, -6 + (i % 2) * 2.5)
    parts.push({ geo: tube, color: c(0xffc21f) })
  }

  const w = new GeometryWriter()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const cc = new THREE.Vector3()
  for (const { geo, color } of parts) {
    const flat = geo.index ? geo.toNonIndexed() : geo
    const p = flat.attributes.position
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i)
      b.fromBufferAttribute(p, i + 1)
      cc.fromBufferAttribute(p, i + 2)
      w.tri(a, b, cc, color)
    }
    if (flat !== geo) flat.dispose()
    geo.dispose()
  }
  return w.build()
}

/** Three twisting blades; `aSway` runs 0 at the root to 1 at the tallest tip. */
export function createKelpClumpGeometry(): THREE.BufferGeometry {
  const rows = 5
  const base = c(0x4f6e1e)
  const tip = c(0xd2df4e)
  const color = new THREE.Color()
  const w = new GeometryWriter()
  const blades = [
    { x: 0, z: 0, h: KELP_HEIGHT, twist: 1.2, yaw: 0 },
    { x: 3, z: 2, h: KELP_HEIGHT * 0.8, twist: -1.0, yaw: 2.1 },
    { x: -2.5, z: 2.5, h: KELP_HEIGHT * 0.65, twist: 0.9, yaw: 4.2 },
  ]
  for (const blade of blades) {
    const row = (k: number): [THREE.Vector3, THREE.Vector3] => {
      const t = k / rows
      const half = 1.6 * Math.sin(Math.PI * (0.15 + t * 0.7)) + 0.3
      const a = blade.yaw + blade.twist * t
      const lean = t * t * 3
      const cx = blade.x + Math.cos(blade.yaw) * lean
      const cz = blade.z + Math.sin(blade.yaw) * lean
      const y = t * blade.h
      return [
        new THREE.Vector3(cx - Math.cos(a) * half, y, cz - Math.sin(a) * half),
        new THREE.Vector3(cx + Math.cos(a) * half, y, cz + Math.sin(a) * half),
      ]
    }
    for (let k = 0; k < rows; k++) {
      const [l0, r0] = row(k)
      const [l1, r1] = row(k + 1)
      const t0 = (k / rows) * (blade.h / KELP_HEIGHT)
      const t1 = ((k + 1) / rows) * (blade.h / KELP_HEIGHT)
      color.copy(base).lerp(tip, (t0 + t1) / 2)
      w.tri(l0, l1, r0, color, [t0, t1, t0])
      w.tri(r0, l1, r1, color, [t0, t1, t1])
    }
  }
  return w.build('aSway')
}

/** Nose along +z; `aFlap` runs 0 at the shoulder to 1 at the wing tip. */
export function createGullGeometry(): THREE.BufferGeometry {
  const white = c(0xf4f6f8)
  const grey = c(0xc4ccd4)
  const black = c(0x26292c)
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const w = new GeometryWriter()

  const nose = v(0, 0, 6)
  const tail = v(0, 0.4, -6)
  const top = v(0, 1.2, 0)
  const belly = v(0, -1, 0)
  const left = v(-1.3, 0, 0)
  const right = v(1.3, 0, 0)
  for (const [a, b] of [[left, top], [top, right], [right, belly], [belly, left]] as const) {
    w.tri(nose, a, b, white, [0, 0, 0])
    w.tri(tail, b, a, white, [0, 0, 0])
  }

  for (const s of [-1, 1]) {
    const front = v(s * 1, 0.3, 2.2)
    const back = v(s * 1, 0.3, -1.6)
    const elbowFront = v(s * 9, 1.6, 1.2)
    const elbowBack = v(s * 9, 1.6, -2)
    const wingTip = v(s * 18, -0.4, -3.5)
    w.tri(front, elbowFront, back, grey, [0, 0.5, 0])
    w.tri(back, elbowFront, elbowBack, grey, [0, 0.5, 0.5])
    w.tri(elbowFront, wingTip, elbowBack, black, [0.5, 1, 0.5])
  }
  return w.build('aFlap')
}

/** z (nose +), half width, half height, centre height of each body ring, in whale lengths, nose to tail. */
const WHALE_RINGS: readonly (readonly [number, number, number, number])[] = [
  [0.46, 0.045, 0.04, -0.005],
  [0.38, 0.085, 0.07, 0],
  [0.26, 0.115, 0.095, 0.005],
  [0.1, 0.125, 0.105, 0.01],
  [-0.06, 0.11, 0.095, 0.015],
  [-0.2, 0.075, 0.07, 0.015],
  [-0.32, 0.04, 0.05, 0.01],
  [-0.41, 0.02, 0.035, 0.005],
]
const WHALE_SIDES = 10

/** A humpback `length` long, centred on its middle, nose along +z: dark back, grooved pale belly, long white flippers. */
export function createWhaleGeometry(length: number): THREE.BufferGeometry {
  const back = c(0x1f3550)
  const flank = c(0x35546e)
  const belly = c(0xd9e6e8)
  const pleat = c(0x9fb5bd)
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x * length, y * length, z * length)
  const w = new GeometryWriter()

  const rings = WHALE_RINGS.map(([z, hw, hh, cy]) =>
    Array.from({ length: WHALE_SIDES }, (_, k) => {
      const a = Math.PI / 2 + (2 * Math.PI * k) / WHALE_SIDES
      return v(Math.cos(a) * hw, cy + Math.sin(a) * hh, z)
    }),
  )
  const skin = (k: number, grooved: boolean) => {
    const up = Math.sin(Math.PI / 2 + (2 * Math.PI * (k + 0.5)) / WHALE_SIDES)
    if (up > 0.45) return back
    if (up > -0.35) return flank
    return grooved && k % 2 === 0 ? pleat : belly
  }
  for (let i = 0; i + 1 < rings.length; i++) {
    const grooved = WHALE_RINGS[i][0] > 0
    for (let k = 0; k < WHALE_SIDES; k++) {
      const k1 = (k + 1) % WHALE_SIDES
      const col = skin(k, grooved)
      w.tri(rings[i][k], rings[i + 1][k], rings[i][k1], col)
      w.tri(rings[i][k1], rings[i + 1][k], rings[i + 1][k1], col)
    }
  }
  const nose = v(0, -0.01, 0.5)
  const tail = v(0, 0.005, -0.45)
  const last = rings[rings.length - 1]
  for (let k = 0; k < WHALE_SIDES; k++) {
    const k1 = (k + 1) % WHALE_SIDES
    w.tri(nose, rings[0][k], rings[0][k1], skin(k, true))
    w.tri(tail, last[k1], last[k], skin(k, false))
  }

  /** A flat fin: `top` on the face that looks up, `under` on the other. */
  const fin = (a: THREE.Vector3, b: THREE.Vector3, cc: THREE.Vector3, top: THREE.Color, under: THREE.Color) => {
    const ny = (b.z - a.z) * (cc.x - a.x) - (b.x - a.x) * (cc.z - a.z)
    const [p, q] = ny >= 0 ? [b, cc] : [cc, b]
    w.tri(a, p, q, top)
    w.tri(a, q, p, under)
  }
  for (const s of [-1, 1]) {
    // Pectoral flippers, a third of the body long, swept back.
    const rootFront = v(s * 0.1, -0.03, 0.2)
    const rootBack = v(s * 0.1, -0.03, 0.12)
    const midFront = v(s * 0.22, -0.065, 0.13)
    const midBack = v(s * 0.2, -0.065, 0.06)
    const tip = v(s * 0.36, -0.1, -0.02)
    fin(rootFront, midFront, rootBack, flank, belly)
    fin(rootBack, midFront, midBack, flank, belly)
    fin(midFront, tip, midBack, belly, belly)
    // Flukes.
    const root = v(0, 0.005, -0.42)
    const lead = v(s * 0.08, 0.008, -0.45)
    const flukeTip = v(s * 0.2, 0.012, -0.54)
    const notch = v(0, 0.005, -0.5)
    fin(root, lead, notch, back, belly)
    fin(lead, flukeTip, notch, back, belly)
  }
  // A small dorsal hump, seen from both sides.
  const dorsal = [v(0, 0.082, -0.17), v(0, 0.075, -0.27), v(0, 0.12, -0.25)] as const
  w.tri(dorsal[0], dorsal[1], dorsal[2], back)
  w.tri(dorsal[0], dorsal[2], dorsal[1], back)
  return w.build()
}
