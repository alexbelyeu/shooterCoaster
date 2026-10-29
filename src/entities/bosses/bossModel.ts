/**
 * Boss rules, pure (no React / three): weak points with their own hp, taken in
 * phases. Only the weak points of the lowest phase that still has one alive are
 * exposed (hittable); the boss is defeated when every weak point is destroyed.
 * `BossBase.tsx` drives a scene object from this state; `bossSpecs.ts` has the bosses.
 */

export interface WeakPointSpec {
  id: string
  /** Collision radius, world units. */
  radius: number
  /** Position in the boss's local frame. */
  offset: readonly [number, number, number]
  hp: number
  /** Points when this weak point is destroyed (before the combo multiplier). */
  score: number
  /** 0 first; a phase is exposed once every lower one is destroyed. */
  phase: number
}

export interface BossSpec {
  /** HUD name. */
  name: string
  /** Shown (`wave:incoming` label + edge pulse) this long before the boss arrives. */
  tell: { seconds: number; label: string }
  /** Added to the last weak point's score on defeat. */
  reward: number
  weakPoints: readonly WeakPointSpec[]
}

export interface BossState {
  spec: BossSpec
  /** Hp left per weak point, in `spec.weakPoints` order. */
  hp: readonly number[]
}

export function createBossState(spec: BossSpec): BossState {
  return { spec, hp: spec.weakPoints.map((w) => w.hp) }
}

export function isDefeated(state: BossState): boolean {
  return state.hp.every((h) => h <= 0)
}

/** Lowest phase with a weak point alive, or -1 once defeated. */
export function currentPhase(state: BossState): number {
  let phase = Infinity
  state.spec.weakPoints.forEach((w, i) => {
    if (state.hp[i] > 0 && w.phase < phase) phase = w.phase
  })
  return phase === Infinity ? -1 : phase
}

export function exposedWeakPoints(state: BossState): WeakPointSpec[] {
  const phase = currentPhase(state)
  return state.spec.weakPoints.filter((w, i) => w.phase === phase && state.hp[i] > 0)
}

export function isExposed(state: BossState, id: string): boolean {
  return exposedWeakPoints(state).some((w) => w.id === id)
}

export function weakPointHp(state: BossState, id: string): number {
  const i = state.spec.weakPoints.findIndex((w) => w.id === id)
  return i < 0 ? 0 : state.hp[i]
}

/** One hit on `id`; the same state back if it isn't exposed (unknown, destroyed, a later phase). */
export function applyHit(state: BossState, id: string): BossState {
  if (!isExposed(state, id)) return state
  const i = state.spec.weakPoints.findIndex((w) => w.id === id)
  const hp = state.hp.slice()
  hp[i] -= 1
  return { spec: state.spec, hp }
}

export function maxHp(spec: BossSpec): number {
  return spec.weakPoints.reduce((sum, w) => sum + w.hp, 0)
}

/** Hp left over total hp, 0–1. */
export function hpFraction(state: BossState): number {
  const total = maxHp(state.spec)
  if (total <= 0) return 0
  return state.hp.reduce((sum, h) => sum + Math.max(0, h), 0) / total
}

/** Every weak point plus the reward: the no-combo score for beating the boss. */
export function bossMaxScore(spec: BossSpec): number {
  return spec.weakPoints.reduce((sum, w) => sum + w.score, spec.reward)
}

/** Points for destroying weak point `id`, the hit that took `before` to `after`: its score, plus the reward if that defeated the boss. */
export function destroyScore(before: BossState, after: BossState, id: string): number {
  const w = after.spec.weakPoints.find((p) => p.id === id)
  if (!w || weakPointHp(before, id) <= 0 || weakPointHp(after, id) > 0) return 0
  return w.score + (isDefeated(after) ? after.spec.reward : 0)
}
