import { useMemo, useContext, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import type { HeightFunction } from '@/utils/terrainNoise'
import { type TrackDimensions, getTrackDimensions } from './trackDimensions'
import { type ArcTable, buildArcTable } from './arcLength'
import { buildTrackGeometry } from './trackGeometry'
import {
  type TowerPlan,
  type TowerInstance,
  buildFootingGeometry,
  buildTowerGeometry,
  getTowerDims,
  planTowers,
  towerShadowCasters,
} from './supportTowers'
import { useContactShadows } from '@/levels/environments/shared/ContactShadows'

interface TrackMeshProps {
  curve: TrackCurve
  segments?: number
  color1?: [number, number, number]
  color2?: [number, number, number]
  /** TrackParams.glow */
  glow?: number
  /** Structural dimensions; defaults to a scalar-20 (trackScale 1) coaster. */
  dims?: TrackDimensions
  /**
   * Height of the terrain as rendered (see createTerrainSurface). Footings sit on
   * this; defaults to the TerrainContext heightFn.
   */
  groundFn?: HeightFunction
  /** Arc-length table of `curve`, if the caller already built one. */
  table?: ArcTable
}

const DEFAULT_DIMS = getTrackDimensions({ scalar: 20 })
/** Footing pads stand this far proud of the visible ground. */
const FOOTING_LIFT = 0.5

/** Vertex-coloured steel; `glow` adds the squared (≈ linear: dark rails stay dark) sRGB vertex colours as emissive. Caller disposes. */
function createTrackMaterial(glow: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 })
  if (glow <= 0) return material
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTrackGlow = { value: glow }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTrackGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vColor.rgb * uTrackGlow;')
  }
  material.customProgramCacheKey = () => 'track-glow'
  return material
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _yAxis = new THREE.Vector3(0, 1, 0)

function TowerBucket({
  geometry,
  material,
  towers,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  towers: TowerInstance[]
}) {
  const setRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      _s.set(1, 1, 1)
      for (let i = 0; i < towers.length; i++) {
        const t = towers[i]
        _q.setFromAxisAngle(_yAxis, t.yaw)
        _p.set(t.x, t.topY, t.z)
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    },
    [towers],
  )
  return <instancedMesh name="track-towers" ref={setRef} args={[geometry, material, towers.length]} />
}

/** Lattice towers (one InstancedMesh per height bucket) + footing pads. */
function SupportTowers({
  curve,
  table,
  dims,
  groundFn,
}: {
  curve: TrackCurve
  table: ArcTable
  dims: TrackDimensions
  groundFn?: HeightFunction
}) {
  const heightFn = useContext(TerrainContext)
  const plan: TowerPlan = useMemo(
    () => planTowers(curve, table, dims, heightFn, groundFn ?? heightFn),
    [curve, table, dims, heightFn, groundFn],
  )
  useContactShadows(useMemo(() => towerShadowCasters(plan), [plan]))

  const td = useMemo(() => getTowerDims(dims), [dims])
  const bucketGeoms = useMemo(
    () => plan.bucketHeights.map((h) => buildTowerGeometry(td, h)),
    [plan, td],
  )
  const footingGeom = useMemo(() => buildFootingGeometry(), [])
  const steel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8b939c', roughness: 0.5, metalness: 0.45 }),
    [],
  )
  const concrete = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#a39d92', roughness: 0.95, metalness: 0 }),
    [],
  )

  useEffect(
    () => () => {
      for (const g of bucketGeoms) g.dispose()
    },
    [bucketGeoms],
  )
  useEffect(
    () => () => {
      footingGeom.dispose()
      steel.dispose()
      concrete.dispose()
    },
    [footingGeom, steel, concrete],
  )

  const byBucket = useMemo(
    () => plan.bucketHeights.map((_, b) => plan.towers.filter((t) => t.bucket === b)),
    [plan],
  )

  const footingCount = plan.towers.length * 4
  const setFootingRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      let i = 0
      for (const t of plan.towers) {
        _q.setFromAxisAngle(_yAxis, t.yaw)
        for (const f of t.feet) {
          _p.set(f.x, f.y + FOOTING_LIFT, f.z)
          _s.set(f.size, f.y + FOOTING_LIFT - f.bottom, f.size)
          mesh.setMatrixAt(i++, _m.compose(_p, _q, _s))
        }
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    },
    [plan],
  )

  if (plan.towers.length === 0) return null

  return (
    <>
      {bucketGeoms.map((geom, b) =>
        byBucket[b].length > 0 ? (
          <TowerBucket key={geom.uuid} geometry={geom} material={steel} towers={byBucket[b]} />
        ) : null,
      )}
      <instancedMesh
        name="track-footings"
        key={footingGeom.uuid + footingCount} ref={setFootingRef} args={[footingGeom, concrete, footingCount]} />
    </>
  )
}

export default function TrackMesh({
  curve,
  segments = 1000,
  color1 = [1, 1, 1],
  color2 = [1, 1, 0],
  glow = 0,
  dims = DEFAULT_DIMS,
  groundFn,
  table: tableProp,
}: TrackMeshProps) {
  const table = useMemo(() => tableProp ?? buildArcTable(curve), [tableProp, curve])
  const geometry = useMemo(
    () => buildTrackGeometry(curve, table, dims, segments, color1, color2),
    [curve, table, dims, segments, color1, color2],
  )

  const material = useMemo(() => createTrackMaterial(glow), [glow])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  return (
    <>
      <mesh name="track" geometry={geometry} material={material} />
      <SupportTowers curve={curve} table={table} dims={dims} groundFn={groundFn} />
    </>
  )
}
