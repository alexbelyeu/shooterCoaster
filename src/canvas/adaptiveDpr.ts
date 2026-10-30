/**
 * Adaptive resolution for the `auto` graphics quality (#35), pure. Steps the pixel budget down,
 * never back up: a resolution that flips back and forth is worse than one that stays a bit soft.
 */

export const SLOW_FRAME_MS = 24
export const SLOW_FOR_S = 2
/** A frame this long is a stall (tab switch, GC, shader compile), not a slow GPU: skipped. */
export const STALL_MS = 250
/** Ignore frames for this long after a step: the canvas resize itself hitches. */
export const SETTLE_S = 1
/** Pixel budget multiplier per step. */
export const BUDGET_STEP = 0.7
export const MAX_STEPS = 4
/** EMA weight of a new frame: one fast frame among slow ones barely moves the average. */
const SMOOTHING = 0.1

export interface AdaptiveDprState {
  avgMs: number
  slowS: number
  settleS: number
  steps: number
}

export function createAdaptiveDpr(steps = 0): AdaptiveDprState {
  return { avgMs: 0, slowS: 0, settleS: 0, steps }
}

/** Feed one frame; true when this frame stepped the budget down (read `state.steps`). */
export function adaptiveDprTick(state: AdaptiveDprState, frameMs: number): boolean {
  if (state.steps >= MAX_STEPS || !(frameMs > 0) || frameMs > STALL_MS) return false
  const frameS = frameMs / 1000
  if (state.settleS > 0) {
    state.settleS = Math.max(0, state.settleS - frameS)
    return false
  }
  state.avgMs = state.avgMs === 0 ? frameMs : state.avgMs + (frameMs - state.avgMs) * SMOOTHING
  state.slowS = state.avgMs > SLOW_FRAME_MS ? state.slowS + frameS : 0
  if (state.slowS < SLOW_FOR_S) return false
  state.steps += 1
  state.slowS = 0
  state.avgMs = 0
  state.settleS = SETTLE_S
  return true
}

/** Pixel budget multiplier after `steps` step-downs. */
export function adaptiveBudgetScale(steps: number): number {
  return BUDGET_STEP ** Math.min(Math.max(0, steps), MAX_STEPS)
}
