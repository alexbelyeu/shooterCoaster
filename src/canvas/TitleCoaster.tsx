import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildTrackGeometry, trackFrame } from '@/track/trackGeometry'
import { RAIL_PIXEL_FLOOR, getTrackDimensions } from '@/track/trackDimensions'
import { trackViewportHeight, withMinThickness } from '@/track/minThickness'
import { tAtLoopDistance } from '@/track/arcLength'
import { mergePainted, painted } from '@/levels/environments/shared/paintedParts'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { CAR_SPACING, CARS, TITLE_TRACK_SCALAR, type TitleRide } from './titleCoaster'

/** The title's coaster in three draw calls; few rings, wide-set ties and plain columns keep it inside budgets.json `scene.title`. */

const DIMS = { ...getTrackDimensions({ scalar: TITLE_TRACK_SCALAR }), tieSpacing: 22 }
/** Rings along the rails: ~11 units apart on the ~1000-unit loop, smooth at the title's distances. */
const SEGMENTS = 90

export interface CoasterLivery {
  rail: [number, number, number]
  spine: [number, number, number]
  body: string
  seat: string
}

const HERO_LIVERY: CoasterLivery = { rail: [1, 1, 1], spine: [1, 0.85, 0], body: '#e2302a', seat: '#b81f1a' }
const COLUMN_SPACING = 34

/** Live clock shared by the title's camera and ride; the camera advances it (`TitleScene`). */
export interface TitleClock {
  /** Seconds since the title appeared (held under e2e `titleTime`). */
  scene: number
}

function buildCarGeometry({ body, seat }: CoasterLivery): THREE.BufferGeometry {
  const s = DIMS.trackScale
  const parts = [
    painted(new THREE.BoxGeometry(3.6 * s, 0.6 * s, 4.4 * s), '#2a2a30', [0, 0.45 * s, 0]),
    painted(new THREE.BoxGeometry(3.4 * s, 1.3 * s, 5 * s), body, [0, 1.4 * s, 0]),
    painted(new THREE.BoxGeometry(3.5 * s, 0.25 * s, 5.05 * s), '#ffd23f', [0, 2.1 * s, 0]),
    painted(new THREE.BoxGeometry(3 * s, 1.1 * s, 0.35 * s), seat, [0, 2.6 * s, -0.2 * s]),
    painted(new THREE.BoxGeometry(3 * s, 1.1 * s, 0.35 * s), seat, [0, 2.6 * s, -2.3 * s]),
  ]
  const heads = ['#f0c8a0', '#8a5a3c', '#e8b48a', '#c68e5e']
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 === 0 ? -0.75 : 0.75) * s
    const z = (i < 2 ? 0.5 : -1.6) * s
    parts.push(painted(new THREE.IcosahedronGeometry(0.5 * s, 0), heads[i], [x, 2.75 * s, z]))
  }
  return mergePainted(parts)
}

const _p = new THREE.Vector3()
const _f = new THREE.Vector3()
const _r = new THREE.Vector3()
const _u = new THREE.Vector3()
const _m = new THREE.Matrix4()

export default function TitleCoaster({
  ride,
  clock,
  livery = HERO_LIVERY,
  name = 'title',
  keepColumn,
}: {
  ride: TitleRide
  clock: TitleClock
  livery?: CoasterLivery
  name?: string
  /** False where a column must not stand (under the other coaster's crossing). */
  keepColumn?: (x: number, z: number) => boolean
}) {
  const { curve, table } = ride
  const track = useMemo(() => buildTrackGeometry(curve, table, DIMS, SEGMENTS, livery.rail, livery.spine), [curve, table, livery])
  const trackMaterial = useMemo(
    () => withMinThickness(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 }), RAIL_PIXEL_FLOOR),
    [],
  )
  const column = useMemo(() => new THREE.CylinderGeometry(0.7 * DIMS.trackScale, 1 * DIMS.trackScale, 1, 6, 1, true).translate(0, 0.5, 0), [])
  const columnMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.6, metalness: 0.2 }), [])
  const car = useMemo(() => buildCarGeometry(livery), [livery])
  const carMaterial = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.15 }), [])
  useEffect(
    () => () => {
      for (const d of [track, trackMaterial, column, columnMaterial, car, carMaterial]) d.dispose()
    },
    [track, trackMaterial, column, columnMaterial, car, carMaterial],
  )

  const viewportHeight = useThree((s) => s.size.height * s.viewport.dpr)
  useEffect(() => {
    trackViewportHeight.value = Math.max(1, viewportHeight)
  }, [viewportHeight])

  const columns = useMemo(() => {
    const out: THREE.Matrix4[] = []
    for (let i = 0; i < Math.floor(table.length / COLUMN_SPACING); i++) {
      _p.copy(curve.getPointAt(tAtLoopDistance(table, (i + 0.5) * COLUMN_SPACING)))
      if (keepColumn && !keepColumn(_p.x, _p.z)) continue
      out.push(new THREE.Matrix4().makeScale(1, _p.y + DIMS.spineOffset, 1).setPosition(_p.setY(0)))
    }
    return out
  }, [curve, table, keepColumn])

  const carsRef = useRef<THREE.InstancedMesh>(null)
  useFrame(() => {
    const mesh = carsRef.current
    if (!mesh) return
    const lead = ride.leadDistance(clock.scene)
    for (let i = 0; i < CARS; i++) {
      trackFrame(curve, tAtLoopDistance(table, lead - i * CAR_SPACING), _p, _f, _r, _u)
      // The car's +z runs down the track (right × up = forward: a rotation, no mirror).
      _m.makeBasis(_r, _u, _f).setPosition(_p)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <mesh name={`${name}-track`} geometry={track} material={trackMaterial} />
      <StaticInstances matrices={columns} geometry={column} material={columnMaterial} />
      <instancedMesh ref={carsRef} name={`${name}-train`} args={[car, carMaterial, CARS]} frustumCulled={false} />
    </>
  )
}
