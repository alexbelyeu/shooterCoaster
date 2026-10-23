import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import * as THREE from 'three'
import SceneManager from './SceneManager'
import { useSettingsStore } from '@/store/useSettingsStore'
import { isE2E, E2EFrameProbe } from '@/testing/e2eHook'

export default function GameCanvas() {
  const showFPS = useSettingsStore((s) => s.showFPS)

  return (
    <Canvas
      gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
      dpr={[1, 2]}
      style={{ position: 'fixed', inset: 0 }}
    >
      <SceneManager />
      {showFPS && <Stats />}
      {isE2E && <E2EFrameProbe />}
    </Canvas>
  )
}
