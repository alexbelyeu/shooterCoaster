import type { WeatherKind } from '@/types/level'

/** Seconds the weather takes to sweep in and to clear; the rest of a pulse's `seconds` is its hold. */
export const WEATHER_RAMP = { inS: 1.5, outS: 2 } as const

/**
 * A weather at its height: fog near / far as multiples of the biome's (its colour stays the sky's horizon, or the
 * terrain's edge would show against the dome); streaks with `dir` on screen, `speed` / `length` in world units.
 */
export interface WeatherLook {
  fogNear: number
  fogFar: number
  streaks: number
  color: number
  opacity: number
  dir: readonly [number, number]
  speed: number
  length: number
  width: number
  gust: number
}

export const WEATHER_LOOKS: Record<WeatherKind, WeatherLook> = {
  sandstorm: { fogNear: 0.3, fogFar: 0.3, streaks: 1400, color: 0xc8955a, opacity: 0.55, dir: [1, -0.08], speed: 150, length: 9, width: 0.12, gust: 0.4 },
  blizzard: { fogNear: 0.4, fogFar: 0.32, streaks: 1100, color: 0xf6f9ff, opacity: 0.65, dir: [-0.85, -0.5], speed: 75, length: 3.2, width: 0.22, gust: 0.5 },
}

const smoothstep = (x: number) => x * x * (3 - 2 * x)

/** The pulse's strength `elapsed` game seconds after its wave arrived (NaN: not yet). */
export function weatherEnvelope(seconds: number, elapsed: number): number {
  if (!(elapsed > 0) || elapsed >= seconds) return 0
  const { inS, outS } = WEATHER_RAMP
  if (elapsed < inS) return smoothstep(elapsed / inS)
  const left = seconds - elapsed
  return left < outS ? smoothstep(left / outS) : 1
}

export interface FogRange {
  near: number
  far: number
}

/** Written into `out`: called every frame. */
export function weatherFog(base: { fogNear: number; fogFar: number }, look: WeatherLook, envelope: number, out: FogRange): FogRange {
  out.near = base.fogNear + (base.fogNear * look.fogNear - base.fogNear) * envelope
  out.far = base.fogFar + (base.fogFar * look.fogFar - base.fogFar) * envelope
  return out
}

/** Streaks at full strength, scaled by the quality profile (`particleScale`) and halved on a phone; the envelope scales them. */
export function maxWeatherStreaks(look: WeatherLook, qualityScale: number, coarsePointer: boolean): number {
  return Math.round(look.streaks * qualityScale * (coarsePointer ? 0.5 : 1))
}
