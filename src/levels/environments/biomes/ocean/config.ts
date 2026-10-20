import * as THREE from 'three'
import type { ColorRamp } from '../../shared/types'

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0x1a3a4a) },  // deep seafloor
    { height: 0.2, color: new THREE.Color(0x2a5a5a) },  // mid seafloor
    { height: 0.4, color: new THREE.Color(0x4a8a6a) },  // shallows
    { height: 0.6, color: new THREE.Color(0x6aaa70) },  // near surface
    { height: 0.75, color: new THREE.Color(0x5a5a50) }, // volcanic rock
    { height: 1.0, color: new THREE.Color(0x3a3a35) },  // dark volcanic peak
  ],
  cliffColor: new THREE.Color(0x2a2a28),
}

/** Ocean has no trees (the level's treeCount is ignored). */
export const TREES = null
