import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { gameTime } from '@/core/gameClock'
import { loadGhost } from '@/combat/ghost'
import { sampleGhost, type GhostPoint, type GhostTrack } from '@/combat/ghostTrack.hot'
import { dailyGhost } from '@/app/dailyGhost'

/** Shows `el` and moves it along `track` every frame until the returned stop hides it again. */
function play(el: HTMLDivElement, track: GhostTrack): () => void {
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
}

/**
 * A ghost run (#844): a translucent ring at the aim that run had at this moment of game time, flicking on its shots.
 * A campaign run rides with the level's best local run, a Daily Run with the day's World best (#1042, `app/dailyGhost`).
 * It is drawn only and never fires: no hit, kill or score comes from it.
 */
export default function GhostCrosshair() {
  const enabled = useSettingsStore((s) => s.ghost)
  const levelId = useGameStore((s) => (s.runMode.mode === 'campaign' ? s.currentLevel : null))
  const day = useGameStore((s) => (s.runMode.mode === 'daily' ? s.runMode.dateKey : null))
  const runId = useGameStore((s) => s.runId)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const ghost = levelId ? Promise.resolve(loadGhost(levelId)) : day ? dailyGhost(day, runId) : null
    if (!el || !enabled || !ghost) return
    let stop: (() => void) | undefined
    let live = true
    void ghost.then((track) => {
      if (live && track) stop = play(el, track)
    })
    return () => {
      live = false
      stop?.()
    }
  }, [enabled, levelId, day, runId])

  return <div ref={ref} className="ghost-crosshair" hidden />
}
