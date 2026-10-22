/** Offset of the water surface from y = 0 at world xz; callers pass `clock.elapsedTime` so foam stays in phase with the water. */
export const WATER_WAVE_GLSL = /* glsl */ `
float waterWave(vec2 xz, float t) {
  return sin(xz.x * 0.008 + t * 0.8) * 3.0
       + sin(-xz.y * 0.012 + t * 0.6) * 2.0
       + cos((xz.x - xz.y) * 0.005 + t * 1.1) * 1.5;
}
`
