/**
 * Settled level steps (#471): the same level, step by step, on any runner.
 *
 * A fixed `timerStep` alone doesn't make a run repeatable. Waves, enemy mounts, fly-ins ending (`entered`) and boss
 * arrivals go through React state, so they land a frame or more after the frame that caused them, and how many frames
 * depends on the runner (a slow frame can run before React's queued render). At 0.5 s of level time a frame, one frame of
 * that latency moved enemies half a second: the pacing gaps and the ride shot's enemy count differed between runs and
 * between a local session and CI.
 *
 * `__SC_STEP_SETTLED__(step, settled)` advances level time `step` seconds on one frame, then holds it (`timerStep` 0:
 * level timer, game clock and ride all stand still) until React has gone quiet: a held frame with no commit since the
 * last one and a message posted on that frame answered (so the tasks React queued before it have run). Then it calls
 * `settled()`, which samples, holds on (`'hold'`: no step yet, e.g. while the level scene loads) or stops the run
 * (`false`, handing level time back to the frame time), and takes the next step. Every step is thus taken from the same
 * settled state whatever the frame rate; only the number of held frames between steps varies.
 *
 * React reports commits to the devtools hook, which `installSettledStepper` defines before the page's scripts run
 * (`ctx.addInitScript`); React reads it once, as it loads. Passed to the page as a function, so it is self-contained.
 */
export function installSettledStepper() {
  const probe = { commits: 0 }
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      isDisabled: false,
      renderers: new Map(),
      inject: () => 1,
      checkDCE: () => {},
      onCommitFiberRoot: () => { probe.commits++ },
      onPostCommitFiberRoot: () => { probe.commits++ },
      onCommitFiberUnmount: () => {},
    }
  }
  window.__SC_STEP_SETTLED__ = (step, settled) => {
    const s = window.__SC_TEST__
    const run = { steps: 0, heldFrames: 0, done: false }
    const channel = new MessageChannel()
    let answered = true
    channel.port1.onmessage = () => { answered = true }
    let stepped = false
    let seen = probe.commits
    let quiet = false
    s.timerStep = 0
    // Registered after the game's own frame callback, so it runs after it on every frame: the step set here is
    // taken by exactly one game frame, the next one.
    const frame = () => {
      if (stepped) {
        s.timerStep = 0
        stepped = false
        quiet = false
      } else {
        run.heldFrames++
        quiet = answered && probe.commits === seen
      }
      seen = probe.commits
      if (answered) {
        answered = false
        channel.port2.postMessage(0)
      }
      // `run.overdue`: the caller's deadline passed, settled or not.
      const next = quiet || run.overdue ? settled(run) : 'hold'
      if (next === false) {
        s.timerStep = null
        run.done = true
        channel.port1.close()
        return
      }
      if (next !== 'hold') {
        s.timerStep = step
        stepped = true
        run.steps++
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return run
  }
}
