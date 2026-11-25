import { describe, expect, it } from 'vitest'
import { createRideDeadline } from './rideDeadline.mjs'

const opts = { target: 10, deadlineMs: 40_000, loadMs: 60_000, now: 0 }

describe('createRideDeadline', () => {
  it('lets a slow ride that keeps progressing run past the deadline from its start (#1032)', () => {
    const d = createRideDeadline(opts)
    // 2.2 s a frame, about half a level second each: 50 s in, still short of the target.
    let late = false
    for (let i = 0; i <= 23; i++) late ||= d.overdue({ levelTime: Math.min(10, i * 0.45), frames: i }, 5_000 + i * 2_200)
    expect(late).toBe(false)
  })

  it('goes overdue once level time stops advancing while frames render (a step that never settles)', () => {
    const d = createRideDeadline(opts)
    expect(d.overdue({ levelTime: 4, frames: 10 }, 1_000)).toBe(false)
    expect(d.overdue({ levelTime: 4, frames: 30 }, 40_999)).toBe(false)
    expect(d.overdue({ levelTime: 4, frames: 50 }, 41_000)).toBe(true)
  })

  it('at the target counts frames as progress, and goes overdue when they stop', () => {
    const d = createRideDeadline(opts)
    expect(d.overdue({ levelTime: 10, frames: 5 }, 0)).toBe(false)
    expect(d.overdue({ levelTime: 10, frames: 6 }, 39_000)).toBe(false)
    expect(d.overdue({ levelTime: 10, frames: 6 }, 79_000)).toBe(true)
  })

  it('gives the level load its time on top before the waves register', () => {
    const d = createRideDeadline(opts)
    expect(d.overdue({ levelTime: undefined, frames: 3 }, 0)).toBe(false)
    expect(d.overdue({ levelTime: undefined, frames: 9 }, 99_999)).toBe(false)
    expect(d.overdue({ levelTime: undefined, frames: 9 }, 100_000)).toBe(true)
  })
})
