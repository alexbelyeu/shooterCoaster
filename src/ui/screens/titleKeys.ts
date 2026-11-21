/** Title "press any key": which key presses start a run and which open the worlds. Pure so it is unit-tested. */

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

/** W and Escape open the level select (#329); S is the mute shortcut (`MuteButton`), so it does neither. */
export function titleAction(e: TitleKey): TitleAction | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return null
  if (e.key === 'Escape' || e.key === 'w' || e.key === 'W') return 'worlds'
  if (e.key.length === 1) return e.key === 's' || e.key === 'S' ? null : 'play'
  return START_KEYS.has(e.key) ? 'play' : null
}
