import * as THREE from 'three'
import type { ColorRamp } from '../../shared/types'
import { GYM_SCALE, HALL, floorAt, toBlockout } from './blockout'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { PlacementBounds } from '@/entities/spawning/spawnPlacement'
import type { WallStyle } from './wallPanels'

/** The hall's floor (the terrain mesh): poured grey concrete, the same at both levels. */
export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0, color: new THREE.Color(0x8d939a) },
    { height: 1, color: new THREE.Color(0x8d939a) },
  ],
  cliffColor: new THREE.Color(0x8d939a),
}

/** Enemies keep this far (world units, 2.5 m) inside the hall's walls and under its roof. */
export const HALL_INSET = 40

/** The hall's inside, inset (#546): ground waves beside the track would otherwise land behind a wall. */
export const HALL_BOUNDS: PlacementBounds = {
  minX: (-HALL.w / 2) * GYM_SCALE + HALL_INSET,
  maxX: (HALL.w / 2) * GYM_SCALE - HALL_INSET,
  minZ: (-HALL.d / 2) * GYM_SCALE + HALL_INSET,
  maxZ: (HALL.d / 2) * GYM_SCALE - HALL_INSET,
  maxY: HALL.h * GYM_SCALE - HALL_INSET,
}

/** World floor height: the main floor at 0, the Starr pit 2.45 m below it. */
export const gymFloor: HeightFunction = (x, z) => {
  const p = toBlockout({ x, y: 0, z })
  return floorAt(p.x, p.z) * GYM_SCALE
}

/**
 * Paint per profile panel, bottom to top, for walls whose note gives bands (the rest are their `color`).
 * Read from Alex's notes in `blockout.json`; the rugged panels (`wallPanels.ts`) take their band's colour.
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

/**
 * Per-wall panel shapes and paint patterns from Alex's notes (#519): the Shield's big shield-shaped bulge
 * in yellow and black triangles; the Lagoon's blue / purple waves. Other walls get a seeded small bulge or none.
 */
export const WALL_STYLE: Record<string, WallStyle> = {
  'w-shield': { bulge: { along: 0, y: 6.5, halfW: 6.5, halfH: 5.5, amp: 1.4, shield: true }, pattern: 'triangles', triangles: 0.85 },
  'w-lagoon-s': { pattern: 'wave' },
  'w-south-ab': { pattern: 'wave' },
  'b-south': { pattern: 'wave' },
}

/** The Tree (#519): bark from groove to ridge, white panels with green outlines, the green band at the top. */
export const TREE_PAINT = { groove: '#3a2a1f', ridge: '#86643f', panel: '#dbe7d8', outline: '#3f8f4e', top: '#3f8f4e' }

/**
 * Grime (#558, "spectacularly Bushwick"): every panel a little off its paint, some chalk-caked, some swapped
 * for bare plywood or grey primer patches, boot scuffs along the foot.
 */
export const GRIME = { chalk: '#e2ddd2', plywood: '#b08f62', primer: '#8f948f', seam: 0.45, shell: 0.8, scuffHeight: 1.1, scuff: 0.7 }

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
