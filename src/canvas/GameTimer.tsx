import { useEffect, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { resetComboRuntime, tickCombo } from '@/combat/comboRuntime.hot'
import { endSlowMo, resetSlowMo, tickSlowMo } from '@/combat/slowMo.hot'
import { markStartup } from '@/core/startupMarks'
import { levelTimeHeld, levelTimeStep, noteE2ELevelTime } from '@/testing/e2eState'
import { RUN_SECONDS } from '@/levels/pacing'
import { bossWinEndsAt } from '@/levels/bossWin'
import { eventBus } from '@/core/EventBus'
import { recordGhost, resetGhostRecording } from '@/combat/ghostTrack.hot'
import { gameTime } from '@/core/gameClock'
import { getPointerState } from '@/input/pointerInput'

/**
 * Counts down the level; reset when a run starts (`runId`), from the run's `runStartAt` (a Boss Rush stage starts near its
 * boss, #1011), kept through GO, pause and resume. A boss win with nothing left (`run:cleared`, #961) ends it early, after
 * the defeat's hold; either way the store's `endRun` hears when play ended.
 * Also the frame that owns the combo game clock (`tickCombo`), the slow-mo (`tickSlowMo`) and the ghost's recording (`recordGhost`).
 */
export default function GameTimer() {
  const phase = useGameStore((s) => s.phase)
  const runId = useGameStore((s) => s.runId)

  const elapsed = useRef(0)
  /** The first frame's delta can include the level's load, so counting starts on the second. */
  const running = useRef(false)
  const lastCeiled = useRef(-1)
  /** Level time a boss win ends the run at, or null. */
  const endsAt = useRef<number | null>(null)
  /** Level time of this run's `run:cleared`, or null. */
  const clearedAt = useRef<number | null>(null)

  // A layout effect, so the reset lands in the same commit as the new run and no frame can tick the old run's time.
  useLayoutEffect(() => {
    const { runStartAt, setTimeRemaining } = useGameStore.getState()
    elapsed.current = runStartAt
    running.current = false
    lastCeiled.current = -1
    endsAt.current = null
    clearedAt.current = null
    resetComboRuntime()
    resetSlowMo()
    resetGhostRecording()
    setTimeRemaining(RUN_SECONDS - runStartAt)
  }, [runId])

  useEffect(() => {
    const onCleared = () => {
      if (clearedAt.current !== null) return
      clearedAt.current = elapsed.current
      endsAt.current = bossWinEndsAt(elapsed.current)
    }
    eventBus.on('run:cleared', onCleared)
    return () => eventBus.off('run:cleared', onCleared)
  }, [])

  // However the run reached results (timer, `endLevel`), the slow-mo must not follow it there.
  useEffect(() => {
    if (phase === 'results') endSlowMo()
  }, [phase])
  // Nor out of the level (Quit to the title).
  useEffect(() => () => endSlowMo(true), [])

  useFrame((_, delta) => {
    // The rendered `phase` lags a store change by a render, so a pause from a DOM event (tab hide) is read live.
    const { phase: livePhase, runId: liveRunId, timeScale, shotsFired, setTimeRemaining, endRun } = useGameStore.getState()
    // A Boss Rush's next stage can start playing at once (under the e2e hook): not on this run's time, before its reset.
    if (phase !== 'playing' || livePhase !== 'playing' || liveRunId !== runId) return
    markStartup('firstPlayingFrame')
    if (timeScale === 0) return
    if (running.current) {
      const step = levelTimeStep(delta)
      if (!levelTimeHeld()) elapsed.current += step
      tickCombo(step)
      tickSlowMo(step)
    } else running.current = true
    noteE2ELevelTime(elapsed.current)
    const aim = getPointerState()
    recordGhost(gameTime(), aim.x / window.innerWidth, aim.y / window.innerHeight, shotsFired)

    const remaining = Math.max(0, RUN_SECONDS - elapsed.current)
    const ceiled = Math.ceil(remaining)
    if (ceiled !== lastCeiled.current) {
      lastCeiled.current = ceiled
      setTimeRemaining(remaining)
    }

    if (remaining <= 0 || (endsAt.current !== null && elapsed.current >= endsAt.current)) {
      // A boss win ends between whole seconds: the results' "seconds to spare" reads the exact time left.
      setTimeRemaining(remaining)
      endSlowMo()
      endRun(clearedAt.current ?? elapsed.current)
    }
  })

  return null
}
