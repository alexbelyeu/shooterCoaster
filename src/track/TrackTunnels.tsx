import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { useContactShadows } from '@/levels/environments/shared/ContactShadows'
import type { TrackCurve } from './curves/TrackCurve'
import type { ArcTable } from './arcLength'
import { buildTunnelGeometry, getTunnelDims, tunnelColours, tunnelShadowCasters } from './setPieces'

/** Vertex-coloured, plus the per-vertex `aEmissive` the tunnel's lights glow with. Caller disposes. */
function createTunnelMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aEmissive;\nvarying vec3 vTunnelEmissive;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTunnelEmissive = aEmissive;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTunnelEmissive;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vTunnelEmissive;')
  }
  material.customProgramCacheKey = () => 'track-tunnel'
  return material
}

/** Every tunnel on the track table (#332): one draw call, and their contact shadows. */
export default function TrackTunnels({
  curve,
  table,
  trackScale,
  color1,
  color2,
  groundFn,
}: {
  curve: TrackCurve
  table: ArcTable
  trackScale: number
  color1: readonly number[]
  color2: readonly number[]
  groundFn: HeightFunction
}) {
  const dims = useMemo(() => getTunnelDims(trackScale), [trackScale])
  const geometry = useMemo(
    () => buildTunnelGeometry(curve, table, dims, tunnelColours(color1, color2)),
    [curve, table, dims, color1, color2],
  )
  const material = useMemo(createTunnelMaterial, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useContactShadows(useMemo(() => tunnelShadowCasters(table, dims, groundFn), [table, dims, groundFn]))
  return <mesh name="tunnel" geometry={geometry} material={material} />
}
