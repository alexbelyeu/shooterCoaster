## 2026-10-30 — Pause freezes the world; runs reset on `runId`; resume stays `paused` until GO (Builder, #36)

**Context:** Only the level timer stopped while paused: the coaster kept riding, bobbing enemies jumped
(they read the render clock), and Restart from the pause menu under `?e2e=1` (`paused` → `playing`) looked
like a resume to `GameTimer` / `EnemySpawner`, which reset on phase transitions.

**Decision:**
- Gameplay systems keep gating on `phase === 'playing'` (they already did); the coaster camera additionally
  holds at `effectiveDelta = 0` while `paused`. Enemy `updatePosition` gets game time (`gameTime()`, playing
  frames × `timeScale`) instead of `clock.elapsedTime`. Ambient scenery (water, trees, sky, particles) keeps
  wall time on purpose, so the frozen scene behind the menu still breathes.
- A run starts when `startRun` bumps `runId`, not on a phase change. `GameTimer`, `EnemySpawner` and
  `CoasterCamera` reset on it; wave 1 is announced on the run's first `playing`.
- Resume is a store flag, not a phase: `resume()` sets `resuming` while the phase stays `paused`, so
  everything stays frozen through the ~1.2 s Ready / GO and no gate needs a new phase; `Countdown` sets
  `playing` on GO. Any `setPhase` clears `resuming`, so a tab hide or Esc during it pauses again.
- Pause mix: dedicated gain stages after the music duck and on the SFX bus (`setPauseMix`), driven from a store
  subscription (a hidden tab gets no frames): music −12 dB with the slow-mo low-pass, SFX silent.

**Consequences:** New gameplay code that moves things must gate on `playing` (or use game time) to respect
pause. Code that resets per run should key on `runId`.
