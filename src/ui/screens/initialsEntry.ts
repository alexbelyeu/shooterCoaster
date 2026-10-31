/** Arcade initials entry on the results screen: letters cycle per slot (pure, unit-tested). */
import { INITIALS_ALPHABET, INITIALS_LENGTH } from '@/store/leaderboard'

export interface InitialsState {
  letters: string
  /** Slot being edited, 0-2. */
  slot: number
}

export function cycleLetter(letters: string, slot: number, step: 1 | -1): string {
  const n = INITIALS_ALPHABET.length
  const i = INITIALS_ALPHABET.indexOf(letters[slot])
  const next = INITIALS_ALPHABET[(((i < 0 ? 0 : i) + step) % n + n) % n]
  return letters.slice(0, slot) + next + letters.slice(slot + 1)
}

export function moveSlot(slot: number, step: 1 | -1): number {
  return Math.max(0, Math.min(INITIALS_LENGTH - 1, slot + step))
}

/**
 * The entry's reaction to a key: the new state, `confirm` for Enter, or null for a key it
 * leaves alone. Up / Down cycle the letter, Left / Right / Backspace move, typing sets and advances.
 */
export function initialsKey(state: InitialsState, key: string): InitialsState | 'confirm' | null {
  const { letters, slot } = state
  switch (key) {
    case 'Enter':
      return 'confirm'
    case 'ArrowUp':
      return { letters: cycleLetter(letters, slot, 1), slot }
    case 'ArrowDown':
      return { letters: cycleLetter(letters, slot, -1), slot }
    case 'ArrowLeft':
    case 'Backspace':
      return { letters, slot: moveSlot(slot, -1) }
    case 'ArrowRight':
      return { letters, slot: moveSlot(slot, 1) }
  }
  if (key.length !== 1) return null
  const letter = key.toUpperCase()
  if (!INITIALS_ALPHABET.includes(letter)) return null
  return { letters: letters.slice(0, slot) + letter + letters.slice(slot + 1), slot: moveSlot(slot, 1) }
}
