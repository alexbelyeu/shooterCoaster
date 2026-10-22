/**
 * GLSL for the ocean surface height, shared by `OceanWater` and anything that must
 * ride the same waves (foam rings). Both read `clock.elapsedTime` as the time, so
 * they stay in phase. Water sits at world y = 0; `waterWave` is the offset from it.
 */
export const WATER_WAVE_GLSL = /* glsl */ `
float waterWave(vec2 xz, float t) {
  return sin(xz.x * 0.008 + t * 0.8) * 3.0
       + sin(-xz.y * 0.012 + t * 0.6) * 2.0
       + cos((xz.x - xz.y) * 0.005 + t * 1.1) * 1.5;
}
`

/** Highest the waves reach above y = 0 (sum of the amplitudes above). */
export const WATER_WAVE_MAX = 6.5
