import * as THREE from 'three'
import type { ColorRamp } from '../../shared/types'

// Sampled by |y| / max|y| (≈ 236): the seabed (y = -40) shares a stop with land at y = +40, so it is a teal-green that works as both.
export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0xcdb985) },  // beach / shallow sand
    { height: 0.05, color: new THREE.Color(0xa9a77c) }, // wet sand
    { height: 0.12, color: new THREE.Color(0x467f66) }, // seagrass / scrub
    { height: 0.17, color: new THREE.Color(0x36705e) }, // lagoon floor
    { height: 0.3, color: new THREE.Color(0x6a9a4a) },  // island grass
    { height: 0.55, color: new THREE.Color(0x5d8442) }, // island greenery
    { height: 0.75, color: new THREE.Color(0x6e685a) }, // volcanic rock
    { height: 1.0, color: new THREE.Color(0x4a463e) },  // dark volcanic peak
  ],
  cliffColor: new THREE.Color(0x4f4a40),
}

/** Ocean has no trees (the level's treeCount is ignored). */
export const TREES = null

/** Sea stacks keep clear of it. */
export const SUNKEN_CITY_POSITION: [number, number, number] = [1800, -15, -1400]
