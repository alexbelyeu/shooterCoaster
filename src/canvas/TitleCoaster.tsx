import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildTrackGeometry, trackFrame } from '@/track/trackGeometry'
import { RAIL_MIN_PIXEL_RADIUS, getTrackDimensions } from '@/track/trackDimensions'
import { trackViewportHeight, withMinThickness } from '@/track/minThickness'
import { tAtLoopDistance } from '@/track/arcLength'
import { mergePainted, painted } from '@/levels/environments/shared/paintedParts'
import { CAR_SPACING, CARS, TITLE_TRACK_SCALAR, type TitleRide } from './titleCoaster'

/**
 * The title park's coaster (#419): the game's own rails (`buildTrackGeometry`) on a light loop, single steel columns
 * and a four-car train, three draw calls in all. Kept light for budgets.json `scene.title`: few rings, wide-set ties.
 */

const DIMS = { ...getTrackDimensions({ scalar: TITLE_TRACK_SCALAR }), tieSpacing: 22 }
/** Rings along the rails: ~11 units apart on the ~1000-unit loop, smooth at the title's distances. */
const SEGMENTS = 90
const RAIL_COLOR: [number, number, number] = [1, 1, 1]
const SPINE_COLOR: [number, number, number] = [1, 0.85, 0]
const COLUMN_SPACING = 34

/** Live clock shared by the title's camera and ride; the camera advances it (`TitleScene`). */
export interface TitleClock {
  /** Seconds since the title appeared (held under e2e `titleTime`). */
  scene: number
}

function buildCarGeometry(): THREE.BufferGeometry {
  const s = DIMS.trackScale
  const parts = [
    painted(new THREE.BoxGeometry(3.6 * s, 0.6 * s, 4.4 * s), '#2a2a30', [0, 0.45 * s, 0]),
    painted(new THREE.BoxGeometry(3.4 * s, 1.3 * s, 5 * s), '#e2302a', [0, 1.4 * s, 0]),
    painted(new THREE.BoxGeometry(3.5 * s, 0.25 * s, 5.05 * s), '#ffd23f', [0, 2.1 * s, 0]),
    painted(new THREE.BoxGeometry(3 * s, 1.1 * s, 0.35 * s), '#b81f1a', [0, 2.6 * s, -0.2 * s]),
    painted(new THREE.BoxGeometry(3 * s, 1.1 * s, 0.35 * s), '#b81f1a', [0, 2.6 * s, -2.3 * s]),
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

export default function TitleCoaster({ ride, clock }: { ride: TitleRide; clock: TitleClock }) {
  const { curve, table } = ride
  const track = useMemo(() => buildTrackGeometry(curve, table, DIMS, SEGMENTS, RAIL_COLOR, SPINE_COLOR), [curve, table])
  const trackMaterial = useMemo(
    () => withMinThickness(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 }), RAIL_MIN_PIXEL_RADIUS),
    [],
  )
  const column = useMemo(() => new THREE.CylinderGeometry(0.7 * DIMS.trackScale, 1 * DIMS.trackScale, 1, 6, 1, true).translate(0, 0.5, 0), [])
  const columnMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.6, metalness: 0.2 }), [])
  const car = useMemo(buildCarGeometry, [])
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

  const columnCount = Math.floor(table.length / COLUMN_SPACING)
  const columnsRef = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = columnsRef.current
    if (!mesh) return
    for (let i = 0; i < columnCount; i++) {
      _p.copy(curve.getPointAt(tAtLoopDistance(table, (i + 0.5) * COLUMN_SPACING)))
      _m.makeScale(1, _p.y + DIMS.spineOffset, 1).setPosition(_p.setY(0))
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [curve, table, columnCount])

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
      <mesh name="title-track" geometry={track} material={trackMaterial} />
      <instancedMesh ref={columnsRef} name="title-track-columns" args={[column, columnMaterial, columnCount]} />
      <instancedMesh ref={carsRef} name="title-train" args={[car, carMaterial, CARS]} frustumCulled={false} />
    </>
  )
}
