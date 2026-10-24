import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import * as THREE from 'three'
import SceneManager from './SceneManager'
import { useSettingsStore } from '@/store/useSettingsStore'
import { isE2E, E2EFrameProbe } from '@/testing/e2eHook'
import { useBudgetDpr } from './useRenderBudget'

export default function GameCanvas() {
  const showFPS = useSettingsStore((s) => s.showFPS)
  const dpr = useBudgetDpr()

  return (
    <Canvas
      // The EffectComposer renders into its own multisampled target, so canvas MSAA is wasted.
      gl={{ antialias: false, alpha: false, toneMapping: THREE.NoToneMapping }}
      dpr={dpr}
      style={{ position: 'fixed', inset: 0 }}
    >
      <SceneManager />
      {showFPS && <Stats />}
      {isE2E && <E2EFrameProbe />}
    </Canvas>
  )
}
