/**
 * The pacing template every level is timed by (#452): one run length, waves from the first second with the pace
 * rising, the boss two thirds in and its fight ending the run. Levels declare their roster; this fills in the times.
 * Pure: no React, three.js or store imports.
 */
import type { BossType, EnemyWave } from '@/types/level'

/** Every run, every level and the Daily Run: the level timer's length. */
export const RUN_SECONDS = 60

/** Shares of the run: the boss arrives at 2/3 (40 s of 60, a 20 s fight); the waves are spread over the first 3/4 (45 s), so the last one is still about through the boss's tell. */
const BOSS_SHARE = 2 / 3
const WAVE_SPAN_SHARE = 3 / 4
/** A wave arrives by here (33 s of 60), so it has flown in (≤ 2 s, `ENTRY_SECONDS_MAX`) and is shootable by 35 s. */
const LAST_WAVE_SHARE = 0.55

/** The longest fly-in of an arriving enemy (`spawnPlacement.ts`: 1.2 s + up to 0.6 s down a formation). */
export const ENTRY_SECONDS_MAX = 2

export interface PacingTimes {
  bossAt: number
  waveSpan: number
  lastWaveBy: number
}

export function pacingTimes(runSeconds = RUN_SECONDS): PacingTimes {
  return {
    bossAt: Math.round(runSeconds * BOSS_SHARE),
    waveSpan: runSeconds * WAVE_SPAN_SHARE,
    lastWaveBy: Math.floor(runSeconds * LAST_WAVE_SHARE),
  }
}

/** A wave in a level's roster: everything but its time. `weight` (default 1) is its share of the wave span before the next wave arrives. */
export type PacedWave = Omit<EnemyWave, 'spawnDelay'> & { weight?: number }

export interface Roster {
  waves: PacedWave[]
  boss?: BossType
  /** A level without a boss: this wave arrives in the boss's place, so the run still ends on a fight. */
  finale?: Omit<EnemyWave, 'spawnDelay'>
}

export interface PacedLevel {
  enemies: EnemyWave[]
  boss?: { type: BossType; at: number }
}

/** The roster's waves on whole seconds of level time (the spawner reads a whole-second timer) and its boss's arrival. */
export function paceLevel(roster: Roster, runSeconds = RUN_SECONDS): PacedLevel {
  const { waves, boss, finale } = roster
  if (!waves.length) throw new Error('a level needs at least one wave')
  if (boss && finale) throw new Error('a level ends on its boss or a finale wave, not both')
  const { bossAt, waveSpan, lastWaveBy } = pacingTimes(runSeconds)
  const total = waves.reduce((sum, w) => sum + weightOf(w), 0)
  let before = 0
  const enemies: EnemyWave[] = waves.map(({ weight, ...wave }) => {
    const spawnDelay = Math.round((waveSpan * before) / total)
    before += weightOf({ weight })
    return { ...wave, spawnDelay }
  })
  const last = enemies[enemies.length - 1].spawnDelay!
  if (last > lastWaveBy) throw new Error(`the last wave arrives at ${last} s, after ${lastWaveBy} s: give it more weight`)
  if (finale) enemies.push({ ...finale, spawnDelay: bossAt })
  return { enemies, ...(boss ? { boss: { type: boss, at: bossAt } } : {}) }
}

function weightOf(wave: { weight?: number }): number {
  const weight = wave.weight ?? 1
  if (!(weight > 0)) throw new Error(`a wave weight must be positive (got ${weight})`)
  return weight
}
