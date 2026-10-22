import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createRng } from '../../shared/trackScatter'
import type { SeabedProp } from './seaPlacement'
import { createCoralClusterGeometry, createKelpClumpGeometry, propMatrix } from './seaProps'
import { createCoralMaterial, createKelpMaterial } from './seaMaterials'
import StaticInstances from '../../shared/StaticInstances'

// Warm tints only: coral must not share a hue with the jellyfish (pastel pink, blue, lilac, mint).
const CORAL_TINTS = [0xffffff, 0xffd2b0, 0xffe48a, 0xffb39a]

export default function Reef({ coral, kelp }: { coral: readonly SeabedProp[]; kelp: readonly SeabedProp[] }) {
  const coralGeo = useMemo(() => createCoralClusterGeometry(), [])
  const kelpGeo = useMemo(() => createKelpClumpGeometry(), [])
  const coralMat = useMemo(() => createCoralMaterial(0.22), [])
  const kelpMat = useMemo(() => createKelpMaterial(), [])

  const coralMatrices = useMemo(() => coral.map(propMatrix), [coral])
  const coralColors = useMemo(() => {
    const rng = createRng(77)
    return coral.map(() => new THREE.Color(CORAL_TINTS[Math.floor(rng() * CORAL_TINTS.length)]))
  }, [coral])
  const kelpMatrices = useMemo(() => kelp.map(propMatrix), [kelp])

  useEffect(() => {
    return () => {
      coralGeo.dispose()
      kelpGeo.dispose()
      coralMat.dispose()
    }
  }, [coralGeo, kelpGeo, coralMat])
  useEffect(() => () => kelpMat.material.dispose(), [kelpMat])

  useFrame(({ clock }) => {
    kelpMat.uTime.value = clock.elapsedTime
  })

  return (
    <>
      <StaticInstances matrices={coralMatrices} colors={coralColors} geometry={coralGeo} material={coralMat} />
      <StaticInstances matrices={kelpMatrices} geometry={kelpGeo} material={kelpMat.material} />
    </>
  )
}
