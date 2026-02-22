/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Random float in [min, max) */
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

/** Random float biased toward low end */
export function randomRangeLow(min: number, max: number): number {
  return min + Math.pow(Math.random(), 2) * (max - min)
}
