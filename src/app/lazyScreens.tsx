import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { lazyChunk } from '@/core/staleBuild'
import { useGameStore } from '@/store/useGameStore'

/**
 * The screens the title's first frame doesn't need (#861): level select and Settings in one chunk, the run's HUD,
 * countdown, pause and results in another. `preloadScreens` fetches both once the title is idle; a screen asked for
 * before then suspends to nothing for the moment its chunk takes. A chunk that fails to load (a deploy took it, #823,
 * or a dropped request) is reported to `app/staleReload.ts` and forgotten, and the screen gives up: back to the title,
 * where the page reloads to fetch it again (#888), instead of a blank screen.
 */
export const loadPlayScreens = lazyChunk(() => import('./playScreens'))
const loadMenuScreens = lazyChunk(() => import('./menuScreens'))

export function preloadScreens(): void {
  loadMenuScreens().catch(() => {})
  loadPlayScreens().catch(() => {})
}

function backToTitle(): void {
  const { phase, setPhase } = useGameStore.getState()
  if (phase !== 'title') setPhase('title')
}

/**
 * Renders nothing for good once its screen failed: the element it holds still points at the rejected `React.lazy`, and
 * a screen leaving under `AnimatePresence` keeps that element, so rendering it again would throw in a loop. The next
 * show mounts a new boundary around the fresh `Lazy`.
 */
class ChunkBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>, onFail: (props: P) => void = backToTitle) {
  const fresh = () => lazy(() => load().then((screen) => ({ default: screen })))
  // `React.lazy` keeps a rejection: a failed screen gets a fresh one, so the next time it shows it fetches again.
  let Lazy = fresh()
  return function LazyScreen(props: P) {
    const fail = () => {
      Lazy = fresh()
      onFail(props)
    }
    return (
      <ChunkBoundary onFail={fail}>
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      </ChunkBoundary>
    )
  }
}

export const LevelSelectScreen = lazyScreen(() => loadMenuScreens().then((m) => m.LevelSelectScreen))
export const SettingsScreen = lazyScreen(
  () => loadMenuScreens().then((m) => m.SettingsScreen),
  (props) => props.onClose(),
)
export const HUD = lazyScreen(() => loadPlayScreens().then((m) => m.HUD))
export const Countdown = lazyScreen(() => loadPlayScreens().then((m) => m.Countdown))
export const Intro = lazyScreen(() => loadPlayScreens().then((m) => m.Intro))
export const PauseScreen = lazyScreen(() => loadPlayScreens().then((m) => m.PauseScreen))
export const ResultsScreen = lazyScreen(() => loadPlayScreens().then((m) => m.ResultsScreen))
export const BossRushResults = lazyScreen(() => loadPlayScreens().then((m) => m.BossRushResults))
export const GhostCrosshair = lazyScreen(() => loadPlayScreens().then((m) => m.GhostCrosshair))
export const ScorePopups = lazyScreen(() => loadPlayScreens().then((m) => m.ScorePopups))
export const WaveAnnouncement = lazyScreen(() => loadPlayScreens().then((m) => m.WaveAnnouncement))
