/** Boss rules, pure: only the lowest phase with a live weak point is exposed; all destroyed = defeated. */

export interface WeakPointSpec {
  id: string
  radius: number
  offset: readonly [number, number, number]
  hp: number
  score: number
  phase: number
}

export interface BossSpec {
  name: string
  /** Shown as a `wave:incoming` this long before the boss arrives. */
  tell: { seconds: number; label: string }
  reward: number
  weakPoints: readonly WeakPointSpec[]
}

export interface BossState {
  spec: BossSpec
  /** Per weak point, in `spec.weakPoints` order. */
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

export function hpFraction(state: BossState): number {
  const total = maxHp(state.spec)
  if (total <= 0) return 0
  return state.hp.reduce((sum, h) => sum + Math.max(0, h), 0) / total
}

export function bossMaxScore(spec: BossSpec): number {
  return spec.weakPoints.reduce((sum, w) => sum + w.score, spec.reward)
}

/** Points for the hit `before` → `after` on `id`: its score if that destroyed it, plus the reward if it defeated the boss. */
export function destroyScore(before: BossState, after: BossState, id: string): number {
  const w = after.spec.weakPoints.find((p) => p.id === id)
  if (!w || weakPointHp(before, id) <= 0 || weakPointHp(after, id) > 0) return 0
  return w.score + (isDefeated(after) ? after.spec.reward : 0)
}
