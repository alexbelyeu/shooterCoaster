import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { useContactShadows } from '@/levels/environments/shared/ContactShadows'
import type { TrackCurve } from './curves/TrackCurve'
import type { ArcTable } from './arcLength'
import { getTunnelDims, type TunnelDims } from './setPieces'
import { buildTunnelGeometry, tunnelColours, tunnelShadowCasters, type TunnelColours } from './tunnelGeometry'

/** Vertex-coloured, plus the per-vertex `aEmissive` the tunnel's lights glow with; `glass`: see-through. Caller disposes. */
function createTunnelMaterial(glass: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial(
    glass
      ? { vertexColors: true, roughness: 0.15, metalness: 0.3, transparent: true, opacity: GLASS_OPACITY, depthWrite: false, side: THREE.DoubleSide }
      : { vertexColors: true, roughness: 0.8, metalness: 0.1 },
  )
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aEmissive;\nvarying vec3 vTunnelEmissive;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTunnelEmissive = aEmissive;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTunnelEmissive;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vTunnelEmissive;')
  }
  material.customProgramCacheKey = () => (glass ? 'track-tunnel-glass' : 'track-tunnel')
  return material
}

/** A glass tube's walls: the sea and what swims in it show through (#865). */
const GLASS_OPACITY = 0.3

/** Every tunnel on the track table (#332): one draw call for the solid ones, one for the glass ones, and their contact shadows. */
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
  const colours = useMemo(() => tunnelColours(color1, color2), [color1, color2])
  useContactShadows(useMemo(() => tunnelShadowCasters(table, dims, groundFn), [table, dims, groundFn]))
  const spans = table.tunnels ?? []
  return (
    <>
      {spans.some((s) => !s.glass) && <TunnelMesh curve={curve} table={table} dims={dims} colours={colours} glass={false} />}
      {spans.some((s) => s.glass) && <TunnelMesh curve={curve} table={table} dims={dims} colours={colours} glass />}
    </>
  )
}

function TunnelMesh({ curve, table, dims, colours, glass }: {
  curve: TrackCurve
  table: ArcTable
  dims: TunnelDims
  colours: TunnelColours
  glass: boolean
}) {
  const geometry = useMemo(() => buildTunnelGeometry(curve, table, dims, colours, glass), [curve, table, dims, colours, glass])
  const material = useMemo(() => createTunnelMaterial(glass), [glass])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <mesh name={glass ? 'tunnel-glass' : 'tunnel'} geometry={geometry} material={material} />
}
