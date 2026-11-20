import type { EnemyWave, WeatherKind } from '@/types/level'
import type { BoostEnvelope } from './types'

/**
 * A weather at its height: fog near / far as multiples of the biome's (its colour stays the sky's horizon, or the
 * terrain's edge would show against the dome); streaks with `dir` on screen, `speed` / `length` in world units. `pulse` is
 * how it sweeps in, holds and clears from its wave's `weather:start`, on game time (`stepBoost`, as a particle boost).
 */
export interface WeatherLook {
  pulse: BoostEnvelope
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
  sandstorm: { pulse: { riseS: 1.5, holdS: 3.5, fadeS: 2 }, fogNear: 0.3, fogFar: 0.3, streaks: 1400, color: 0xc8955a, opacity: 0.55, dir: [1, -0.08], speed: 150, length: 9, width: 0.12, gust: 0.4 },
  blizzard: { pulse: { riseS: 1.5, holdS: 3.5, fadeS: 2 }, fogNear: 0.4, fogFar: 0.32, streaks: 1100, color: 0xf6f9ff, opacity: 0.65, dir: [-0.85, -0.5], speed: 75, length: 3.2, width: 0.22, gust: 0.5 },
}

/** Game seconds from a pulse's wave to clear sky. */
export function weatherSeconds(kind: WeatherKind): number {
  const { riseS, holdS, fadeS } = WEATHER_LOOKS[kind].pulse
  return riseS + holdS + fadeS
}

/** A level's weather (the kind its waves carry) and the first wave that brings it; null without one. */
export function levelWeather(waves: readonly EnemyWave[]): { kind: WeatherKind; wave: EnemyWave } | null {
  const wave = waves.find((w) => w.weather)
  return wave ? { kind: wave.weather!, wave } : null
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
