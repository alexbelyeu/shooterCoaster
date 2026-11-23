import * as THREE from 'three'
import type { ArcTable } from '@/track/arcLength'
import { distanceAtT } from '@/track/arcLength'
import type { DarkSectionSpec } from '@/types/level'
import type { HeightFunction } from '@/utils/terrainNoise'
import { trackFrameAt } from '../../shared/trackClearance'

/** Level 4's ice cave (#866), pure: a faceted vault over the ice dark section, wide enough that the trackside snowmen stand inside it. */
export const ICE_CAVE = {
  /** Half the vault's width at the ground, either side of the track. */
  halfWidth: 340,
  /** The vault's crown over the rails inside the cave. */
  vault: 170,
  /** The mouth's lip over the rails (level 4's eye is ~8 over them); it rises to `vault` over `mouth` units of track. */
  lip: 21,
  mouth: 140,
  /** The ice's thickness, and how far its feet sink into the ground. */
  wall: 30,
  sink: 15,
  /** Units of track between sections, and facets across the arch. */
  step: 30,
  facets: 22,
} as const

const VEIN = new THREE.Color(0.25, 0.62, 1.0)
const ICE = new THREE.Color(0.5, 0.74, 0.92)
const DEEP_ICE = new THREE.Color(0.28, 0.5, 0.78)
const SNOW = new THREE.Color(0.92, 0.95, 1.0)

/** The vault's crown over the rails `u` units into the cave: the lip at the mouth, easing up to the vault. */
export function iceCaveCrown(u: number): number {
  const k = Math.min(Math.max(u / ICE_CAVE.mouth, 0), 1)
  return ICE_CAVE.lip + (ICE_CAVE.vault - ICE_CAVE.lip) * k * k * (3 - 2 * k)
}

/** The cave's span on the arc table: its dark section's, in arc distance. */
export function iceCaveSpan(table: ArcTable, section: DarkSectionSpec): { fromS: number; toS: number } {
  return { fromS: distanceAtT(table, section.from), toS: distanceAtT(table, section.to) }
}

/** A smooth, cheap wobble in [-1, 1] for the ice's facets. */
const wobble = (a: number, b: number) => Math.sin(a * 1.7 + Math.sin(b * 2.3)) * Math.cos(b * 1.3 + a * 0.6)

/** The vault as one non-indexed (flat-faceted) geometry with `aEmissive` veins on its inner shell. Caller disposes. */
export function buildIceCaveGeometry(table: ArcTable, span: { fromS: number; toS: number }, groundFn: HeightFunction): THREE.BufferGeometry {
  const { halfWidth, wall, sink, facets } = ICE_CAVE
  const sections = Math.max(2, Math.ceil((span.toS - span.fromS) / ICE_CAVE.step))
  // ring[layer][k][j]: the arch's vertices, inner (0) and outer (1).
  const ring: THREE.Vector3[][][] = [[], []]
  const glow: number[][] = []
  for (let k = 0; k <= sections; k++) {
    const s = span.fromS + ((span.toS - span.fromS) * k) / sections
    const f = trackFrameAt(table, s)
    const crown = iceCaveCrown(s - span.fromS)
    glow.push([])
    for (let layer = 0; layer < 2; layer++) {
      const row: THREE.Vector3[] = []
      for (let j = 0; j <= facets; j++) {
        const a = (Math.PI * j) / facets
        const rough = j === 0 || j === facets ? 0 : wobble(s * 0.02, j)
        const lateral = Math.cos(a) * (halfWidth + layer * wall) + rough * 10
        const x = f.x + f.tz * lateral
        const z = f.z - f.tx * lateral
        const foot = groundFn(x, z) - sink
        const top = f.y + crown + layer * wall + rough * 0.06 * crown
        row.push(new THREE.Vector3(x, foot + (top - foot) * Math.sqrt(Math.sin(a)), z))
        if (layer === 0) glow[k].push(Math.max(0, Math.sin(s * 0.03 + 3 * Math.sin(j * 0.9))) ** 6)
      }
      ring[layer].push(row)
    }
  }

  const positions: number[] = []
  const colours: number[] = []
  const emissive: number[] = []
  const tri = (p: THREE.Vector3[], c: THREE.Color, e: number[]) => {
    for (let i = 0; i < 3; i++) {
      positions.push(p[i].x, p[i].y, p[i].z)
      colours.push(c.r, c.g, c.b)
      emissive.push(VEIN.r * e[i], VEIN.g * e[i], VEIN.b * e[i])
    }
  }
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, colour: THREE.Color, e = [0, 0, 0, 0]) => {
    tri([a, b, c], colour, [e[0], e[1], e[2]])
    tri([a, c, d], colour, [e[0], e[2], e[3]])
  }
  const shade = new THREE.Color()
  for (let k = 0; k < sections; k++) {
    for (let j = 0; j < facets; j++) {
      const [i0, i1] = [ring[0][k], ring[0][k + 1]]
      const height = Math.sin((Math.PI * (j + 0.5)) / facets)
      shade.copy(DEEP_ICE).lerp(ICE, height * (0.75 + 0.25 * wobble(k, j)))
      quad(i0[j], i1[j], i1[j + 1], i0[j + 1], shade, [glow[k][j], glow[k + 1][j], glow[k + 1][j + 1], glow[k][j + 1]])
      const [o0, o1] = [ring[1][k], ring[1][k + 1]]
      shade.copy(ICE).lerp(SNOW, 0.4 + 0.6 * height)
      quad(o0[j], o0[j + 1], o1[j + 1], o1[j], shade)
    }
  }
  // The ends: a band of ice from the inner shell to the outer one.
  for (const k of [0, sections]) {
    for (let j = 0; j < facets; j++) quad(ring[0][k][j], ring[0][k][j + 1], ring[1][k][j + 1], ring[1][k][j], SNOW)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
  geometry.setAttribute('aEmissive', new THREE.Float32BufferAttribute(emissive, 3))
  geometry.computeVertexNormals()
  return geometry
}
