/** Title "press any key": which key presses start a run and which open the worlds. Pure so it is unit-tested. */

import { DEFAULT_BINDINGS, matchesKey, type Bindings } from '@/input/bindings'

export interface TitleKey {
  key: string
  repeat: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

export type TitleAction = 'play' | 'worlds'

/** Named keys that start a run; every other named key (Tab, F5, Shift…) keeps its usual job. */
const START_KEYS = new Set(['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/**
 * Escape and the worlds key (W) open the level select (#329); the mute key (S, `MuteButton`) does neither. Both
 * letters are the player's (`bindings.ts`); a bound named key (Delete…) other than these is not a start key.
 */
export function titleAction(e: TitleKey, b: Bindings = DEFAULT_BINDINGS): TitleAction | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return null
  if (e.key === 'Escape' || matchesKey(b, 'worlds', e.key)) return 'worlds'
  if (matchesKey(b, 'mute', e.key)) return null
  if (e.key.length === 1) return 'play'
  return START_KEYS.has(e.key) ? 'play' : null
}
