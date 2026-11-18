import { useEffect, useLayoutEffect, useMemo } from 'react'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { isCoarsePointer, useComposerMultisampling, useQualityProfile } from '../useRenderBudget'
import { ColourGradeEffect } from './ColourGradeEffect'
import { HeatShimmerEffect } from './HeatShimmerEffect'
import { freeComposerTargets } from './composerTargets'
import type { GradeConfig } from './colourGrade'

export interface BloomSettings {
  threshold: number
  intensity: number
}

/**
 * Bloom (not on low quality), the heat shimmer, grade + vignette and ACES tone mapping, merged into one EffectPass;
 * the shimmer needs a depth texture, so only a level that asks for it (not on low quality or touch) pays for one.
 */
export default function PostEffects({ bloom, grade, heatShimmer }: { bloom: BloomSettings; grade: GradeConfig; heatShimmer: boolean }) {
  const quality = useQualityProfile()
  const bloomOn = quality.bloom
  const shimmerOn = heatShimmer && quality.heatShimmer && !isCoarsePointer
  const multisampling = useComposerMultisampling()
  // One instance: a grade change only updates uniforms, it never rebuilds the EffectPass
  const gradeEffect = useMemo(() => new ColourGradeEffect(), [])
  useEffect(() => () => gradeEffect.dispose(), [gradeEffect])
  const shimmerEffect = useMemo(() => new HeatShimmerEffect(), [])
  useEffect(() => () => shimmerEffect.dispose(), [shimmerEffect])
  useLayoutEffect(() => gradeEffect.setGrade(grade), [gradeEffect, grade])

  return (
    <EffectComposer ref={freeComposerTargets} multisampling={multisampling}>
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
      {shimmerOn ? <primitive object={shimmerEffect} dispose={null} /> : <></>}
      <primitive object={gradeEffect} dispose={null} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
