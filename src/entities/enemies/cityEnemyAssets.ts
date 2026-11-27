import * as THREE from 'three'
import { mergePainted, painted } from '@/levels/environments/shared/paintedParts'
import { EnemyFleet } from './enemyFleet'
import { withEmissivePatch, withRim } from './enemyRim'
import { BOT_FACE, BOT_GLYPH, DRONE_BODY, DRONE_DOME, DRONE_GLOW, DRONE_TAIL } from './enemyPalette'

// Neon Metropolis's enemies (briefs in docs/art/ENEMIES.md): the hover drone (#323) and the billboard bot (#963). +z faces the rider, +y is up.
// Re-exported by SharedEnemyAssets, so ShaderWarmup compiles every material here.

/** Live enemies of one kind a fleet draws at once; any past it draw themselves. */
const FLEET_SIZE = 128

/** Where the four rotors sit: the ends of the X of arms, in the model's units. */
const ROTOR_REACH = 3.2
const ROTORS = [45, 135, 225, 315].map((deg) => {
  const a = (deg * Math.PI) / 180
  return [Math.sin(a) * ROTOR_REACH, 0.15, Math.cos(a) * ROTOR_REACH] as [number, number, number]
})

// One geometry and one material, so every drone on screen is one instance of `DRONE_FLEET` (#881, #1108): the dark frame is
// lit, the glowing parts are painted bright and the material lights them itself (`DRONE_GLOW_APPLY`).

/** The drone's dark frame: puck, dome, the X of arms, the rotor hubs and the eye's housing. */
const DRONE_FRAME = [
  painted(new THREE.CylinderGeometry(2.0, 2.3, 1.1, 8), DRONE_BODY),
  painted(new THREE.SphereGeometry(1.4, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), DRONE_DOME, [0, 0.5, 0]),
  painted(new THREE.BoxGeometry(0.5, 0.35, ROTOR_REACH * 2), DRONE_BODY, [0, 0.1, 0], [0, Math.PI / 4, 0]),
  painted(new THREE.BoxGeometry(0.5, 0.35, ROTOR_REACH * 2), DRONE_BODY, [0, 0.1, 0], [0, -Math.PI / 4, 0]),
  ...ROTORS.map((p) => painted(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 6), DRONE_DOME, p)),
  painted(new THREE.SphereGeometry(0.8, 8, 5), DRONE_BODY, [0, -0.2, 1.9]),
]

/** What burns on the drone: the rotor rings and the eye in cyan, a magenta tail light. */
const DRONE_LIGHTS = [
  ...ROTORS.map((p) => painted(new THREE.TorusGeometry(1.15, 0.16, 3, 14), DRONE_GLOW, [p[0], p[1] + 0.25, p[2]], [Math.PI / 2, 0, 0])),
  painted(new THREE.SphereGeometry(0.5, 8, 5), DRONE_GLOW, [0, -0.2, 2.45]),
  painted(new THREE.BoxGeometry(0.9, 0.3, 0.3), DRONE_TAIL, [0, 0.1, -2.35]),
]

export const DRONE_GEO = mergePainted([...DRONE_FRAME, ...DRONE_LIGHTS])

// The frame's paint is dark (no channel above ~0.1 linear) and the lights' bright (one channel at 1): a bright vertex
// colour drops its lit diffuse and burns at 1.8x, unlit as a basic material would draw it, for the bloom to take.
const DRONE_GLOW_APPLY = /* glsl */ `{
  float glow = smoothstep(0.4, 0.7, max(vColor.r, max(vColor.g, vColor.b)));
  diffuseColor.rgb *= 1.0 - glow;
  totalEmissiveRadiance += vColor.rgb * glow * 1.8;
}`

/**
 * Gunmetal that catches the sky's haze, under a rim: a dark machine reads by its edges at night (the dark rule), its
 * bright paint burning. One program for every city machine (the drone, the Helicopter's parts): only uniforms differ.
 */
export function cityMachineMaterial(rim: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return withEmissivePatch(withRim(new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.55,
    roughness: 0.35,
    flatShading: true,
  }), { color: rim, intensity: 0.9, power: 2.0 }), 'drone-glow', {}, '', DRONE_GLOW_APPLY)
}

export const DRONE_MAT = cityMachineMaterial(DRONE_GLOW)
/** Every live drone in one draw call: a level 7 wave puts 30 on screen. */
export const DRONE_FLEET = new EnemyFleet(DRONE_GEO, DRONE_MAT, FLEET_SIZE)

// The billboard bot (#963): a lit sign on two legs, feet at y = 0, painted by the drone's rule (dark lit, bright burns).

const SIGN = { w: 6, h: 4.2, y: 3.6 }
const FRAME_TOP = SIGN.y + (SIGN.h + 0.5) / 2
const BULB_Y = FRAME_TOP + 0.8
export const BOT_HEIGHT = BULB_Y + 0.35

const BOT_FRAME = [
  painted(new THREE.BoxGeometry(SIGN.w + 0.5, SIGN.h + 0.5, 0.5), DRONE_BODY, [0, SIGN.y, 0]),
  ...[-1, 1].flatMap((s) => [
    painted(new THREE.BoxGeometry(0.4, 1.4, 0.4), DRONE_BODY, [s * 1.4, 0.75, 0]),
    painted(new THREE.BoxGeometry(0.9, 0.3, 1.2), DRONE_DOME, [s * 1.4, 0.15, 0.2]),
    painted(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 4), DRONE_BODY, [s * (SIGN.w / 2 - 0.2), FRAME_TOP + 0.25, 0]),
  ]),
]

/** Two slanted eyes and a zigzag mouth, raised off the face so they never z-fight with it. */
const BOT_GLYPHS = [
  painted(new THREE.BoxGeometry(1.4, 0.55, 0.2), BOT_GLYPH, [-1.2, SIGN.y + 0.7, 0.45], [0, 0, -0.3]),
  painted(new THREE.BoxGeometry(1.4, 0.55, 0.2), BOT_GLYPH, [1.2, SIGN.y + 0.7, 0.45], [0, 0, 0.3]),
  ...[-1.5, -0.5, 0.5, 1.5].map((x, i) => painted(new THREE.BoxGeometry(1.15, 0.35, 0.2), BOT_GLYPH, [x, SIGN.y - 0.9, 0.45], [0, 0, i % 2 ? -0.45 : 0.45])),
]

const BOT_LIGHTS = [
  painted(new THREE.BoxGeometry(SIGN.w - 0.4, SIGN.h - 0.4, 0.3), BOT_FACE, [0, SIGN.y, 0.2]),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.35, 6, 4), DRONE_GLOW, [s * (SIGN.w / 2 - 0.2), BULB_Y, 0])),
]

export const BOT_GEO = mergePainted([...BOT_FRAME, ...BOT_GLYPHS, ...BOT_LIGHTS])

export const BOT_MAT = cityMachineMaterial(BOT_FACE)
export const BOT_FLEET = new EnemyFleet(BOT_GEO, BOT_MAT, FLEET_SIZE)
