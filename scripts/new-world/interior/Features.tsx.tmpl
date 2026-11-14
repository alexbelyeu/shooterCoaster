import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { HALL, HALL_COLORS } from './config'

/** The hall: four walls and a ceiling seen from inside, one draw call. */
export default function __Biome__Features() {
  const geometry = useMemo(
    () => new THREE.BoxGeometry(HALL.halfWidth * 2, HALL.height, HALL.halfDepth * 2).translate(0, HALL.height / 2, 0),
    [],
  )
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: HALL_COLORS.wall, roughness: 0.9, side: THREE.BackSide }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} />
}
