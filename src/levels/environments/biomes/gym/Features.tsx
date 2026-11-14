import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import StaticInstances from '../../shared/StaticInstances'
import { buildHall } from './hallGeometry'

/** Light fittings and daylit windows: unlit and over 1, so Bloom picks them up. */
const LIGHT_BOOST = 1.6

/** The Climbing Gym's hall from Alex's blockout: walls, boulders, the Starr, the building, and the holds on every climbing face. */
export default function GymFeatures() {
  const hall = useMemo(() => buildHall(), [])
  const materials = useMemo(
    () => ({
      solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
      light: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(LIGHT_BOOST, LIGHT_BOOST, LIGHT_BOOST), toneMapped: false }),
      glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false }),
      hold: new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }),
    }),
    [],
  )
  const shapes = useMemo(
    () => ({
      hold: new THREE.IcosahedronGeometry(1, 0),
      volume: new THREE.ConeGeometry(1, 1, 4).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    }),
    [],
  )
  useEffect(
    () => () => {
      hall.solid.dispose()
      hall.light.dispose()
      hall.glass.dispose()
    },
    [hall],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  useEffect(() => () => Object.values(shapes).forEach((g) => g.dispose()), [shapes])

  return (
    <>
      <mesh geometry={hall.solid} material={materials.solid} />
      <mesh geometry={hall.light} material={materials.light} />
      <mesh geometry={hall.glass} material={materials.glass} />
      <StaticInstances matrices={hall.holds.matrices} colors={hall.holds.colors} geometry={shapes.hold} material={materials.hold} />
      <StaticInstances matrices={hall.volumes.matrices} colors={hall.volumes.colors} geometry={shapes.volume} material={materials.hold} />
    </>
  )
}
