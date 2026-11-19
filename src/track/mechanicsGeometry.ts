import * as THREE from 'three'
import type { RideMechanic } from '@/types/level'
import type { TrackCurve } from './curves/TrackCurve'
import type { TrackDimensions } from './trackDimensions'
import { buildArcTable, tAtDistance, type ArcTable } from './arcLength'
import { buildTrackGeometry, trackFrame } from './trackGeometry'
import { dropPieceLength } from './mechanics'
import { mergePainted, paintedAt } from '@/levels/environments/shared/paintedParts'

type RGB = [number, number, number]


const STEEL = '#9aa3ad'
const FIN = '#d8893a'
const CONCRETE = '#b9b2a6'
const ROOF = '#3d5a80'
const TURNTABLE = '#3b3f45'
/** The station's length in eye heights, and how much of it lies behind the car's start. */
const STATION_EYES = 9
const STATION_BEHIND = 0.65

const point = new THREE.Vector3()
const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3()
const matrix = new THREE.Matrix4()

/** A box `size` (right, up, forward) centred `offset` from the track's frame at t. */
function frameBox(curve: TrackCurve, t: number, size: [number, number, number], offset: [number, number, number], color: string) {
  trackFrame(curve, t, point, forward, right, up)
  point.addScaledVector(right, offset[0]).addScaledVector(up, offset[1]).addScaledVector(forward, offset[2])
  matrix.makeBasis(right, up, forward).setPosition(point)
  return paintedAt(new THREE.BoxGeometry(...size), color, matrix)
}

function station(curve: TrackCurve, table: ArcTable, m: RideMechanic, dims: TrackDimensions): THREE.BufferGeometry[] {
  const eye = dims.eyeHeight
  const length = eye * STATION_EYES
  const t0 = m.from
  const along = length * (0.5 - STATION_BEHIND)
  const side = dims.railGauge + eye * 0.9
  const deck = dims.spineOffset
  const parts = [
    frameBox(curve, t0, [eye * 1.4, eye * 0.35, length], [side, deck, along], CONCRETE),
    frameBox(curve, t0, [eye * 1.4, eye * 0.35, length], [-side, deck, along], CONCRETE),
    frameBox(curve, t0, [side * 2 + eye * 1.6, eye * 0.2, length * 1.05], [0, eye * 2.4, along], ROOF),
  ]
  for (const z of [-0.45, 0, 0.45]) {
    for (const x of [side + eye * 0.5, -side - eye * 0.5]) parts.push(frameBox(curve, t0, [eye * 0.18, eye * 2.4, eye * 0.18], [x, eye * 1.2, along + z * length], STEEL))
  }
  // Launch fins down the middle, one per tie, from the car's start to the launch's end.
  const fin: [number, number, number] = [dims.railRadius * 0.8, dims.railRadius * 3, dims.tieSpacing * 0.55]
  for (let d = m.from * table.length; d < m.to * table.length; d += dims.tieSpacing) {
    parts.push(frameBox(curve, tAtDistance(table, d), fin, [0, dims.railRadius * 1.5, 0], FIN))
  }
  return parts
}

/** Two guide posts either side of the shaft, from the bottom's rails to above the top's. */
function dropGuides(curve: TrackCurve, m: RideMechanic, dims: TrackDimensions): THREE.BufferGeometry[] {
  const top = curve.getPointAt(m.from).clone()
  const bottom = curve.getPointAt(m.to).clone()
  const heading = curve.getTangentAt(m.from).clone().setY(0).normalize()
  const across = new THREE.Vector3(heading.z, 0, -heading.x)
  const height = top.y - bottom.y + dims.eyeHeight * 2
  const reach = dims.railGauge + dims.eyeHeight * 0.6
  const along = dropPieceLength(dims.eyeHeight) / 2
  const parts: THREE.BufferGeometry[] = []
  for (const s of [1, -1]) {
    for (const f of [1, -1]) {
      const at = top.clone().setY(bottom.y + height / 2).addScaledVector(across, s * reach).addScaledVector(heading, f * along)
      matrix.makeBasis(across, THREE.Object3D.DEFAULT_UP, heading).setPosition(at)
      parts.push(paintedAt(new THREE.BoxGeometry(dims.eyeHeight * 0.2, height, dims.eyeHeight * 0.2), STEEL, matrix))
    }
  }
  return parts
}

/** The mechanics' structures (#699) as one vertex-coloured geometry: station and fins, drop guides, turntables; null if none. */
export function buildMechanicsGeometry(
  curve: TrackCurve,
  table: ArcTable,
  mechanics: readonly RideMechanic[],
  dims: TrackDimensions,
): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  const disc = (t: number) => {
    trackFrame(curve, t, point, forward, right, up)
    point.addScaledVector(up, dims.spineOffset - dims.eyeHeight * 0.1)
    matrix.makeBasis(right, up, forward).setPosition(point)
    parts.push(paintedAt(new THREE.CylinderGeometry(dims.eyeHeight * 1.4, dims.eyeHeight * 1.4, dims.eyeHeight * 0.15, 24), TURNTABLE, matrix))
  }
  for (const m of mechanics) {
    if (m.kind === 'station') parts.push(...station(curve, table, m, dims))
    else if (m.kind === 'dropTrack') parts.push(...dropGuides(curve, m, dims))
    else if (m.kind === 'backwards') {
      disc(m.from)
      disc(m.to)
    }
  }
  return parts.length ? mergePainted(parts) : null
}

/** A straight run of track `length` long along +z, centred on the origin. */
function straightCurve(length: number): TrackCurve {
  const p = new THREE.Vector3()
  const tangent = new THREE.Vector3(0, 0, 1)
  return {
    getPointAt: (t) => p.set(0, 0, (t - 0.5) * length),
    getTangentAt: () => tangent,
  }
}

/** The drop track's piece: rails and ties along +z, centred on the car (`mechanics.hot.ts` `dropPiecePosition`). */
export function buildDropPieceGeometry(dims: TrackDimensions, color1: RGB, color2: RGB): THREE.BufferGeometry {
  const curve = straightCurve(dropPieceLength(dims.eyeHeight))
  return buildTrackGeometry(curve, buildArcTable(curve, 64), dims, 8, color1, color2)
}
