/** The pause menu's buttons, in focus order (its keys are `src/ui/menuFocus.ts`). */

export type PauseMenuAction = 'resume' | 'restart' | 'photo' | 'settings' | 'quit'

export const PAUSE_MENU: readonly { action: PauseMenuAction; label: string }[] = [
  { action: 'resume', label: 'Resume' },
  { action: 'restart', label: 'Restart' },
  { action: 'photo', label: 'Photo' },
  { action: 'settings', label: 'Settings' },
  { action: 'quit', label: 'Quit' },
]
