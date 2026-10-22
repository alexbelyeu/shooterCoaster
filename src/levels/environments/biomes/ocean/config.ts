import * as THREE from 'three'
import type { ColorRamp } from '../../shared/types'

// The ramp is sampled by |y| / max|y| (max ≈ 236), so the seabed (y = -40 → 0.17)
// shares stops with low land (y = +40): a teal-green that reads as seagrass under
// the water and as dark scrub above it. Sand rings every shoreline (|y| < ~12).
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

/** Where the sunken city landmark stands (Features); sea stacks keep clear of it. */
export const SUNKEN_CITY_POSITION: [number, number, number] = [1800, -15, -1400]
