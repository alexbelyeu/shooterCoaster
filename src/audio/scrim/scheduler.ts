/*
 * Look-ahead scheduler for compiled Scrimshaw scores: each tick hands the events due before
 * `now + lookAhead` to `play`, intro once, then the loop forever. Driven by the audio clock
 * (`AudioContext.currentTime`), never by a timer per note.
 *
 * Ported from Scrimshaw Jukebox (docs/audio/reference/scrimshaw-jukebox.html, `player.tick`),
 * simonw/tools commit 5fc8e8b, Apache-2.0 (docs/audio/reference/LICENSE-scrimshaw-apache-2.0.txt).
 * Modified for ShooterCoaster: no UI or visualiser state, always loops, and `start(at, from)` can
 * begin mid-song so a paused track resumes where it stopped. A tick allocates nothing.
 */

import type { CompiledSong, ScoreEvent, Timeline } from './score'

export const LOOK_AHEAD_S = 0.3
/** Timers are throttled to ~1 s in a hidden tab. */
export const HIDDEN_LOOK_AHEAD_S = 1.6
/** An event this late is still played (at once); later than this it is skipped. */
const LATE_S = 0.03
/** A late event is played this far after now, so its start is never in the past. */
const NUDGE_S = 0.005
/** Events handled per tick at most, so a long stall can't lock the page. */
const MAX_PER_TICK = 5000

/** First event in `tl` at or after `t` (binary search; events are sorted by time). */
function firstAtOrAfter(tl: Timeline, t: number): number {
  let lo = 0, hi = tl.events.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (tl.events[mid].t < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export class ScoreScheduler {
  /** Audio-clock time of song time 0. */
  private startAt = 0
  private inIntro = true
  private i = 0
  /** Song time where the current pass of the timeline starts. */
  private offset = 0
  private ended = false

  constructor(
    readonly song: CompiledSong,
    private readonly play: (ev: ScoreEvent, t: number) => void,
  ) {}

  /** Song time `from` sounds at audio time `at`. */
  start(at: number, from = 0): void {
    const { intro, loop } = this.song
    this.startAt = at - from
    this.ended = false
    if (from < intro.dur || !loop.dur) {
      this.inIntro = true
      this.offset = 0
      this.i = firstAtOrAfter(intro, from)
    } else {
      const pass = Math.floor((from - intro.dur) / loop.dur)
      this.inIntro = false
      this.offset = intro.dur + pass * loop.dur
      this.i = firstAtOrAfter(loop, from - this.offset)
    }
  }

  /** Song time at audio time `now` (negative before the start). */
  position(now: number): number {
    return now - this.startAt
  }

  /** True once a song without a loop has handed out its last event. */
  get done(): boolean {
    return this.ended
  }

  tick(now: number, hidden = false): void {
    if (this.ended) return
    const { intro, loop } = this.song
    const horizon = now + (hidden ? HIDDEN_LOOK_AHEAD_S : LOOK_AHEAD_S)
    let guard = 0
    while (guard++ < MAX_PER_TICK) {
      const tl = this.inIntro ? intro : loop
      if (this.i >= tl.events.length) {
        if (this.inIntro) {
          this.inIntro = false
          this.i = 0
          this.offset = intro.dur
          if (!loop.dur) {
            this.ended = true
            break
          }
          continue
        }
        const next = this.offset + loop.dur
        if (this.startAt + next > horizon) break
        this.i = 0
        this.offset = next
        continue
      }
      const ev = tl.events[this.i]
      const t = this.startAt + this.offset + ev.t
      if (t > horizon) break
      if (t >= now - LATE_S) this.play(ev, Math.max(t, now + NUDGE_S))
      this.i++
    }
  }
}
