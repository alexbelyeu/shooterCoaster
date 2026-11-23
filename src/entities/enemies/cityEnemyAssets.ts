import * as THREE from 'three'
import { mergePainted, painted } from '@/levels/environments/shared/paintedParts'
import { withRim } from './enemyRim'
import { DRONE_BODY, DRONE_DOME, DRONE_GLOW, DRONE_TAIL } from './enemyPalette'

// Neon Metropolis's enemies (#323, briefs in docs/art/ENEMIES.md): the hover drone. +z faces the rider, +y is up.
// Re-exported by SharedEnemyAssets, so ShaderWarmup compiles every material here.

/** Where the four rotors sit: the ends of the X of arms, in the model's units. */
const ROTOR_REACH = 3.2
const ROTORS = [45, 135, 225, 315].map((deg) => {
  const a = (deg * Math.PI) / 180
  return [Math.sin(a) * ROTOR_REACH, 0.15, Math.cos(a) * ROTOR_REACH] as [number, number, number]
})

/** The drone's dark frame: puck, dome, the X of arms, the rotor hubs and the eye's housing, one geometry. */
export const DRONE_BODY_GEO = mergePainted([
  painted(new THREE.CylinderGeometry(2.0, 2.3, 1.1, 8), DRONE_BODY),
  painted(new THREE.SphereGeometry(1.4, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), DRONE_DOME, [0, 0.5, 0]),
  painted(new THREE.BoxGeometry(0.5, 0.35, ROTOR_REACH * 2), DRONE_BODY, [0, 0.1, 0], [0, Math.PI / 4, 0]),
  painted(new THREE.BoxGeometry(0.5, 0.35, ROTOR_REACH * 2), DRONE_BODY, [0, 0.1, 0], [0, -Math.PI / 4, 0]),
  ...ROTORS.map((p) => painted(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 6), DRONE_DOME, p)),
  painted(new THREE.SphereGeometry(0.8, 8, 5), DRONE_BODY, [0, -0.2, 1.9]),
])

/** What burns on the drone, unlit: the rotor rings and the eye in cyan, a magenta tail light. */
export const DRONE_GLOW_GEO = mergePainted([
  ...ROTORS.map((p) => painted(new THREE.TorusGeometry(1.15, 0.16, 3, 14), DRONE_GLOW, [p[0], p[1] + 0.25, p[2]], [Math.PI / 2, 0, 0])),
  painted(new THREE.SphereGeometry(0.5, 8, 5), DRONE_GLOW, [0, -0.2, 2.45]),
  painted(new THREE.BoxGeometry(0.9, 0.3, 0.3), DRONE_TAIL, [0, 0.1, -2.35]),
])

// Gunmetal that catches the sky's haze, under a cyan rim: a dark drone reads by its edges at night (the dark rule)
export const DRONE_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true,
  metalness: 0.55,
  roughness: 0.35,
  flatShading: true,
}), { color: DRONE_GLOW, intensity: 0.9, power: 2.0 })

export const DRONE_GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
DRONE_GLOW_MAT.color.setScalar(1.8)
