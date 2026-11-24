import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { SeaArchSpec } from '@/types/level'
import { seaArchShape } from './seaArch'
import { createSeaArchGeometry } from './seaProps'

/** The sea arch the ride threads (#865, `environment.seaArch`): one static mesh of stack rock across the rails. */
export default function SeaArch({ spec }: { spec: SeaArchSpec }) {
  const geometry = useMemo(() => createSeaArchGeometry(spec), [spec])
  const material = useMemo(
    () => new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, specular: 0x333333, shininess: 18 }),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <mesh geometry={geometry} material={material} position={[spec.x, seaArchShape(spec).centreY, spec.z]} castShadow receiveShadow />
}
