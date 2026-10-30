/** Pure keyboard rules for the pause menu (no React / DOM, unit-tested). */

export type PauseMenuAction = 'resume' | 'restart' | 'settings' | 'quit'

export const PAUSE_MENU: readonly { action: PauseMenuAction; label: string }[] = [
  { action: 'resume', label: 'Resume' },
  { action: 'restart', label: 'Restart' },
  { action: 'settings', label: 'Settings' },
  { action: 'quit', label: 'Quit' },
]

/** The button index a key moves focus to (wrapping), or null if the key isn't a menu move. */
export function pauseMenuFocus(from: number, key: string, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (from + 1) % count
    case 'ArrowUp':
    case 'ArrowLeft':
      return (from - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
