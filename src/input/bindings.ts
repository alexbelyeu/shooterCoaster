/**
 * Remappable controls (#998): which keyboard key and which gamepad button each action uses, their defaults (the
 * game's keys before #998), and loading them from localStorage. Pure apart from the live copy at the bottom, which
 * the call sites read (`bindings()`, allocation-free once loaded). Rebinding, its conflicts and saving are
 * `bindingsEdit.ts`, which only Settings imports, so the title's startup JS carries none of it.
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

/** Standard-mapping buttons 0–11 are a player's to bind: the face, shoulder, trigger, Back / Start and stick buttons (`padLabel`). The d-pad (12–15) moves through menus and Home (16) belongs to the system. */
export const BINDABLE_PAD_BUTTONS = 12

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

// The live copy: loaded on first read, replaced (never mutated) by `setBindings`, so React can subscribe to it.
let live: Bindings | null = null
const listeners = new Set<() => void>()

export function bindings(): Bindings {
  if (live === null) live = loadBindings(browserStorage())
  return live
}

/** Replaces the live copy and tells the subscribers; `bindingsEdit.ts` `setBindings` also saves it. */
export function replaceBindings(b: Bindings) {
  if (b === live) return
  live = b
  for (const fn of listeners) fn()
}

export function subscribeBindings(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
