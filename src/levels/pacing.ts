/** The pacing template every level is timed by (#452): a level declares its roster, this fills in the seconds. */
import type { BossType, EnemyWave } from '@/types/level'

export const RUN_SECONDS = 60

/** Boss at 2/3 of the run, a ~20 s fight that ends it; waves over the first 3/4, so the last is still about through the boss's tell. */
const BOSS_SHARE = 2 / 3
const WAVE_SPAN_SHARE = 3 / 4
const LAST_WAVE_SHARE = 0.55

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

/** `weight` (default 1): the wave's share of the wave span before the next one arrives. */
export type PacedWave = Omit<EnemyWave, 'spawnDelay'> & { weight?: number }

export interface Roster {
  waves: PacedWave[]
  boss?: BossType
  /**
   * The boss's second, when the template's (2/3 of the run) leaves it too little of the ride in view: level 3's Kraken from
   * 38 s, so a fight of 12 s or more ends before the track dives under the sea at ~52 s (#1059). After the last wave.
   */
  bossAt?: number
  /** For a level without a boss: arrives in the boss's place. */
  finale?: Omit<EnemyWave, 'spawnDelay'>
  /**
   * The hard route's own wave (#720), outside the weighted waves: it arrives at level second `at`, timed to the junction's
   * branch (after its switch sign, before its merge), and only on a run that took it (`EnemyWave.route`).
   */
  branch?: Omit<EnemyWave, 'spawnDelay' | 'route'> & { at: number }
}

export interface PacedLevel {
  enemies: EnemyWave[]
  boss?: { type: BossType; at: number }
}

/** Whole seconds: the spawner reads the stored timer, which changes once a second. */
export function paceLevel(roster: Roster, runSeconds = RUN_SECONDS): PacedLevel {
  const { waves, boss, finale, branch } = roster
  if (!waves.length) throw new Error('no waves')
  if (boss && finale) throw new Error('a boss or a finale, not both')
  const times = pacingTimes(runSeconds)
  const { waveSpan, lastWaveBy } = times
  const bossAt = roster.bossAt ?? times.bossAt
  const total = waves.reduce((sum, w) => sum + weightOf(w), 0)
  let before = 0
  const enemies: EnemyWave[] = waves.map(({ weight, ...wave }) => {
    const spawnDelay = Math.round((waveSpan * before) / total)
    before += weight ?? 1 // checked by `total`
    return { ...wave, spawnDelay }
  })
  const last = enemies[enemies.length - 1].spawnDelay!
  if (last > lastWaveBy) throw new Error(`last wave at ${last} s, after ${lastWaveBy} s`)
  if (!Number.isInteger(bossAt) || bossAt <= last) throw new Error(`boss at ${bossAt} s: a whole second after the last wave`)
  if (finale) enemies.push({ ...finale, spawnDelay: bossAt })
  if (branch) {
    const { at, ...wave } = branch
    if (!Number.isInteger(at) || at <= 0 || at >= bossAt) throw new Error(`branch at ${at} s: a whole second before ${bossAt} s`)
    // Last, so the waves every run meets keep their seeded slots.
    enemies.push({ ...wave, route: 'hard', spawnDelay: at })
  }
  return { enemies, ...(boss ? { boss: { type: boss, at: bossAt } } : {}) }
}

function weightOf(wave: { weight?: number }): number {
  const weight = wave.weight ?? 1
  if (!(weight > 0)) throw new Error(`weight ${weight}: must be positive`)
  return weight
}
