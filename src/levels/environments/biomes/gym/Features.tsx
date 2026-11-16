import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useContactShadows } from '../../shared/ContactShadows'
import StaticInstances from '../../shared/StaticInstances'
import FlameFire from './FlameFire'
import { buildHall } from './hallGeometry'
import { gymShadowCasters } from './shadows'

/** Light fittings and daylit windows: unlit and over 1, so Bloom picks them up. */
const LIGHT_BOOST = 1.6

/** The Climbing Gym's hall from Alex's blockout: walls, boulders, the Starr, the building, the holds on every climbing face, the Flame's fire, and the contact shadows of everything standing on the floor. */
export default function GymFeatures() {
  const hall = useMemo(() => buildHall(), [])
  useContactShadows(useMemo(() => gymShadowCasters(), []))
  const materials = useMemo(
    () => ({
      solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
      light: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(LIGHT_BOOST, LIGHT_BOOST, LIGHT_BOOST), toneMapped: false }),
      glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false }),
      hold: new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }),
    }),
    [],
  )
  const holdShape = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  useEffect(
    () => () => {
      hall.solid.dispose()
      hall.light.dispose()
      hall.glass.dispose()
    },
    [hall],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  useEffect(() => () => holdShape.dispose(), [holdShape])

  return (
    <>
      <mesh geometry={hall.solid} material={materials.solid} />
      <mesh geometry={hall.light} material={materials.light} />
      <mesh geometry={hall.glass} material={materials.glass} />
      <StaticInstances matrices={hall.holds.matrices} colors={hall.holds.colors} geometry={holdShape} material={materials.hold} />
      <FlameFire />
    </>
  )
}
