/** Colour grade settings and their derived uniforms; shader in `ColourGradeEffect.ts`, per-biome values in `atmosphere.ts`. */

export interface GradeConfig {
  /** Linear exposure multiplier, applied before tone mapping */
  exposure: number
  /** White balance: -1 cool (blue) .. +1 warm (amber) */
  temperature: number
  /** White balance: -1 green .. +1 magenta */
  tint: number
  /** sRGB hex pushed into the shadows (only its hue counts; brightness is normalised out) */
  shadowTint: number
  /** sRGB hex pushed into the highlights */
  highlightTint: number
  /** 0 = no split toning, 1 = full tint at the darkest shadows / brightest highlights */
  splitTone: number
  /** Contrast around 18% grey, per RGB channel (1 = neutral) */
  contrast: number
  /** 1 = neutral, 0 = greyscale */
  saturation: number
  /** Extra saturation for muted colours only (0 = none) */
  vibrance: number
  /** Darkening at the screen corners (0..1); the falloff is round at any aspect */
  vignette: number
}

export const NEUTRAL_GRADE: GradeConfig = {
  exposure: 1,
  temperature: 0,
  tint: 0,
  shadowTint: 0x808080,
  highlightTint: 0x808080,
  splitTone: 0,
  contrast: 1,
  saturation: 1,
  vibrance: 0,
  vignette: 0,
}

/** Title / level-select orbit: the old stock vignette (darkness 0.5) and no other grade. */
export const TITLE_GRADE: GradeConfig = { ...NEUTRAL_GRADE, vignette: 0.45 }

/** Rec. 709 luminance weights for linear RGB, shared with the shader. */
export const LUMA: readonly [number, number, number] = [0.2126, 0.7152, 0.0722]

export type Rgb = [number, number, number]

function luma([r, g, b]: Rgb): number {
  return r * LUMA[0] + g * LUMA[1] + b * LUMA[2]
}

function normaliseLuma(c: Rgb): Rgb {
  const l = luma(c)
  return l > 0 ? [c[0] / l, c[1] / l, c[2] / l] : [1, 1, 1]
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Max per-channel gain at temperature / tint ±1. */
const WHITE_BALANCE_RANGE = 0.3

/** RGB gains for a temperature / tint shift, scaled so grey keeps its luminance. */
export function whiteBalanceGains(temperature: number, tint: number): Rgb {
  const t = temperature * WHITE_BALANCE_RANGE
  const m = tint * WHITE_BALANCE_RANGE
  return normaliseLuma([1 + t, 1 - m, 1 - t])
}

/** Linear-space hue of an sRGB hex at luminance 1, so a tint shifts colour without brightening. */
export function hueOf(hex: number): Rgb {
  return normaliseLuma([
    srgbToLinear(((hex >> 16) & 0xff) / 255),
    srgbToLinear(((hex >> 8) & 0xff) / 255),
    srgbToLinear((hex & 0xff) / 255),
  ])
}
