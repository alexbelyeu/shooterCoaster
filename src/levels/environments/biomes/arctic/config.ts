import * as THREE from 'three'
import type { BiomeTreeConfig, ColorRamp } from '../../shared/types'

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0x8ab4cc) },  // pale blue ice
    { height: 0.2, color: new THREE.Color(0xc0d8e8) },  // light blue
    { height: 0.4, color: new THREE.Color(0xe0e8f0) },  // white snow
    { height: 0.6, color: new THREE.Color(0xf0f4f8) },  // bright snow
    { height: 0.8, color: new THREE.Color(0xd0e0f0) },  // blue-white
    { height: 1.0, color: new THREE.Color(0xa0c0e0) },  // blue ice peaks
  ],
  cliffColor: new THREE.Color(0x7090b0),
}

export const TREES: BiomeTreeConfig = {
  types: [
    {
      trunkColor: '#3a2818',
      canopyColors: () => `hsl(${140 + Math.random() * 20}, ${20 + Math.random() * 15}%, ${20 + Math.random() * 10}%)`,
      canopyGeoFactory: () => new THREE.ConeGeometry(1, 1, 6),
      heightRange: [25, 70],
    },
  ],
  maxCount: 80,
  minRadius: 200,
  maxRadius: 4000,
  maxSlope: Math.PI / 6, // mountains: tight slope rejection
}
