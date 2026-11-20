import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeFeaturesProps } from '@/levels/environments/shared/types'
import { LANDMARK_SITE, SPIRE_HEIGHT } from './config'

/** A stone spire beyond the track: the stand-in for this world's hero landmark (docs/LEVEL-KIT.md). */
export default function __Biome__Features({ groundFn }: BiomeFeaturesProps) {
  const geometry = useMemo(() => new THREE.ConeGeometry(70, SPIRE_HEIGHT, 5).translate(0, SPIRE_HEIGHT / 2, 0), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x7a7068, roughness: 0.85, flatShading: true }), [])
  const position = useMemo(() => [LANDMARK_SITE.x, groundFn(LANDMARK_SITE.x, LANDMARK_SITE.z) - 10, LANDMARK_SITE.z] as const, [groundFn])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} position={position} />
}
