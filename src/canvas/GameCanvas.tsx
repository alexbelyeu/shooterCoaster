import { lazy, Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import * as THREE from 'three'
import SceneManager from './SceneManager'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGameStore } from '@/store/useGameStore'
import { isE2E, E2EFrameProbe } from '@/testing/e2eHook'
import { adaptiveDprTick, createAdaptiveDpr } from './adaptiveDpr'
import { getAdaptiveSteps, setAdaptiveSteps, useCanvasDpr } from './useRenderBudget'
import TelemetryFrameProbe from '@/telemetry/TelemetryFrameProbe'
import { telemetryActive } from '@/telemetry/playerTelemetry'
import { dismissPoster, posterShown } from '@/app/poster'
import { perfRequested } from '@/perf/perfFlag'

const PerfProbe = lazy(() => import('@/perf/PerfProbe'))

/** Frames the canvas draws under the poster before it fades: the first can still be compiling its shaders. */
const POSTER_FRAMES = 2

/** Fades the HTML poster (index.html) out once the canvas has drawn real frames, whichever scene they are. */
function PosterHandoff({ onDone }: { onDone: () => void }) {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current < POSTER_FRAMES) return
    // The next animation frame: this one has been rendered by then.
    requestAnimationFrame(dismissPoster)
    onDone()
  })
  return null
}

/**
 * `auto` quality: times the frames of play and of the title (not the countdown's shader warm-up, not a pause or a menu)
 * and lowers the pixel budget when they run slow. Off under `?e2e=1`, so the smoke's dpr checks hold.
 */
function AdaptiveDpr() {
  // Mounted again after a switch away from `auto` and back: carries on from the steps taken.
  const [state] = useState(() => createAdaptiveDpr(getAdaptiveSteps()))
  useFrame((_, delta) => {
    const { phase } = useGameStore.getState()
    if (phase !== 'playing' && phase !== 'title') return
    if (adaptiveDprTick(state, delta * 1000)) setAdaptiveSteps(state.steps)
  })
  return null
}

export default function GameCanvas() {
  const showFPS = useSettingsStore((s) => s.showFPS)
  const adaptive = useSettingsStore((s) => s.quality === 'auto') && !isE2E
  const dpr = useCanvasDpr()
  const [poster, setPoster] = useState(posterShown)

  return (
    <Canvas
      // The EffectComposer renders into its own multisampled target, so canvas MSAA is wasted.
      gl={{ antialias: false, alpha: false, toneMapping: THREE.NoToneMapping }}
      dpr={dpr}
      style={{ position: 'fixed', inset: 0 }}
    >
      <SceneManager />
      {poster && <PosterHandoff onDone={() => setPoster(false)} />}
      {adaptive && <AdaptiveDpr />}
      {showFPS && <Stats />}
      {isE2E && <E2EFrameProbe />}
      {telemetryActive() && <TelemetryFrameProbe />}
      {perfRequested() && (
        <Suspense fallback={null}>
          <PerfProbe />
        </Suspense>
      )}
    </Canvas>
  )
}
