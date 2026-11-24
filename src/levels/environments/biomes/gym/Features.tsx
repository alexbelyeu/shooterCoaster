import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useContactShadows } from '../../shared/ContactShadows'
import StaticInstances from '../../shared/StaticInstances'
import type { BiomeFeaturesProps } from '../../shared/types'
import FlameFire from './FlameFire'
import { HOUSE_LIGHTS, withHallGrime, withHoldChalk } from './grimeShader'
import { buildHall, holdGeometry } from './hallGeometry'
import { gymShadowCasters } from './shadows'

/** Light fittings and daylit windows: unlit and over 1, so Bloom picks them up. */
const LIGHT_BOOST = 1.6
/** After hours (a Night Ride's `lampGlow`): the house lights off, what is left of the strip lights' pools and the fittings' glow is the work lights; the Flame still burns. */
const AFTER_HOURS = { pools: 0.3, fittings: 0.35 }

/** The Climbing Gym's hall from Alex's blockout: walls, boulders, the Starr, the building, the holds on every climbing face, the Flame's fire, and the contact shadows of everything standing on the floor. */
export default function GymFeatures({ atmosphere }: BiomeFeaturesProps) {
  const afterHours = Math.min(1, atmosphere.lampGlow ?? 0)
  const hall = useMemo(() => buildHall(), [])
  useContactShadows(useMemo(() => gymShadowCasters(), []))
  const materials = useMemo(
    () => ({
      solid: withHallGrime(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })),
      light: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(LIGHT_BOOST, LIGHT_BOOST, LIGHT_BOOST), toneMapped: false }),
      glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false }),
      hold: withHoldChalk(new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true })),
    }),
    [],
  )
  const holdShape = useMemo(holdGeometry, [])
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
  useEffect(() => {
    HOUSE_LIGHTS.value = 1 + (AFTER_HOURS.pools - 1) * afterHours
    materials.light.color.setScalar(LIGHT_BOOST * (1 + (AFTER_HOURS.fittings - 1) * afterHours))
    return () => {
      HOUSE_LIGHTS.value = 1
    }
  }, [materials, afterHours])

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
