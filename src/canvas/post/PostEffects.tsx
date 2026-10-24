import { useEffect, useLayoutEffect, useMemo } from 'react'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { COMPOSER_MULTISAMPLING } from '../useRenderBudget'
import { ColourGradeEffect } from './ColourGradeEffect'
import type { GradeConfig } from './colourGrade'

export interface BloomSettings {
  threshold: number
  intensity: number
}

/** Bloom, grade + vignette and ACES tone mapping: all three merge into one EffectPass. */
export default function PostEffects({ bloom, grade }: { bloom: BloomSettings; grade: GradeConfig }) {
  // One instance: a grade change only updates uniforms, it never rebuilds the EffectPass
  const gradeEffect = useMemo(() => new ColourGradeEffect(), [])
  useEffect(() => () => gradeEffect.dispose(), [gradeEffect])
  useLayoutEffect(() => gradeEffect.setGrade(grade), [gradeEffect, grade])

  return (
    <EffectComposer multisampling={COMPOSER_MULTISAMPLING}>
      <Bloom
        luminanceThreshold={bloom.threshold}
        luminanceSmoothing={0.4}
        intensity={bloom.intensity}
        mipmapBlur
      />
      <primitive object={gradeEffect} dispose={null} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
