import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { gameTime } from '@/core/gameClock'
import { loadGhost } from '@/combat/ghost'
import { sampleGhost, type GhostPoint } from '@/combat/ghostTrack.hot'

/**
 * The ghost of the level's best campaign run (#844): a translucent ring at the aim that run had at this moment of game
 * time, flicking on its shots. It is drawn only and never fires: no hit, kill or score comes from it.
 */
export default function GhostCrosshair() {
  const enabled = useSettingsStore((s) => s.ghost)
  const levelId = useGameStore((s) => (s.runMode.mode === 'campaign' ? s.currentLevel : null))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const track = enabled && levelId ? loadGhost(levelId) : null
    if (!el || !track) return
    el.hidden = false
    const at: GhostPoint = { x: 0, y: 0, index: -1 }
    let last = -1
    let px = NaN
    let py = NaN
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      sampleGhost(track, gameTime(), at)
      const nx = Math.round(at.x * innerWidth)
      const ny = Math.round(at.y * innerHeight)
      // A frozen clock (pause, menus) leaves the ring where it is: no style write.
      if (nx !== px || ny !== py) {
        px = nx
        py = ny
        el.style.transform = `translate(${nx}px, ${ny}px)`
      }
      if (at.index !== last && track.shot[at.index]) {
        // Restart the flick's animation.
        el.classList.remove('is-firing')
        void el.offsetWidth
        el.classList.add('is-firing')
      }
      last = at.index
    }
    frame()
    return () => {
      cancelAnimationFrame(raf)
      el.hidden = true
    }
  }, [enabled, levelId])

  return <div ref={ref} className="ghost-crosshair" hidden />
}
