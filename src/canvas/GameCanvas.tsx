import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { Leva } from 'leva'
import * as THREE from 'three'
import SceneManager from './SceneManager'
import { useSettingsStore } from '@/store/useSettingsStore'

export default function GameCanvas() {
  const showFPS = useSettingsStore((s) => s.showFPS)

  return (
    <>
      <Leva hidden={!showFPS} collapsed />
      <Canvas
        gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
        dpr={[1, 2]}
        style={{ position: 'fixed', inset: 0 }}
      >
        <SceneManager />
        {showFPS && <Stats />}
      </Canvas>
    </>
  )
}
