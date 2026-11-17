import { Component, lazy, startTransition, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import TitleScene from './TitleScene'
import PostEffects, { type BloomSettings } from './post/PostEffects'
import { TITLE_GRADE } from './post/colourGrade'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { loadLevelScene } from './loadLevelScene'

let LevelScene = lazy(loadLevelScene)

/** A level chunk that failed to load (after its retries): back to the title, and a fresh `lazy` so the next start fetches again. */
class LevelSceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    LevelScene = lazy(loadLevelScene)
    useGameStore.getState().setPhase('title')
    this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const LEVEL_BLOOM: BloomSettings = { threshold: 0.9, intensity: 0.6 }
/** The title's sunset dolly looks into the sun: a higher threshold keeps the sky from blooming over the wheel. */
const TITLE_BLOOM: BloomSettings = { threshold: 0.85, intensity: 0.75 }

export default function SceneManager() {
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)

  const wanted = phase === 'title' || phase === 'levelSelect' || !currentLevel ? null : currentLevel
  // A scene swap renders in a transition (#597): React builds the next scene a few milliseconds at a time over
  // several frames, while the old one keeps drawing, instead of in one long frame.
  const [level, setLevel] = useState(wanted)
  useEffect(() => startTransition(() => setLevel(wanted)), [wanted])
  const biome = level ? getLevelConfig(level)?.biome : undefined

  return (
    <>
      {level ? (
        <LevelSceneBoundary>
          <Suspense fallback={null}>
            <LevelScene levelId={level} />
          </Suspense>
        </LevelSceneBoundary>
      ) : (
        <TitleScene />
      )}
      {/* Keyed so a bloom change remounts the composer; a biome change only updates grade uniforms */}
      <PostEffects
        key={level ? 'level' : 'title'}
        bloom={level ? LEVEL_BLOOM : TITLE_BLOOM}
        grade={biome ? ATMOSPHERES[biome].grade : TITLE_GRADE}
      />
    </>
  )
}
