import * as THREE from 'three'
import type { ColorRamp } from '../../shared/types'

/** The hall's floor: flat (`terrainNoise.ts` `gym`), poured grey concrete. */
export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0, color: new THREE.Color(0x8d939a) },
    { height: 1, color: new THREE.Color(0x8d939a) },
  ],
  cliffColor: new THREE.Color(0x8d939a),
}
