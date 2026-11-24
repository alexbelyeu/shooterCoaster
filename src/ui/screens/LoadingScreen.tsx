import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { phaseAfterLoading } from '@/store/startPhase'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { loadLevelScene } from '@/canvas/loadLevelScene'
import { loadPlayScreens } from '@/app/lazyScreens'
import { isAudioReady } from '@/audio/AudioEngine'
import { loadFraction, reportLoad } from '@/core/loadProgress'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import { FairBoard } from '@/ui/Fair'
import LevelPostcard from './LevelPostcard'

/**
 * Frames of the finished level drawn under the screen before it lifts: the first frames that draw the whole level
 * (the warm-up hid it) are its slowest.
 */
const SETTLE_FRAMES = 3

/**
 * The run's loading screen (#674): a fair board with the level's postcard and name over a gilt track filling for what
 * it waits on (`core/loadProgress.ts`: the level chunk, the scene's mount, the whole shader warm-up and, once audio is
 * unlocked, the SFX bake and the score's start). It ends once all of it is done and the level has drawn, so nothing heavy runs in the intro or the
 * countdown after it.
 */
export default function LoadingScreen() {
  const levelId = useGameStore((s) => s.currentLevel)
  const level = levelId ? getLevelConfig(levelId) : undefined
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    // The level core, then the level's world chunk (#862), and the run's screens (HUD, countdown, results:
    // `app/lazyScreens.tsx`). A failure returns to the title, where `app/staleReload.ts` reloads the page (#888).
    const biome = levelId ? getLevelConfig(levelId)?.biome : undefined
    if (biome) {
      Promise.all([loadLevelScene().then((core) => core.loadWorld(biome)), loadPlayScreens()]).then(
        () => live && reportLoad(levelId, 'chunk', 1),
        () => {
          const s = useGameStore.getState()
          if (live && s.phase === 'loading') s.setPhase('title')
        },
      )
    }
    let settled = 0
    let frame = 0
    const tick = () => {
      const s = useGameStore.getState()
      if (s.phase !== 'loading' || s.currentLevel !== levelId) return
      const fraction = loadFraction(isAudioReady() ? undefined : 'audio')
      if (bar.current) bar.current.style.transform = `scaleX(${fraction})`
      settled = fraction >= 1 - 1e-9 && s.sceneReady ? settled + 1 : 0
      if (settled > SETTLE_FRAMES) s.setPhase(phaseAfterLoading(s.skipIntro, prefersReducedMotion()))
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      live = false
      cancelAnimationFrame(frame)
    }
  }, [levelId])

  return (
    <div className="loading-screen" role="status" aria-label={`Loading ${level?.name ?? 'level'}`}>
      <FairBoard className="loading-card" shadowClassName="loading-board-shadow fair-arrive">
        {level && <LevelPostcard biome={level.biome} />}
        <h2 className="fair-title loading-name">{level?.name}</h2>
        {level && <p className="loading-desc">{level.description}</p>}
        <div className="loading-bar" aria-hidden="true">
          <div ref={bar} className="loading-bar-fill" />
        </div>
      </FairBoard>
    </div>
  )
}
