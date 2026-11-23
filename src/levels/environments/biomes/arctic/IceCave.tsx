import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ArcTable } from '@/track/arcLength'
import { DARKNESS } from '@/track/darkSection.hot'
import type { DarkSectionSpec } from '@/types/level'
import type { HeightFunction } from '@/utils/terrainNoise'
import { buildIceCaveGeometry, iceCaveSpan } from './iceCaveGeometry'

/** Faceted, vertex-coloured ice whose veins (`aEmissive`) glow as the ride goes dark (`DARKNESS`). Caller disposes. */
function createIceCaveMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDarkness = DARKNESS
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aEmissive;\nvarying vec3 vVein;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVein = aEmissive;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDarkness;\nvarying vec3 vVein;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vVein * (0.15 + 1.6 * uDarkness);')
  }
  material.customProgramCacheKey = () => 'ice-cave'
  return material
}

/** Level 4's ice cave (#866): one draw over the track's ice dark section. */
export default function IceCave({ table, section, groundFn }: { table: ArcTable; section: DarkSectionSpec; groundFn: HeightFunction }) {
  const geometry = useMemo(() => buildIceCaveGeometry(table, iceCaveSpan(table, section), groundFn), [table, section, groundFn])
  const material = useMemo(createIceCaveMaterial, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <mesh name="ice-cave" geometry={geometry} material={material} />
}
