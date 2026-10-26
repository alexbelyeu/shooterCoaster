/** Title "press any key": which key presses start the game. Pure so it is unit-tested. */

export interface TitleKey {
  key: string
  repeat: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

/** Named keys that count; every other named key (Tab, Escape, F5, Shift…) keeps its usual job. */
const START_KEYS = new Set(['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/** S is the mute shortcut (`MuteButton`), so it never starts the game. */
export function startsGame(e: TitleKey): boolean {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false
  if (e.key.length === 1) return e.key !== 's' && e.key !== 'S'
  return START_KEYS.has(e.key)
}
