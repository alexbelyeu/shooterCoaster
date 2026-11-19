import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { RideMechanic } from '@/types/level'
import type { TrackCurve } from './curves/TrackCurve'
import type { ArcTable } from './arcLength'
import type { TrackDimensions } from './trackDimensions'
import { buildDropPieceGeometry, buildMechanicsGeometry } from './mechanicsGeometry'
import { dropHeading, dropPiecePosition } from './mechanics.hot'
import { dropPieceLength } from './mechanics'
import { rideProgress } from './rideProgress.hot'

type RGB = [number, number, number]

interface RideMechanicsProps {
  curve: TrackCurve
  table: ArcTable
  mechanics: readonly RideMechanic[]
  dims: TrackDimensions
  color1: RGB
  color2: RGB
  /** The rails' own material: the drop track's piece is a run of the same track. */
  trackMaterial: THREE.Material
}

/** One drop track's piece, riding down with the car (`dropPiecePosition`). */
function DropPiece({ curve, table, drop, geometry, material, dims }: {
  curve: TrackCurve
  table: ArcTable
  drop: RideMechanic
  geometry: THREE.BufferGeometry
  material: THREE.Material
  dims: TrackDimensions
}) {
  const ref = useRef<THREE.Mesh>(null)
  const pieceShare = dropPieceLength(dims.eyeHeight) / 2 / table.length
  const rotation = useMemo(() => {
    const heading = dropHeading(curve, drop, new THREE.Vector3())
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), heading)
  }, [curve, drop])
  useFrame(() => {
    const mesh = ref.current
    if (mesh) dropPiecePosition(curve, drop, rideProgress(), pieceShare, mesh.position)
  })
  return <mesh ref={ref} name="drop-piece" geometry={geometry} material={material} quaternion={rotation} />
}

/** The track's special mechanics (#699): the station and its fins, the drop tracks' guides and pieces, the turntables. */
export default function RideMechanics({ curve, table, mechanics, dims, color1, color2, trackMaterial }: RideMechanicsProps) {
  const structures = useMemo(() => buildMechanicsGeometry(curve, table, mechanics, dims), [curve, table, mechanics, dims])
  const structureMaterial = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), [])
  const drops = mechanics.filter((m) => m.kind === 'dropTrack')
  const piece = useMemo(() => (drops.length ? buildDropPieceGeometry(dims, color1, color2) : null), [drops.length, dims, color1, color2])
  useEffect(() => () => structures?.dispose(), [structures])
  useEffect(() => () => structureMaterial.dispose(), [structureMaterial])
  useEffect(() => () => piece?.dispose(), [piece])
  return (
    <>
      {structures ? <mesh name="ride-mechanics" geometry={structures} material={structureMaterial} /> : null}
      {piece
        ? drops.map((drop, i) => (
          <DropPiece key={i} curve={curve} table={table} drop={drop} geometry={piece} material={trackMaterial} dims={dims} />
        ))
        : null}
    </>
  )
}
