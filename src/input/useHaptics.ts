import { useEffect } from 'react'
import { eventBus } from '@/core/EventBus'
import { useSettingsStore } from '@/store/useSettingsStore'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import { createHapticState, hapticFor, type HapticEvent, type HapticGates } from './haptics'

/** Where the browser can buzz the device: Chrome on Android (and a no-op on desktop Chrome); never iOS Safari. */
export const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

const state = createHapticState()
const gates: HapticGates = { enabled: true, reducedMotion: false, canVibrate: false }

function buzz(event: HapticEvent): void {
  gates.enabled = useSettingsStore.getState().vibration
  gates.reducedMotion = prefersReducedMotion()
  // Chrome refuses (and logs) a vibrate before the page's first tap; every run starts from one, `?e2e=1` may not.
  gates.canVibrate = canVibrate() && (navigator.userActivation?.hasBeenActive ?? true)
  const pattern = hapticFor(state, event, performance.now(), gates)
  if (pattern !== null) navigator.vibrate(pattern as number | number[])
}

const onKill = () => buzz('kill')
const onWeakPoint = () => buzz('weakPoint')
const onDefeat = () => buzz('defeat')

/** Phone haptics (#995) on the combat and boss bus events, mounted once in `App`. */
export function useHaptics(): void {
  useEffect(() => {
    eventBus.on('enemy:killed', onKill)
    eventBus.on('boss:hit', onWeakPoint)
    eventBus.on('boss:defeated', onDefeat)
    return () => {
      eventBus.off('enemy:killed', onKill)
      eventBus.off('boss:hit', onWeakPoint)
      eventBus.off('boss:defeated', onDefeat)
    }
  }, [])
}
