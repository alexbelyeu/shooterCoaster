import { useEffect } from 'react'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake.hot'
import { placeSound, sfx } from '@/audio/sfx'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { KRAKEN_SPLASH_DEATH_STYLE } from '@/effects/deathStyles'
import type { ArcTable } from '@/track/arcLength'
import { TRACK_TUNNEL_EVENT } from '@/track/setPieces'

/** The car hitting the sea: a hard kick (none with reduced motion, `effectiveShakeScale`). */
const SPLASH_TRAUMA = 0.6
const SPLASH_TRAUMA_MS = 500
/** Spray either side of the rails and one dead ahead, this far off the centreline. */
const SPRAY_SIDE = 14

/** The splashdown (#865): spray, a kick and the splash at the portal where the car dives into a glass tunnel. */
export default function Splashdown({ track }: { track: ArcTable }) {
  useEffect(() => {
    const at = new THREE.Vector3()
    const onTunnel = (kind: unknown, index: unknown) => {
      const span = kind === 'enter' && typeof index === 'number' ? track.tunnels?.[index] : undefined
      if (!span?.glass) return
      const i = span.from
      const j = Math.min(i + 4, track.count - 1)
      const fx = track.x[j] - track.x[i]
      const fz = track.z[j] - track.z[i]
      const h = Math.hypot(fx, fz) || 1
      const pool = getExplosionPool()
      for (const [side, ahead] of [[-1, 0], [1, 0], [0, 1]]) {
        at.set(track.x[i] + (-fz / h) * side * SPRAY_SIDE + (fx / h) * ahead * SPRAY_SIDE, 0, track.z[i] + (fx / h) * side * SPRAY_SIDE + (fz / h) * ahead * SPRAY_SIDE)
        pool?.explode(at, KRAKEN_SPLASH_DEATH_STYLE)
      }
      eventBus.emit(CAMERA_TRAUMA_EVENT, SPLASH_TRAUMA, SPLASH_TRAUMA_MS)
      sfx().kill(1, 'splash', placeSound(at))
    }
    eventBus.on(TRACK_TUNNEL_EVENT, onTunnel)
    return () => eventBus.off(TRACK_TUNNEL_EVENT, onTunnel)
  }, [track])
  return null
}
