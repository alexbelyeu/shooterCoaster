/**
 * The layers drawn on the camera over the world, back to front. Each list three draws (opaque,
 * then transparent) sorts by renderOrder first; world objects stay below 100.
 */
export const CAMERA_LAYER_ORDER = {
  /** Transparent: after the world's transparents (water, particles, explosions). */
  streaks: 100,
  /** Opaque, so the depth test (not the order) keeps it over the streaks. */
  gun: 101,
  tracer: 998,
  muzzleFlash: 999,
} as const

/** The gun's vertex shader squeezes it into this front share of the depth range, so it draws over the world. */
export const VIEWMODEL_DEPTH_RANGE = 0.02

/** Clip z (w = 1) just behind the gun's depth range: depth-tested streaks there pass over the world, never over the gun. */
export const BEHIND_VIEWMODEL_CLIP_Z = -1 + 2 * VIEWMODEL_DEPTH_RANGE + 1e-4
