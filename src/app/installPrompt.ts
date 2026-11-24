/** Holds Chromium's install offer (#999) for Settings' Install row; captured from `main.tsx` because the event can fire before any lazy chunk loads. */

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>
}

let held: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function hold(event: InstallPromptEvent | null) {
  held = event
  for (const l of listeners) l()
}

export function captureInstallPrompt(target: EventTarget): void {
  target.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    hold(e as InstallPromptEvent)
  })
  target.addEventListener('appinstalled', () => hold(null))
}

export const canInstall = (): boolean => held !== null

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** An offer prompts only once: the row hides until the browser offers again. */
export function promptInstall(): void {
  const event = held
  if (!event) return
  hold(null)
  void event.prompt().catch(() => {})
}
