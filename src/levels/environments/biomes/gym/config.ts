import * as THREE from 'three'
import type { ColorRamp } from '../../shared/types'
import { GYM_SCALE, HALL, floorAt, piece, toBlockout } from './blockout'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { PlacementBounds } from '@/entities/spawning/spawnPlacement'
import type { WallStyle } from './wallPanels'

/** The hall's floor (the terrain mesh): poured grey concrete, the same at both levels. */
export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0, color: new THREE.Color(0x74777b) },
    { height: 1, color: new THREE.Color(0x74777b) },
  ],
  cliffColor: new THREE.Color(0x74777b),
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
 * Grime (#558, #593, "spectacularly Bushwick"). Baked per panel: every panel a little off its paint, some
 * chalk-caked, some swapped for bare plywood or grey primer patches, boot scuffs along the foot. In the shader
 * (`grimeShader.ts`, fractions taken off the paint): blotches, drips, the foot's grime up to `footHeight` m,
 * floor stains, chalk smudges at hand height, the roof's half shaded to `roofShade`, chalk on the holds' tops.
 */
export const GRIME = {
  chalk: '#e2ddd2',
  plywood: '#b08f62',
  primer: '#8f948f',
  rust: '#7a4a2c',
  seam: 0.45,
  shell: 0.8,
  scuffHeight: 1.1,
  scuff: 0.7,
  blotch: 0.3,
  drips: 0.22,
  foot: 0.45,
  footHeight: 1.6,
  floorStain: 0.3,
  chalkSmudge: 0.4,
  roofShade: 0.78,
  holdChalk: 0.55,
}

/**
 * The strip-light fixtures under the trusses (blockout metres): one row along the hall at each `rows` z (evenly
 * spaced, the grime shader snaps to the nearest), fixtures `length` long at `stripLightXs`, each casting a warm `pool`
 * (reach `reach`, a fraction `uplight` of it spilling up) in the grime shader.
 */
export const STRIP_LIGHTS = { rows: [5, 15, 25, 35], spacing: 8, length: 5, color: '#ffc98a', pool: 1.8, reach: 10, uplight: 0.4 }

/** The fixtures' x along each row: every `spacing` from one `spacing` in to one short of the far end wall. */
export const stripLightXs: readonly number[] = Array.from({ length: Math.ceil(HALL.w / STRIP_LIGHTS.spacing) - 1 }, (_, i) => (i + 1) * STRIP_LIGHTS.spacing)
/** The fixtures' height: just under the trusses' bottom chord. */
export const stripLightY = HALL.h - 4.5 - 0.15

/** The Flame's firelight in the grime shader (#599, scaled with the fire in #669): within `shell` m of the fire it lights every face, since the tongues are on them. */
export const FIRE_LIGHT = { color: '#ff8c3c', strength: 2.4, reach: 11, shell: 5.5, soot: '#1c1712', sootAmount: 0.85 }

/** The maroon steel columns' half-width (blockout metres): they stand 0.5 m off the long walls. */
export const COLUMN_HALF = 0.25

/**
 * The maroon columns' x on the east (z 0) and west (z `HALL.d`) walls: every 8 m, none where the wall opens onto
 * the Training Area (east) or the glass gym room (west). `hallGeometry.ts` builds them; murals keep clear of them.
 */
export function wallColumns(): { east: number[]; west: number[] } {
  const training = piece('floor', 'ewsmmqw')
  const glass = piece('windows', 'win-glassgym')
  const outside = (x: number, centre: number, width: number) => x < centre - width / 2 || x > centre + width / 2
  const xs = Array.from({ length: Math.ceil(HALL.w / 8) - 1 }, (_, i) => (i + 1) * 8)
  return {
    east: xs.filter((x) => outside(x, training.x, training.w)),
    west: xs.filter((x) => outside(x, glass.x, glass.length)),
  }
}

/**
 * Street pieces and tags high on the hall's walls (#593; `murals.ts`), each at its rect's foot centre in a wall
 * frame (`rot` turns it to face into the hall): one on the east wall between the Training Area's banners and the
 * windows above it, one over the glass gym room on the west, tags higher up. Each sits in a stretch of wall clear of
 * the maroon columns (`wallColumns`) and of every window row on its wall, all under the ring beam (H − 5.2 m).
 */
export const MURALS = {
  pieces: [
    { x: 33.5, z: 0, rot: 0, base: 8, w: 21, h: 5.5, seed: 5931, style: { fill: ['#ff4fa3', '#ffd23f', '#2fd0c8'], outline: '#141416', cloud: '#5b55b0', highlight: '#ffffff' } },
    { x: 64, z: HALL.d, rot: 180, base: 12.5, w: 16, h: 8, seed: 5932, style: { fill: ['#ff7a1f', '#e8322c', '#ffd23f'], outline: '#101012', cloud: '#2a7fd4', highlight: '#fff6d8' } },
  ],
  tags: [
    { x: 44, z: HALL.d, rot: 180, base: 18.3, w: 5, h: 2.4, seed: 5933, colour: '#141416' },
    { x: 52, z: 0, rot: 0, base: 15, w: 4.5, h: 2, seed: 5934, colour: '#c7ccd2' },
    { x: 77, z: HALL.d, rot: 180, base: 13, w: 4, h: 2, seed: 5935, colour: '#e8322c' },
  ],
}

/** Hold colours: the route-setters' tape colours. */
export const HOLD_COLORS = ['#ff3d7f', '#ffd23f', '#3fcf6a', '#2f7bff', '#9b5cff', '#ff8a1f', '#f4f4f4', '#e8322c', '#1f1f22']
/** Volumes: big black and blue shapes on the boulders. */
export const VOLUME_COLORS = ['#1d1d1f', '#2a3fae', '#1d1d1f', '#5b55b0']

/** Pieces outside the hall that nothing in it looks into (Alex's note: "none of that is visible from inside"). */
export const HIDDEN_PIECES = new Set(['stairs-up-1', 'landing-up', 'stairs-up-2', 'p-bathrooms'])

/** The building's paint: worn white walls, a dark roof deck over grey steel, Bushwick-dim (#593). */
export const BUILDING = {
  wall: '#d9d7cf',
  ceiling: '#5a5c60',
  steel: '#5a5e63',
  beam: '#5e1a24',
  duct: '#a9afb4',
  concrete: '#74777b',
  pad: '#878b88',
  seam: '#1f2022',
  rail: '#d0302a',
  ropeZone: '#232325',
  daylight: '#b9d6f2',
  strip: '#ffe2b0',
  doorGlass: '#33475a',
  glass: '#bfe3ff',
}
