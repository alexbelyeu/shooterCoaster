import * as THREE from 'three'
import type { ColorRamp } from '@/levels/environments/shared/types'

// Neon Metropolis (#323): a flat city at night. The ground is asphalt (the street grid comes from `cityShaders.ts`).

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0x24222c) }, // asphalt
    { height: 0.5, color: new THREE.Color(0x2c2a34) },
    { height: 1.0, color: new THREE.Color(0x34303c) }, // the low swell beyond the skyline
  ],
  cliffColor: new THREE.Color(0x2a2832),
}

/** Where the hero tower stands (`Features.tsx`), the intro's tour passes and the results orbit looks: beyond the track. */
export const LANDMARK_SITE = { x: 1500, z: -1900 } as const

/** Height of the hero tower (world units): the tallest thing in the city. */
export const SPIRE_HEIGHT = 820
