/**
 * Changing the controls (#998), for Settings alone: rebinding with conflicts (taking a key or button another action
 * holds swaps the two, so no action is ever unbound), the pad's button names, and saving. Kept apart from
 * `bindings.ts` so the title's startup JS, which only reads the bindings, carries none of it.
 */

import { browserStorage, type FlagStorage } from '@/app/analyticsGate'
import {
  BINDINGS_STORAGE_KEY,
  DEFAULT_BINDINGS,
  isBindableKey,
  isBindablePadButton,
  normalizeKey,
  replaceBindings,
  type Bindings,
  type KeyAction,
  type PadBindAction,
} from './bindings'

/** The standard mapping's names for the bindable buttons, by index (one per `BINDABLE_PAD_BUTTONS`). */
const PAD_LABELS: readonly string[] = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS']

export function padLabel(button: number): string {
  return PAD_LABELS[button]
}

/** `map` with `action` on `value`; the action that held `value` takes `action`'s old one (a swap), so none is left unbound. */
function rebind<A extends string, V>(map: Readonly<Record<A, V>>, action: A, value: V): Record<A, V> {
  const out: Record<A, V> = { ...map, [action]: value }
  for (const a in map) if (a !== action && map[a] === value) out[a] = map[action]
  return out
}

/**
 * Bind `key` to `action`; returns `b` itself when refused: an unbindable key, or a swap that would hand another
 * action Escape (pause's default, which no press can bind: it cancels the prompt).
 */
export function bindKey(b: Bindings, action: KeyAction, key: string): Bindings {
  const k = normalizeKey(key)
  const keys = rebind(b.keys, action, k)
  return !isBindableKey(k) || (keys.pause !== 'Escape' && Object.values(keys).includes('Escape')) ? b : { ...b, keys }
}

/** Bind a pad button to `action` (`b` itself when refused); a button another action holds swaps the two. */
export function bindPadButton(b: Bindings, action: PadBindAction, button: number): Bindings {
  return isBindablePadButton(button) ? { ...b, pad: rebind(b.pad, action, button) } : b
}

export function isDefault(b: Bindings): boolean {
  return JSON.stringify(b) === JSON.stringify(DEFAULT_BINDINGS)
}

/** Saves the bindings (defaults clear the entry); false when storage can't be written. */
export function saveBindings(b: Bindings, storage: FlagStorage | null): boolean {
  if (!storage) return false
  try {
    if (isDefault(b)) storage.removeItem(BINDINGS_STORAGE_KEY)
    else storage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(b))
    return true
  } catch {
    return false
  }
}

/** Makes `b` the live bindings every call site reads, and saves it. */
export function setBindings(b: Bindings) {
  replaceBindings(b)
  saveBindings(b, browserStorage())
}
