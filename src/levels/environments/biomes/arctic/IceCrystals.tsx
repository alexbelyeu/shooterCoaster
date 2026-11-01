import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { scatterNearTrack, settleOnGround, trackExtent } from '../../shared/trackScatter'
import { createRng } from '@/utils/rng'
import {
  CRYSTAL_FOOTPRINT,
  SPIRE_HEIGHT,
  SPLAY_HEIGHT,
  createSpireClusterGeometry,
  createSplayClusterGeometry,
} from './iceProps'
import { roundCaster, type ShadowCaster } from '../../shared/contactShadows'
import { useContactShadows } from '../../shared/ContactShadows'
import StaticInstances from '../../shared/StaticInstances'
import { yawScaleMatrix } from '../../shared/yawScaleMatrix'

interface ClusterSet {
  matrices: THREE.Matrix4[]
  colors: THREE.Color[]
  shadows: ShadowCaster[]
}

interface ClusterPlacement {
  count: number
  height: number
  scaleRange: [number, number]
  minDist: number
  seed: number
}

const TINTS = [0xffffff, 0xd8f6ff, 0xb8ecff, 0xe8fbff]

// Tall spires stand further back so they don't hide snowmen beside the rails.
const SPIRES: ClusterPlacement = { count: 90, height: SPIRE_HEIGHT, scaleRange: [1.2, 2.6], minDist: 120, seed: 19 }
const SPLAYS: ClusterPlacement = { count: 110, height: SPLAY_HEIGHT, scaleRange: [1.2, 2.2], minDist: 70, seed: 1904 }

function placeClusters(
  { groundFn, track }: Pick<BiomeDecorationsProps, 'groundFn' | 'track'>,
  { count, height, scaleRange, minDist, seed }: ClusterPlacement,
): ClusterSet {
  const rng = createRng(seed)
  // Oversampled: settleOnGround drops spots on broken ground.
  const points = scatterNearTrack({
    count: count * 3,
    track,
    heightFn: groundFn,
    minDist,
    maxDist: 900,
    maxRadius: trackExtent(track) * 1.5,
    maxSlope: Math.PI / 6,
    bias: 1.8,
    rng,
  })
  const props = settleOnGround(points, groundFn, {
    count,
    scaleRange,
    footprint: CRYSTAL_FOOTPRINT,
    height,
    sink: 1,
    maxBury: 0.2,
    rng,
  })
  const matrices = props.map((p) => yawScaleMatrix(p, rng() * Math.PI * 2, p.scale))
  const colors = props.map(() => new THREE.Color(TINTS[Math.floor(rng() * TINTS.length)]))
  const shadows = props.map((p) => roundCaster(p.x, p.z, CRYSTAL_FOOTPRINT * p.scale, 0.6, 0.8))
  return { matrices, colors, shadows }
}

/** Glowing cyan crystal clusters around the track. */
export default function IceCrystals({ groundFn, track }: BiomeDecorationsProps) {
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

  const spires = useMemo(() => placeClusters({ groundFn, track }, SPIRES), [groundFn, track])
  const splays = useMemo(() => placeClusters({ groundFn, track }, SPLAYS), [groundFn, track])
  useContactShadows(useMemo(() => [...spires.shadows, ...splays.shadows], [spires, splays]))

  useEffect(() => {
    return () => {
      spireGeo.dispose()
      splayGeo.dispose()
      material.dispose()
    }
  }, [spireGeo, splayGeo, material])

  return (
    <>
      <StaticInstances matrices={spires.matrices} colors={spires.colors} geometry={spireGeo} material={material} />
      <StaticInstances matrices={splays.matrices} colors={splays.colors} geometry={splayGeo} material={material} />
    </>
  )
}
