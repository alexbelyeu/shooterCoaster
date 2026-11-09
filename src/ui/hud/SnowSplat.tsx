import { useEffect, useState } from 'react'
import { eventBus } from '@/core/EventBus'

/** Emitted by the Yeti with the side (+1 the view's right, −1 its left) when an unshot snowball goes past the camera. */
export const SNOWBALL_SPLAT_EVENT = 'snowball:splat'

const SHOW_MS = 450

/** A short white flash on the screen edge a snowball flew past. */
export default function SnowSplat() {
  const [splat, setSplat] = useState<{ n: number; side: number } | null>(null)

  useEffect(() => {
    const onSplat = (side: unknown) => setSplat((s) => ({ n: (s?.n ?? 0) + 1, side: side === -1 ? -1 : 1 }))
    eventBus.on(SNOWBALL_SPLAT_EVENT, onSplat)
    return () => eventBus.off(SNOWBALL_SPLAT_EVENT, onSplat)
  }, [])

  useEffect(() => {
    if (!splat) return
    const t = setTimeout(() => setSplat(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [splat])

  if (!splat) return null
  return <div key={splat.n} className={`hud-snow-splat ${splat.side > 0 ? 'is-right' : 'is-left'}`} aria-hidden="true" />
}
