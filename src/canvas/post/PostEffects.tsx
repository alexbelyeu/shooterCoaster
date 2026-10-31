import { useEffect, useLayoutEffect, useMemo } from 'react'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useComposerMultisampling, useQualityProfile } from '../useRenderBudget'
import { ColourGradeEffect } from './ColourGradeEffect'
import type { GradeConfig } from './colourGrade'

export interface BloomSettings {
  threshold: number
  intensity: number
}

/** Bloom (not on low quality), grade + vignette and ACES tone mapping: all three merge into one EffectPass. */
export default function PostEffects({ bloom, grade }: { bloom: BloomSettings; grade: GradeConfig }) {
  const bloomOn = useQualityProfile().bloom
  const multisampling = useComposerMultisampling()
  // One instance: a grade change only updates uniforms, it never rebuilds the EffectPass
  const gradeEffect = useMemo(() => new ColourGradeEffect(), [])
  useEffect(() => () => gradeEffect.dispose(), [gradeEffect])
  useLayoutEffect(() => gradeEffect.setGrade(grade), [gradeEffect, grade])

  return (
    <EffectComposer multisampling={multisampling}>
      {bloomOn ? (
        <Bloom
          luminanceThreshold={bloom.threshold}
          luminanceSmoothing={0.4}
          intensity={bloom.intensity}
          mipmapBlur
        />
      ) : (
        // The composer's children type takes no `false`.
        <></>
      )}
      <primitive object={gradeEffect} dispose={null} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
