/**
 * Combo upkeep ticked by `GameTimer` on playing frames: the game clock, lapsed chains and starting the 5× slow-mo.
 * Emits 'combo:broken' { count, tier } when a 2×+ chain lapses or is broken (`breakCombo`) and 'combo:frenzy' { count } on entering 5×.
 */
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { advanceGameTime, gameTime, resetGameTime } from '@/core/gameClock'
import { FRENZY, TOP_TIER, comboExpired, comboTierIndex } from './comboTiers'
import { requestSlowMo } from './slowMo'

export interface ComboBrokenEvent {
  count: number
  tier: number
}

let prevTier = 0
/** Real playing seconds since this run's last frenzy started. */
let sinceFrenzy = Infinity

const brokenEvent: ComboBrokenEvent = { count: 0, tier: 0 }
const frenzyEvent = { count: 0 }

export function resetComboRuntime(): void {
  resetGameTime()
  prevTier = 0
  sinceFrenzy = Infinity
}

export function tickCombo(delta: number): void {
  const store = useGameStore.getState()

  // Before the clock moves, so a chain that reached 5× and lapses in the same (long) frame still counts.
  const { count, lastKillTime } = store.combo
  const tier = comboTierIndex(count)
  if (tier === TOP_TIER && prevTier < TOP_TIER && sinceFrenzy >= FRENZY.cooldownS) {
    sinceFrenzy = 0
    requestSlowMo('frenzy')
    frenzyEvent.count = count
    eventBus.emit('combo:frenzy', frenzyEvent)
  } else sinceFrenzy += delta
  prevTier = tier

  advanceGameTime(delta * store.timeScale)
  if (comboExpired(count, lastKillTime, gameTime())) breakCombo()
}

/** Ends the chain now: a lapse, or a bystander hit (`bystanderHit.ts`). */
export function breakCombo(): void {
  const store = useGameStore.getState()
  const { count } = store.combo
  const tier = comboTierIndex(count)
  store.resetCombo()
  if (tier >= 1) {
    brokenEvent.count = count
    brokenEvent.tier = tier
    eventBus.emit('combo:broken', brokenEvent)
  }
}
