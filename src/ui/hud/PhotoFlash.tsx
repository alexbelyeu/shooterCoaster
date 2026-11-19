import { useEffect, useState } from 'react'
import { eventBus } from '@/core/EventBus'
import { RIDE_PHOTO_EVENT } from '@/track/photoMarker'

/** Under e2e: the flash got on screen (it lasts 0.35 s, less than one smoke frame on a software renderer). */
function markFlashed() {
  if (window.__SC_TEST__) window.__SC_TEST__.photo.flashed = true
}

/** The on-ride photo's flash (#701): white over the whole screen, gone in a third of a second (dimmer with reduced motion, in CSS). */
export default function PhotoFlash() {
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    const onPhoto = () => setFlash((n) => n + 1)
    eventBus.on(RIDE_PHOTO_EVENT, onPhoto)
    return () => eventBus.off(RIDE_PHOTO_EVENT, onPhoto)
  }, [])

  if (flash === 0) return null
  return <div key={flash} className="hud-photo-flash" aria-hidden="true" onAnimationStart={markFlashed} onAnimationEnd={() => setFlash(0)} />
}
