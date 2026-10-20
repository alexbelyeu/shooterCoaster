import * as THREE from 'three'
import type { BiomeTreeConfig, ColorRamp } from '../../shared/types'

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0xc2a060) },  // packed sand
    { height: 0.3, color: new THREE.Color(0xd4b36a) },  // golden dunes
    { height: 0.5, color: new THREE.Color(0xdaaa50) },  // deeper gold
    { height: 0.7, color: new THREE.Color(0xb85a3a) },  // red rock
    { height: 0.9, color: new THREE.Color(0x8b4030) },  // dark red mesa
    { height: 1.0, color: new THREE.Color(0x7a3528) },  // mesa top
  ],
  cliffColor: new THREE.Color(0x7a4530),
}

export const TREES: BiomeTreeConfig = {
  types: [
    {
      trunkColor: '#8a7a5a',
      canopyColors: () => `hsl(${30 + Math.random() * 20}, ${20 + Math.random() * 15}%, ${30 + Math.random() * 15}%)`,
      canopyGeoFactory: () => new THREE.ConeGeometry(1, 1, 4),
      heightRange: [15, 35],
    },
  ],
  maxCount: 15,
  minRadius: 200,
  maxRadius: 4000,
  maxSlope: Math.PI / 4,
}
