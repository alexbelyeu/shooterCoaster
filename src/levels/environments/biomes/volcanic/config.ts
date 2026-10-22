import * as THREE from 'three'
import type { BiomeTreeConfig, ColorRamp } from '../../shared/types'
import type { ParticleFieldPreset } from '../../shared/ParticleField'

/** Grey ash drifting down, with tiny orange embers rising through it. */
export const ASH_EMBERS: ParticleFieldPreset = {
  count: 3000,
  box: [520, 280, 520],
  primary: {
    color: 0x9a918a,
    opacity: 0.6,
    size: 1.0,
    maxPixels: 4,
    velocity: [4, -7, 2],
    sway: 5,
    flicker: 0,
    additive: false,
  },
  secondary: {
    color: 0xff6a1a,
    opacity: 0.9,
    size: 0.8,
    maxPixels: 4,
    velocity: [1, 12, 0],
    sway: 7,
    flicker: 1,
    additive: true,
  },
  secondaryShare: 0.2,
}

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0x1a0e08) },  // dark volcanic black
    { height: 0.15, color: new THREE.Color(0x2a1510) }, // dark charcoal-brown
    { height: 0.3, color: new THREE.Color(0x3a2018) },  // warm dark brown
    { height: 0.5, color: new THREE.Color(0x4a2a1a) },  // burnt umber
    { height: 0.7, color: new THREE.Color(0x3a2015) },  // darkening again
    { height: 0.85, color: new THREE.Color(0x2a1810) }, // near-black peaks
    { height: 1.0, color: new THREE.Color(0x1a1008) },  // obsidian black peaks
  ],
  cliffColor: new THREE.Color(0x5a3020),
}

/** Dead, charred trees */
export const TREES: BiomeTreeConfig = {
  types: [
    {
      trunkColor: '#1a1008',
      canopyColors: () => '#1a1008',
      canopyGeoFactory: () => new THREE.ConeGeometry(0.3, 0.5, 3),
      heightRange: [15, 50],
    },
  ],
  maxCount: 60,
  minRadius: 200,
  maxRadius: 4000,
  maxSlope: Math.PI / 6, // mountains: tight slope rejection
}
