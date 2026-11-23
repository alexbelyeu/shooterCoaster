/**
 * Colour-vision deficiency checks for the enemies' colours (#838): a dichromat simulation and a perceptual
 * difference, so a test can hold each enemy to a minimum contrast against its biome, a target against the
 * bystanders beside it and the golden balloon against the plain ones, as a deuteranope or protanope sees them.
 *
 * Simulation: Machado, Oliveira & Fernandes 2009, "A Physiologically-based Model for Simulation of Color Vision
 * Deficiency", severity 1.0 (full dichromacy), applied to linear RGB. Difference: Euclidean distance in OKLab
 * (Ottosson 2020), `ΔE_OK`, on a 0..1 lightness scale; its just-noticeable difference is about 0.02.
 *
 * Pure: no three, no DOM. Colours are sRGB hex numbers, as `atmosphere.ts` and `Color.getHex()` give them.
 */

export type Vec3 = readonly [number, number, number]
export type Vision = 'normal' | 'deuteranopia' | 'protanopia'

/** Machado 2009, severity 1.0, linear RGB in and out (rows sum to 1, so greys are unchanged). */
export const MACHADO: Record<Exclude<Vision, 'normal'>, readonly Vec3[]> = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
}

/**
 * The minimum `ΔE_OK` an enemy's colour must keep from what it is seen against, under deuteranopia: 0.1, five
 * just-noticeable differences. The comparison is between material base colours (an emissive, untone-mapped glow
 * added in, `glowColour`), not lit pixels: the sun, shade, the biome's colour grade and fog all move what reaches
 * the screen, so the threshold carries that allowance on top of "noticeably different" — a pair at 0.1 still
 * differs by about a tenth of the lightness scale after shading takes some of it. An enemy is a small target
 * picked out at a glance across a moving scene, not two swatches side by side, which is why the bar is several
 * JNDs rather than one.
 */
export const MIN_DELTA_E = 0.1

/** Protanopia is reported against a softer bar (#838: the rarer deficiency, and red enemies darken under it). */
export const MIN_DELTA_E_PROTAN = 0.07

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
}

/** An sRGB hex number (0xrrggbb) as linear RGB, 0..1. */
export function hexToLinear(hex: number): Vec3 {
  return [
    srgbToLinear(((hex >> 16) & 0xff) / 255),
    srgbToLinear(((hex >> 8) & 0xff) / 255),
    srgbToLinear((hex & 0xff) / 255),
  ]
}

/** Linear RGB back to an sRGB hex number, clamped into gamut. */
export function linearToHex(rgb: Vec3): number {
  const byte = (c: number) => Math.round(linearToSrgb(Math.min(1, Math.max(0, c))) * 255)
  return (byte(rgb[0]) << 16) | (byte(rgb[1]) << 8) | byte(rgb[2])
}

/** How a dichromat sees a linear RGB colour (clamped into gamut, as a screen would show it). */
export function simulate(rgb: Vec3, vision: Vision): Vec3 {
  if (vision === 'normal') return rgb
  const m = MACHADO[vision]
  const clamp = (c: number) => Math.min(1, Math.max(0, c))
  return [
    clamp(m[0][0] * rgb[0] + m[0][1] * rgb[1] + m[0][2] * rgb[2]),
    clamp(m[1][0] * rgb[0] + m[1][1] * rgb[1] + m[1][2] * rgb[2]),
    clamp(m[2][0] * rgb[0] + m[2][1] * rgb[1] + m[2][2] * rgb[2]),
  ]
}

/** Linear RGB to OKLab (Ottosson 2020). */
export function linearToOklab(rgb: Vec3): Vec3 {
  const [r, g, b] = rgb
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** `ΔE_OK` between two sRGB hex colours as `vision` sees them. */
export function deltaE(a: number, b: number, vision: Vision = 'normal'): number {
  const la = linearToOklab(simulate(hexToLinear(a), vision))
  const lb = linearToOklab(simulate(hexToLinear(b), vision))
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

/**
 * What a glowing material shows: its base colour plus `emissive × intensity`, in linear light, clamped (an
 * untone-mapped emissive past 1 saturates to the screen's white point per channel).
 */
export function glowColour(base: number, emissive: number, intensity: number): number {
  const b = hexToLinear(base)
  const e = hexToLinear(emissive)
  return linearToHex([b[0] + e[0] * intensity, b[1] + e[1] * intensity, b[2] + e[2] * intensity])
}

/**
 * The contrast an enemy keeps against one colour: its best-contrasting read colour (an enemy reads by any colour
 * that covers a real part of it: the snowman's scarf on snow, the golem's lava seams on black rock).
 */
export function bestContrast(reads: readonly number[], against: number, vision: Vision): number {
  let best = 0
  for (const c of reads) best = Math.max(best, deltaE(c, against, vision))
  return best
}
