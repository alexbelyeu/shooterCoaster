/**
 * Remappable controls (#998): which keyboard key and which gamepad button each action uses, their defaults (the
 * game's keys before #998), conflicts (taking a key another action holds swaps the two, so no action is ever
 * unbound), and load / save in localStorage. Pure apart from the live copy at the bottom, which the call sites
 * read (`bindings()`, allocation-free once loaded) and Settings changes (`setBindings`).
 *
 * Fixed on purpose: Escape is always the way out (closes Settings, the capture prompt, the pause board, the
 * title's worlds), Enter / Space / Tab / arrows stay the menus' keys, the d-pad and left stick stay the pad's menu
 * moves, and the developer's backtick stays the time freeze.
 */

import { browserStorage, type FlagStorage } from '@/app/analyticsGate'
import { PAD } from './gamepadMap.hot'

export const KEY_ACTIONS = ['pause', 'mute', 'replay', 'worlds'] as const
export type KeyAction = (typeof KEY_ACTIONS)[number]

/** `pause` is Start: pause / resume in a run, confirm on a screen (`padAction`). */
export const PAD_ACTIONS = ['fire', 'pause', 'confirm', 'back'] as const
export type PadBindAction = (typeof PAD_ACTIONS)[number]

export interface Bindings {
  readonly keys: Readonly<Record<KeyAction, string>>
  readonly pad: Readonly<Record<PadBindAction, number>>
}

export const DEFAULT_BINDINGS: Bindings = {
  keys: { pause: 'Escape', mute: 's', replay: 'r', worlds: 'w' },
  pad: { fire: PAD.RT, pause: PAD.START, confirm: PAD.A, back: PAD.B },
}

/** Standard-mapping buttons a player may bind: the face, shoulder, trigger, Back / Start and stick buttons. The d-pad (12–15) moves through menus and Home (16) belongs to the system. */
const PAD_LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS']
export const BINDABLE_PAD_BUTTONS = PAD_LABELS.length

/** One spelling per key: letters lower case, so `S` and `s` (Shift, Caps Lock) are the same binding. */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key
}

/** Whether a pressed key can be bound: one printable character, not Space and not the dev backtick. Named keys (Escape, Enter, Tab, arrows, F-keys) keep their jobs. */
export function isBindableKey(key: string): boolean {
  return key.length === 1 && key !== ' ' && key !== '`'
}

export function isBindablePadButton(button: number): boolean {
  return Number.isInteger(button) && button >= 0 && button < BINDABLE_PAD_BUTTONS
}

/** Whether a keydown is the key bound to `action`. */
export function matchesKey(b: Bindings, action: KeyAction, key: string): boolean {
  return b.keys[action] === normalizeKey(key)
}

export function keyLabel(key: string): string {
  return key === 'Escape' ? 'Esc' : key.toUpperCase()
}

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

export const BINDINGS_STORAGE_KEY = 'shootercoaster-bindings'

/** Every action bound, to a key it may hold (its default, or a bindable one), and no two actions sharing one. */
function validate(raw: Bindings): Bindings | null {
  const keys = KEY_ACTIONS.map((a) => raw.keys[a])
  const pad = PAD_ACTIONS.map((a) => raw.pad[a])
  const ok =
    keys.every((k, i) => k === DEFAULT_BINDINGS.keys[KEY_ACTIONS[i]] || (isBindableKey(k) && normalizeKey(k) === k)) &&
    pad.every(isBindablePadButton) &&
    new Set(keys).size === keys.length &&
    new Set(pad).size === pad.length
  return ok ? { keys: raw.keys, pad: raw.pad } : null
}

/** The saved bindings, or the defaults when there are none, storage throws, or what is saved is not a whole, valid set. */
export function loadBindings(storage: FlagStorage | null): Bindings {
  try {
    const json = storage?.getItem(BINDINGS_STORAGE_KEY)
    // A JSON value without `keys` or `pad` throws in `validate`, as storage itself may: both are the defaults.
    return (json && validate(JSON.parse(json) as Bindings)) || DEFAULT_BINDINGS
  } catch {
    return DEFAULT_BINDINGS
  }
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

// The live copy: loaded on first read, replaced (never mutated) by `setBindings`, so React can subscribe to it.
let live: Bindings | null = null
const listeners = new Set<() => void>()

export function bindings(): Bindings {
  if (live === null) live = loadBindings(browserStorage())
  return live
}

export function setBindings(b: Bindings) {
  if (b === live) return
  live = b
  saveBindings(b, browserStorage())
  for (const fn of listeners) fn()
}

export function subscribeBindings(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
