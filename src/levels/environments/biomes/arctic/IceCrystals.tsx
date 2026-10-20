import { useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { createRng, scatterNearTrack, settleOnGround, trackExtent } from '../../shared/trackScatter'
import {
  CRYSTAL_FOOTPRINT,
  SPIRE_HEIGHT,
  SPLAY_HEIGHT,
  createSpireClusterGeometry,
  createSplayClusterGeometry,
} from './iceProps'

interface ClusterSet {
  matrices: THREE.Matrix4[]
  colors: THREE.Color[]
}

interface ClusterPlacement {
  count: number
  /** Tallest shard at scale 1. */
  height: number
  scaleRange: [number, number]
  /** Clearance from the track centreline. */
  minDist: number
  seed: number
}

const TINTS = [0xffffff, 0xd8f6ff, 0xb8ecff, 0xe8fbff]

// Tall spires stand further back so they frame the ride without hiding snowmen next
// to the rails; the low splays may come closer.
const SPIRES: ClusterPlacement = { count: 90, height: SPIRE_HEIGHT, scaleRange: [1.2, 2.6], minDist: 120, seed: 19 }
const SPLAYS: ClusterPlacement = { count: 110, height: SPLAY_HEIGHT, scaleRange: [1.2, 2.2], minDist: 70, seed: 1904 }

function placeClusters(
  { groundFn, trackSamples }: Pick<BiomeDecorationsProps, 'groundFn' | 'trackSamples'>,
  { count, height, scaleRange, minDist, seed }: ClusterPlacement,
): ClusterSet {
  const rng = createRng(seed)
  // Mid-ground band around the ride, out to 1.5x the track extent, densest near the
  // rails. Slopes are measured on the drawn surface the clusters stand on; oversample
  // so clusters on broken ground can be dropped.
  const points = scatterNearTrack({
    count: count * 3,
    trackSamples,
    heightFn: groundFn,
    minDist,
    maxDist: 900,
    maxRadius: trackExtent(trackSamples) * 1.5,
    maxSlope: Math.PI / 6,
    bias: 1.8,
    rng,
  })
  // at most a fifth of a cluster buried on the uphill side
  const props = settleOnGround(points, groundFn, {
    count,
    scaleRange,
    footprint: CRYSTAL_FOOTPRINT,
    height,
    sink: 1,
    maxBury: 0.2,
    rng,
  })
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const matrices = props.map((p) => {
    q.setFromAxisAngle(up, rng() * Math.PI * 2)
    return new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, p.y, p.z),
      q,
      new THREE.Vector3(p.scale, p.scale, p.scale),
    )
  })
  const colors = props.map(() => new THREE.Color(TINTS[Math.floor(rng() * TINTS.length)]))
  return { matrices, colors }
}

function ClusterMesh({
  set,
  geometry,
  material,
}: {
  set: ClusterSet
  geometry: THREE.BufferGeometry
  material: THREE.Material
}) {
  const setRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      set.matrices.forEach((m, i) => {
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, set.colors[i])
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    },
    [set],
  )
  if (set.matrices.length === 0) return null
  return <instancedMesh ref={setRef} args={[geometry, material, set.matrices.length]} />
}

/** Glowing cyan crystal clusters in two shapes, scattered around the track and sat on the drawn terrain. */
export default function IceCrystals({ groundFn, trackSamples }: BiomeDecorationsProps) {
  const spireGeo = useMemo(() => createSpireClusterGeometry(), [])
  const splayGeo = useMemo(() => createSplayClusterGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: '#b4f4ff',
        emissive: '#1fb4d6',
        emissiveIntensity: 0.55,
        specular: '#ffffff',
        shininess: 90,
        flatShading: true,
      }),
    [],
  )

  const spires = useMemo(() => placeClusters({ groundFn, trackSamples }, SPIRES), [groundFn, trackSamples])
  const splays = useMemo(() => placeClusters({ groundFn, trackSamples }, SPLAYS), [groundFn, trackSamples])

  useEffect(() => {
    return () => {
      spireGeo.dispose()
      splayGeo.dispose()
      material.dispose()
    }
  }, [spireGeo, splayGeo, material])

  return (
    <>
      <ClusterMesh set={spires} geometry={spireGeo} material={material} />
      <ClusterMesh set={splays} geometry={splayGeo} material={material} />
    </>
  )
}
