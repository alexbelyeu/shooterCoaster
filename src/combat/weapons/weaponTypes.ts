/** The gun's types and the timed pickup state (#185); pure, so keep React / three / store imports out. */

export type PickupWeaponId = 'spread' | 'rapid' | 'piercing'
export type WeaponId = 'blaster' | PickupWeaponId

export interface WeaponType {
  id: WeaponId
  label: string
  /** Also the held-trigger cadence. */
  fireIntervalMs: number
  /** Bullets per pull, fanned horizontally `angleDeg` apart. */
  spread: { count: number; angleDeg: number }
  /** Distinct targets one bullet can hit before it stops. */
  pierce: number
  /** Game seconds. */
  duration: number
  /** Linear RGB 0–1. */
  tracerColor: readonly [number, number, number]
  muzzleColor: readonly [number, number, number]
  tracerWidth: number
  /** The pickup and its HUD badge. */
  uiColor: string
}

export const PICKUP_DURATION_S = 10

export const WEAPONS: Record<WeaponId, WeaponType> = {
  blaster: {
    id: 'blaster', label: 'Blaster', fireIntervalMs: 60, spread: { count: 1, angleDeg: 0 }, pierce: 1, duration: 0,
    tracerColor: [1, 0.55, 0.15], muzzleColor: [1, 0.55, 0.15], tracerWidth: 1, uiColor: '#ff9a3c',
  },
  spread: {
    id: 'spread', label: 'Spread', fireIntervalMs: 60, spread: { count: 3, angleDeg: 4 }, pierce: 1,
    duration: PICKUP_DURATION_S, tracerColor: [1, 0.78, 0.1], muzzleColor: [1, 0.7, 0.05], tracerWidth: 1.2,
    uiColor: '#ffc21f',
  },
  rapid: {
    id: 'rapid', label: 'Rapid', fireIntervalMs: 30, spread: { count: 1, angleDeg: 0 }, pierce: 1,
    duration: PICKUP_DURATION_S, tracerColor: [0.15, 0.85, 1], muzzleColor: [0.2, 0.75, 1], tracerWidth: 0.8,
    uiColor: '#3ee3ff',
  },
  piercing: {
    id: 'piercing', label: 'Piercing', fireIntervalMs: 60, spread: { count: 1, angleDeg: 0 }, pierce: 3,
    duration: PICKUP_DURATION_S, tracerColor: [1, 0.25, 0.85], muzzleColor: [1, 0.3, 0.9], tracerWidth: 1.8,
    uiColor: '#ff52dc',
  },
}

export const PICKUP_WEAPONS: readonly PickupWeaponId[] = ['spread', 'rapid', 'piercing']

export const MAX_PIERCE = Math.max(...Object.values(WEAPONS).map((w) => w.pierce))

/** The run's pickup: `until` is game time (`core/gameClock.ts`), so a pause holds it. */
export interface WeaponState {
  id: PickupWeaponId | null
  until: number
}

export const NO_PICKUP: WeaponState = { id: null, until: 0 }

/** A new pickup replaces (or refreshes) the current one. */
export function applyPickup(id: PickupWeaponId, now: number): WeaponState {
  return { id, until: now + WEAPONS[id].duration }
}

export function activeWeapon(state: WeaponState, now: number): WeaponType {
  return state.id !== null && now < state.until ? WEAPONS[state.id] : WEAPONS.blaster
}

export function pickupRemaining(state: WeaponState, now: number): number {
  if (state.id === null) return 0
  return Math.min(1, Math.max(0, (state.until - now) / WEAPONS[state.id].duration))
}

/** Radians off the aim, one per bullet. */
export function fanAngles(weapon: WeaponType, out: number[]): number[] {
  const { count, angleDeg } = weapon.spread
  out.length = count
  for (let i = 0; i < count; i++) out[i] = ((i - (count - 1) / 2) * angleDeg * Math.PI) / 180
  return out
}
