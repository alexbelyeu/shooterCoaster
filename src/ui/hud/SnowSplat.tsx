import { useEffect, useState } from 'react'
import { eventBus } from '@/core/EventBus'

/** Emitted by the Yeti with the side (+1 the view's right, −1 its left) when an unshot snowball goes past the camera. */
export const SNOWBALL_SPLAT_EVENT = 'snowball:splat'
/** Emitted by the Kraken when a slam throws the sea at the camera: the side as above, 0 for both edges. */
export const SEA_SPRAY_EVENT = 'sea:spray'

type Kind = 'snow' | 'sea'
const SHOW_MS: Record<Kind, number> = { snow: 450, sea: 700 }
const SIDE_CLASS = { [-1]: 'is-left', 0: 'is-both', 1: 'is-right' } as const

/** A short flash on the screen edge something hit: white for a snowball flying past, a sea-foam spray for a Kraken slam. */
export default function SnowSplat() {
  const [splat, setSplat] = useState<{ n: number; kind: Kind; side: -1 | 0 | 1 } | null>(null)

  useEffect(() => {
    const on = (kind: Kind) => (side: unknown) =>
      setSplat((s) => ({ n: (s?.n ?? 0) + 1, kind, side: side === -1 ? -1 : side === 0 ? 0 : 1 }))
    const onSnow = on('snow')
    const onSea = on('sea')
    eventBus.on(SNOWBALL_SPLAT_EVENT, onSnow)
    eventBus.on(SEA_SPRAY_EVENT, onSea)
    return () => {
      eventBus.off(SNOWBALL_SPLAT_EVENT, onSnow)
      eventBus.off(SEA_SPRAY_EVENT, onSea)
    }
  }, [])

  useEffect(() => {
    if (!splat) return
    const t = setTimeout(() => setSplat(null), SHOW_MS[splat.kind])
    return () => clearTimeout(t)
  }, [splat])

  if (!splat) return null
  return <div key={splat.n} className={`hud-${splat.kind}-splat ${SIDE_CLASS[splat.side]}`} aria-hidden="true" />
}
