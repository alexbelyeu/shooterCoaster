/** Pure keyboard rules shared by the game's menus, the pause menu and the share menu (no React / DOM, unit-tested). */

/** The item index a key moves focus to (wrapping), or null if the key isn't a menu move. `from` -1 is no item focused: down goes to the first, up to the last. */
export function menuFocus(from: number, key: string, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (from + 1) % count
    case 'ArrowUp':
    case 'ArrowLeft':
      return from < 0 ? count - 1 : (from - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** A held Enter / Space: the key repeat would click whatever took focus, as Copy link does when Share opens its menu (#342). */
export function isHeldActivation(key: string, repeat: boolean): boolean {
  return repeat && (key === 'Enter' || key === ' ')
}
