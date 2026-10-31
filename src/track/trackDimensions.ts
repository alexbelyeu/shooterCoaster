import type { TrackParams } from '@/types/level'

/**
 * Coaster structure dimensions, derived from the level's track params.
 *
 * Track curves are multiplied by `scalar` (Theme Park 20 … Desert 60), so a
 * fixed-size rail reads as thin wire on big tracks. `trackScale` grows the
 * rails, ties, towers and the rider's eye height together, so the near view is
 * identical on every level while distant track stays legible on large levels.
 * It grows with sqrt(scalar) rather than linearly: a 3x larger track gets
 * ~1.7x thicker steel — chunky but not cartoonish next to fixed-size enemies.
 */
export interface TrackDimensions {
  /** Multiplier applied to every structural dimension below (1 at scalar 20). */
  trackScale: number
  /** Running-rail tube radius (world units). */
  railRadius: number
  /** Half the distance between the two running rails. */
  railGauge: number
  /** Spine tube radius. */
  spineRadius: number
  /** Spine centre offset below the rail plane (negative = down). */
  spineOffset: number
  /** Arc-length spacing between cross ties. */
  tieSpacing: number
  /** Thickness of a cross tie along the track. */
  tieThickness: number
  /** Arc-length spacing between support towers (before the triangle budget widens it). */
  towerSpacing: number
  /** Rider eye height above the rail plane (camera heightOffset). */
  eyeHeight: number
}

export const BASE_SCALAR = 20
export const DEFAULT_RAIL_RADIUS = 0.35
export const DEFAULT_TIE_SPACING = 10
export const DEFAULT_TOWER_SPACING = 50

/** Projected radius (drawing-buffer px) far rails and spine never thin below. */
export const RAIL_MIN_PIXEL_RADIUS = 1.5
/** The same floor for tower legs, braces and cross-beams: about one pixel wide. */
export const LATTICE_MIN_PIXEL_RADIUS = 0.5

/** World radius that projects to `minPixelRadius` px at view-space `depth`; `projScaleY` = projectionMatrix[1][1]. */
export function minWorldRadius(
  depth: number,
  minPixelRadius: number,
  projScaleY: number,
  viewportHeightPx: number,
): number {
  return (2 * Math.max(0, depth) * minPixelRadius) / (projScaleY * viewportHeightPx)
}

/** Outward push for a part `radius` thick; 0 wherever it is already thicker than the floor. */
export function minThicknessPush(
  radius: number,
  depth: number,
  minPixelRadius: number,
  projScaleY: number,
  viewportHeightPx: number,
): number {
  return Math.max(0, minWorldRadius(depth, minPixelRadius, projScaleY, viewportHeightPx) - radius)
}

export function getTrackScale(scalar: number): number {
  return Math.min(2.5, Math.max(1, Math.sqrt(scalar / BASE_SCALAR)))
}

export function getTrackDimensions(
  track: Pick<TrackParams, 'scalar' | 'railRadius' | 'tieSpacing'>,
): TrackDimensions {
  const s = getTrackScale(track.scalar)
  return {
    trackScale: s,
    railRadius: (track.railRadius ?? DEFAULT_RAIL_RADIUS) * s,
    railGauge: 2 * s,
    spineRadius: 0.7 * s,
    spineOffset: -1.4 * s,
    tieSpacing: (track.tieSpacing ?? DEFAULT_TIE_SPACING) * s,
    tieThickness: 0.6 * s,
    towerSpacing: DEFAULT_TOWER_SPACING * s,
    eyeHeight: 6 * s,
  }
}
