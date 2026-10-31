import { useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import * as THREE from 'three'
import SceneManager from './SceneManager'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGameStore } from '@/store/useGameStore'
import { isE2E, E2EFrameProbe } from '@/testing/e2eHook'
import { adaptiveDprTick, createAdaptiveDpr } from './adaptiveDpr'
import { getAdaptiveSteps, setAdaptiveSteps, useCanvasDpr } from './useRenderBudget'

/**
 * `auto` quality: times the frames of play (not the countdown's shader warm-up, not a pause)
 * and lowers the pixel budget when they run slow. Off under `?e2e=1`, so the smoke's dpr checks hold.
 */
function AdaptiveDpr() {
  // Mounted again after a switch away from `auto` and back: carries on from the steps taken.
  const [state] = useState(() => createAdaptiveDpr(getAdaptiveSteps()))
  useFrame((_, delta) => {
    if (useGameStore.getState().phase !== 'playing') return
    if (adaptiveDprTick(state, delta * 1000)) setAdaptiveSteps(state.steps)
  })
  return null
}

export default function GameCanvas() {
  const showFPS = useSettingsStore((s) => s.showFPS)
  const adaptive = useSettingsStore((s) => s.quality === 'auto') && !isE2E
  const dpr = useCanvasDpr()

  return (
    <Canvas
      // The EffectComposer renders into its own multisampled target, so canvas MSAA is wasted.
      gl={{ antialias: false, alpha: false, toneMapping: THREE.NoToneMapping }}
      dpr={dpr}
      style={{ position: 'fixed', inset: 0 }}
    >
      <SceneManager />
      {adaptive && <AdaptiveDpr />}
      {showFPS && <Stats />}
      {isE2E && <E2EFrameProbe />}
    </Canvas>
  )
}
