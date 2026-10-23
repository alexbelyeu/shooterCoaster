import * as THREE from 'three'
import type { BiomeTreeConfig, ColorRamp } from '../../shared/types'

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0x2d5a1e) },  // dark green valley
    { height: 0.25, color: new THREE.Color(0x3a7a28) }, // green hills
    { height: 0.5, color: new THREE.Color(0x6b8a3a) },  // light green
    { height: 0.7, color: new THREE.Color(0x8b7355) },  // brown rock
    { height: 0.85, color: new THREE.Color(0x999088) }, // grey rock
    { height: 1.0, color: new THREE.Color(0xf0f0f0) },  // snow caps
  ],
  cliffColor: new THREE.Color(0x6b5a4a),
}

export const TREES: BiomeTreeConfig = {
  types: [
    {
      trunkColor: '#5c3a1e',
      canopyColors: (rng) => `hsl(${rng.range(100, 140)}, ${rng.range(50, 80)}%, ${rng.range(25, 45)}%)`,
      canopyGeoFactory: () => new THREE.ConeGeometry(1, 1, 6),
      heightRange: [30, 90],
    },
    {
      trunkColor: '#6b4422',
      canopyColors: (rng) => `hsl(${rng.range(80, 130)}, ${rng.range(40, 70)}%, ${rng.range(20, 45)}%)`,
      canopyGeoFactory: () => new THREE.DodecahedronGeometry(1, 1),
      heightRange: [25, 70],
    },
  ],
  // no cap: uses the level's treeCount (120)
  minRadius: 800,
  maxRadius: 3000,
  maxSlope: Math.PI / 4,
}
