import { lazy, Suspense } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import TitleScene from './TitleScene'
import PostEffects, { type BloomSettings } from './post/PostEffects'
import { TITLE_GRADE } from './post/colourGrade'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { loadLevelScene } from './loadLevelScene'

const LevelScene = lazy(loadLevelScene)

const LEVEL_BLOOM: BloomSettings = { threshold: 0.9, intensity: 0.6 }
const TITLE_BLOOM: BloomSettings = { threshold: 0.8, intensity: 0.8 }

export default function SceneManager() {
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)

  const level = phase === 'title' || phase === 'levelSelect' || !currentLevel ? null : currentLevel
  const biome = level ? getLevelConfig(level)?.biome : undefined

  return (
    <>
      {level ? (
        <Suspense fallback={null}>
          <LevelScene levelId={level} />
        </Suspense>
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
