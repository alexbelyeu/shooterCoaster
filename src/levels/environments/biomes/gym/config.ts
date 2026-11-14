import * as THREE from 'three'
import type { ColorRamp } from '../../shared/types'
import { GYM_SCALE, floorAt, toBlockout } from './blockout'
import type { HeightFunction } from '@/utils/terrainNoise'

/** The hall's floor (the terrain mesh): poured grey concrete, the same at both levels. */
export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0, color: new THREE.Color(0x8d939a) },
    { height: 1, color: new THREE.Color(0x8d939a) },
  ],
  cliffColor: new THREE.Color(0x8d939a),
}

/** World floor height: the main floor at 0, the Starr pit 2.45 m below it. */
export const gymFloor: HeightFunction = (x, z) => {
  const p = toBlockout({ x, y: 0, z })
  return floorAt(p.x, p.z) * GYM_SCALE
}

/**
 * Paint per profile panel, bottom to top, for walls whose note gives bands (the rest are their `color`).
 * Read from Alex's notes in `blockout.json`; #519 adds the rugged panel variety.
 */
export const WALL_PAINT: Record<string, readonly string[]> = {
  'w-starr': ['#e8eae5', '#1d2320', '#f2c230'],
  'w-shield': ['#dfe3dc', '#f2c230', '#1d2320', '#3f8f4e'],
  'w-lagoon-n': ['#dfe2e4', '#6b4fb0', '#dfe2e4'],
  'w-lagoon-s': ['#5468c4', '#dfe2e4', '#a9adb3'],
  'w-south-ab': ['#5b55b0', '#4057b5', '#f4f4f6'],
  'b-south': ['#5b55b0', '#4057b5'],
  'w-alaska-n': ['#9aa79c', '#d7ddd5', '#5f8a6a'],
  'w-alaska-s': ['#d7ddd5', '#5f8a6a', '#9aa79c'],
  'b-training': ['#e3e6ee', '#3d6fd0', '#e3e6ee'],
}

/** Hold colours: the route-setters' tape colours. */
export const HOLD_COLORS = ['#ff3d7f', '#ffd23f', '#3fcf6a', '#2f7bff', '#9b5cff', '#ff8a1f', '#f4f4f4', '#e8322c', '#1f1f22']
/** Volumes: big black and blue shapes on the boulders. */
export const VOLUME_COLORS = ['#1d1d1f', '#2a3fae', '#1d1d1f', '#5b55b0']

/** Pieces outside the hall that nothing in it looks into (Alex's note: "none of that is visible from inside"). */
export const HIDDEN_PIECES = new Set(['stairs-up-1', 'landing-up', 'stairs-up-2', 'p-bathrooms'])

export const BUILDING = {
  wall: '#eef0ec',
  ceiling: '#d9dde1',
  steel: '#7a8089',
  beam: '#6e1f2a',
  duct: '#c4c9cf',
  concrete: '#8d939a',
  pad: '#9a9e9b',
  seam: '#1f2022',
  rail: '#d0302a',
  ropeZone: '#232325',
  daylight: '#dcefff',
  strip: '#fff8e6',
  doorGlass: '#33475a',
  glass: '#bfe3ff',
}
