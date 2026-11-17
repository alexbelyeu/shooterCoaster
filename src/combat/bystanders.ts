/**
 * Bystanders (#518), pure: the people a level asks you not to shoot (the gym's climbers). They come with a wave
 * (`EnemyWave.bystanders`), climb like any wall enemy and are never kills; a hit costs `BYSTANDER_PENALTY` and the combo
 * (`bystanderHit.ts`). No React or three.js imports.
 */
import type { EnemyType, EnemyWave } from '@/types/level'

/** Emitted on a bystander hit with a `BystanderHitEvent`, after the penalty has landed. */
export const BYSTANDER_HIT_EVENT = 'bystander:hit'

export interface BystanderHitEvent {
  type: EnemyType
  /** A copy: listeners may keep it. */
  position: { x: number; y: number; z: number }
  penalty: number
}

const NOUNS: Partial<Record<EnemyType, string>> = { climber: 'climbers' }

/** The plural the HUD names them by. */
export function bystanderNoun(type: EnemyType): string {
  return NOUNS[type] ?? 'bystanders'
}

/** The popup at a hit. */
export function bystanderWarning(type: EnemyType): string {
  return `Don't shoot ${bystanderNoun(type)}!`
}

/** The HUD hint that teaches the rule. */
export function bystanderHint(type: EnemyType): string {
  const noun = bystanderNoun(type)
  return `${noun[0].toUpperCase()}${noun.slice(1)} are friends — don't shoot them!`
}

/** Every bystander of a roster. */
export function bystanderCount(waves: readonly EnemyWave[]): number {
  return waves.reduce((sum, w) => sum + (w.bystanders?.count ?? 0), 0)
}

/** The roster's bystander type (the first wave's that has any), or null. */
export function bystanderType(waves: readonly EnemyWave[]): EnemyType | null {
  return waves.find((w) => w.bystanders && w.bystanders.count > 0)?.bystanders?.type ?? null
}
