import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SeabedProp } from './seaPlacement'
import { ROCK_RINGS, STACK_RINGS, profileRadiusAt, type RockRing } from './seaDimensions'
import { createBreachingRockGeometry, createSeaStackGeometry, propMatrix } from './seaProps'
import { createFoamMaterial, createFoamRingGeometry } from './seaMaterials'
import StaticInstances from '../../shared/StaticInstances'

/** Inner edge tucked just inside the rock where it crosses the water. */
function foamMatrix(p: SeabedProp, rings: readonly RockRing[]): THREE.Matrix4 {
  const inner = profileRadiusAt(rings, -p.y / p.scale) * p.scale * 0.85
  return propMatrix({ x: p.x, y: 0, z: p.z, yaw: p.yaw, scale: inner })
}

export default function SeaStacks({
  stacks,
  rocks,
  fadeFar,
}: {
  stacks: readonly SeabedProp[]
  rocks: readonly SeabedProp[]
  fadeFar: number
}) {
  const stackGeo = useMemo(() => createSeaStackGeometry(), [])
  const rockGeo = useMemo(() => createBreachingRockGeometry(), [])
  const foamGeo = useMemo(() => createFoamRingGeometry(), [])
  const rockMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        vertexColors: true,
        flatShading: true,
        specular: 0x333333,
        shininess: 18,
      }),
    [],
  )
  const foam = useMemo(() => createFoamMaterial(fadeFar * 0.4, fadeFar), [fadeFar])

  const stackMatrices = useMemo(() => stacks.map(propMatrix), [stacks])
  const rockMatrices = useMemo(() => rocks.map(propMatrix), [rocks])
  const foamMatrices = useMemo(
    () => [...stacks.map((p) => foamMatrix(p, STACK_RINGS)), ...rocks.map((p) => foamMatrix(p, ROCK_RINGS))],
    [stacks, rocks],
  )

  useEffect(() => {
    return () => {
      stackGeo.dispose()
      rockGeo.dispose()
      foamGeo.dispose()
      rockMat.dispose()
    }
  }, [stackGeo, rockGeo, foamGeo, rockMat])
  useEffect(() => () => foam.material.dispose(), [foam])

  useFrame(({ clock }) => {
    foam.uTime.value = clock.elapsedTime
  })

  return (
    <>
      <StaticInstances matrices={stackMatrices} geometry={stackGeo} material={rockMat} />
      <StaticInstances matrices={rockMatrices} geometry={rockGeo} material={rockMat} />
      {/* After the water (renderOrder 0), which writes no depth. */}
      <StaticInstances matrices={foamMatrices} geometry={foamGeo} material={foam.material} renderOrder={1} />
    </>
  )
}
