import * as THREE from 'three'
import { mergePainted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { NEON_RGB, withNeon } from './cityNeon'
import { DECK, deckHeightAt, PYLON, routeDirection, routeLength, type HighwayRoute, type Pylon } from './highwayLayout'

/** Length of one deck piece: the ramps bend over a few of them. */
const SEGMENT = 40
/**
 * How far below the street a ramp's foot ends: the road sinks into the street by this at each end, fading to nothing at
 * full height, so it meets the street at ~11° rather than grazing it (no z-fighting at distance).
 */
const SINK = 4
const ROAD = 0x24232b
const CONCRETE = 0x6c6a78
const UNDERSIDE = 0x45434f
/** Fascia strips: magenta down one side, cyan down the other, an amber lamp on the parapets every few pieces. */
const FASCIA = { h: 1.4, d: 0.6, drop: 2.2 } as const
const LAMP = { size: 2.4, every: 2 } as const

export interface HighwayGeometry {
  /** Deck, parapets and pylons: lit concrete. */
  structure: THREE.BufferGeometry
  /** The neon strips and lamps, for `createNeonMaterial` (steady). */
  neon: THREE.BufferGeometry
}

/** A box `w` × `h` × `d` moved by `offset` in its piece's frame, steady neon. */
function neonBox(w: number, h: number, d: number, offset: [number, number, number], color: number, matrix: THREE.Matrix4): THREE.BufferGeometry {
  return paintedAt(withNeon(new THREE.BoxGeometry(w, h, d).toNonIndexed().translate(offset[0], offset[1], offset[2]), 'steady'), color, matrix)
}

/** The highway in world space over a street at `groundY`, as two merged geometries (two draw calls). Caller disposes. */
export function highwayGeometry(route: HighwayRoute, pylons: readonly Pylon[], groundY: number): HighwayGeometry {
  const { dx, dz } = routeDirection(route)
  const yaw = Math.atan2(-dz, dx)
  const length = routeLength(route)
  const pieces = Math.ceil(length / SEGMENT)
  const step = length / pieces
  const half = DECK.width / 2
  // The road's height over the street where the layout puts it at `h`: sunk by `SINK` at the feet, exact at full height
  const road = (h: number) => h - SINK * (1 - h / route.deck)
  const structure: THREE.BufferGeometry[] = []
  const neon: THREE.BufferGeometry[] = []
  for (let k = 0; k < pieces; k++) {
    const y0 = road(deckHeightAt(route, k * step))
    const y1 = road(deckHeightAt(route, (k + 1) * step))
    const u = (k + 0.5) * step
    // Local x runs along the road, y up, z across; a little overlap closes the joints where the ramps bend
    const m = pose([route.from.x + dx * u, groundY + (y0 + y1) / 2, route.from.z + dz * u], [0, yaw, Math.atan2(y1 - y0, step)])
    const len = step + 0.6
    const slab = new THREE.BoxGeometry(len, DECK.thickness, DECK.width).translate(0, -DECK.thickness / 2, 0)
    structure.push(paintedAt(slab, (_x, y) => (y > -0.1 ? ROAD : UNDERSIDE), m))
    for (const side of [-1, 1]) {
      const z = side * (half - DECK.wall / 2)
      structure.push(paintedAt(new THREE.BoxGeometry(len, DECK.parapet, DECK.wall).translate(0, DECK.parapet / 2, z), CONCRETE, m))
      neon.push(neonBox(len, FASCIA.h, FASCIA.d, [0, -FASCIA.drop, side * (half + FASCIA.d / 2)], side < 0 ? NEON_RGB.magenta : NEON_RGB.cyan, m))
      if (k % LAMP.every === 0) neon.push(neonBox(LAMP.size, LAMP.size / 2, LAMP.size, [0, DECK.parapet + LAMP.size / 4, z], NEON_RGB.amber, m))
    }
  }
  for (const p of pylons) {
    // The cap reaches a unit into the slab above it
    const top = groundY + road(p.deck) - DECK.thickness + 1
    const column = top - PYLON.cap - groundY
    structure.push(paintedAt(new THREE.BoxGeometry(PYLON.size, column, PYLON.size), CONCRETE, pose([p.x, groundY + column / 2, p.z], [0, yaw, 0])))
    structure.push(paintedAt(new THREE.BoxGeometry(PYLON.size + 2, PYLON.cap, DECK.width - 6), UNDERSIDE, pose([p.x, top - PYLON.cap / 2, p.z], [0, yaw, 0])))
  }
  return { structure: mergePainted(structure), neon: mergePainted(neon) }
}

/** Matte concrete under the vertex colours. Caller disposes. */
export function createHighwayMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 })
}
