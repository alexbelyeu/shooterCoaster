import { beforeEach, describe, expect, it } from 'vitest'
import { GHOST_VERSION, decodeGhost, encodeGhost } from './ghost'
import { checkGhost, GHOST_MAX_SAMPLES as SERVER_MAX_SAMPLES, MAX_GHOST_CHARS } from '../../api/_lib/rules'
import {
  GHOST_AXIS_MAX,
  GHOST_MAX_SAMPLES,
  GHOST_STEP_S,
  recordGhost,
  recording,
  resetGhostRecording,
  sampleGhost,
  type GhostPoint,
  type GhostTrack,
} from './ghostTrack.hot'

function track(points: [number, number, number][], step = GHOST_STEP_S): GhostTrack {
  return {
    step,
    count: points.length,
    x: Uint16Array.from(points.map((p) => p[0])),
    y: Uint16Array.from(points.map((p) => p[1])),
    shot: Uint8Array.from(points.map((p) => p[2])),
  }
}

const sample = (t: GhostTrack, at: number): GhostPoint => {
  const out = { x: 0, y: 0, index: -1 }
  sampleGhost(t, at, out)
  return out
}

describe('ghost recording', () => {
  beforeEach(resetGhostRecording)

  it('round-trips through storage within the quantisation step', () => {
    const aimX = (t: number) => 0.5 + 0.4 * Math.sin(t)
    for (let f = 0; f < 600; f++) recordGhost(f / 60, aimX(f / 60), 0.5 + 0.4 * Math.cos(f / 46), Math.floor(f / 7))
    const back = decodeGhost(encodeGhost(recording))
    expect(back).not.toBeNull()
    if (!back) return
    expect(back.count).toBe(recording.count)
    expect(back.step).toBeCloseTo(GHOST_STEP_S, 6)
    let worst = 0
    for (let i = 0; i < back.count; i++) worst = Math.max(worst, Math.abs(sample(back, i * GHOST_STEP_S).x - aimX(i * GHOST_STEP_S)))
    // A sample holds the aim of the frame that filled it (up to one 60 Hz frame late) plus half a quantum.
    expect(worst).toBeLessThan(0.4 / 60 + 0.5 / GHOST_AXIS_MAX + 1e-9)
    expect([...back.x]).toEqual([...recording.x.slice(0, recording.count)])
    expect([...back.y]).toEqual([...recording.y.slice(0, recording.count)])
    expect([...back.shot]).toEqual([...recording.shot.slice(0, recording.count)])
  })

  it('keys samples on game time and marks the step a shot fell in', () => {
    recordGhost(0, 0.1, 0.2, 0)
    recordGhost(0.12, 0.3, 0.4, 1) // fills the 0.05 and 0.10 samples, fires in the 0.10 one
    expect(recording.count).toBe(3)
    expect([...recording.shot.slice(0, 3)]).toEqual([0, 0, 1])
    expect(recording.x[2]).toBe(Math.round(0.3 * GHOST_AXIS_MAX))
    recordGhost(0.13, 0.3, 0.4, 1) // no new shot, no new sample
    expect(recording.count).toBe(3)
  })

  it('halves its rate when the buffer fills, keeping every shot', () => {
    const seconds = GHOST_MAX_SAMPLES * GHOST_STEP_S * 1.5
    for (let f = 0; f * 0.05 <= seconds; f++) recordGhost(f * 0.05, 0.5, 0.5, (f >= 1 ? 1 : 0) + (f >= 2001 ? 1 : 0))
    expect(recording.step).toBeCloseTo(GHOST_STEP_S * 2, 9)
    expect(recording.count * recording.step).toBeGreaterThanOrEqual(seconds)
    expect(recording.count).toBeLessThanOrEqual(GHOST_MAX_SAMPLES)
    expect(recording.shot.slice(0, recording.count).reduce((a, b) => a + b, 0)).toBe(2)
  })
})

describe('sampleGhost', () => {
  const t = track([
    [0, 0, 0],
    [1000, 500, 1],
    [200, 1000, 0],
  ], 0.1)

  it('interpolates between samples', () => {
    const out = sample(t, 0.05)
    expect(out.x).toBeCloseTo(500 / GHOST_AXIS_MAX, 6)
    expect(out.y).toBeCloseTo(250 / GHOST_AXIS_MAX, 6)
    expect(out.index).toBe(0)
    expect(sample(t, 0.15).index).toBe(1)
  })

  it('clamps at both ends', () => {
    const before = sample(t, -3)
    expect([before.x, before.y, before.index]).toEqual([0, 0, 0])
    const after = sample(t, 99)
    expect(after.x).toBeCloseTo(200 / GHOST_AXIS_MAX, 6)
    expect(after.y).toBeCloseTo(1000 / GHOST_AXIS_MAX, 6)
    expect(after.index).toBe(2)
  })
})

describe('ghost storage', () => {
  it('decimates a timeline over the cap instead of dropping it', () => {
    const n = GHOST_MAX_SAMPLES * 3
    const long = track(Array.from({ length: n }, (_, i): [number, number, number] => [i % 1024, 7, i === n - 1 ? 1 : 0]))
    const back = decodeGhost(encodeGhost(long))
    expect(back).not.toBeNull()
    if (!back) return
    expect(back.count).toBe(Math.ceil(n / 4))
    expect(back.step).toBeCloseTo(GHOST_STEP_S * 4, 6)
    expect(back.count * back.step).toBeCloseTo(n * GHOST_STEP_S, 6)
    expect(back.shot[back.count - 1]).toBe(1)
  })

  it('reads corrupt or foreign data as no ghost', () => {
    const good = encodeGhost(track([[1, 2, 0], [3, 4, 1]]))
    expect(decodeGhost(good)).not.toBeNull()
    const [, stepMs, payload] = good.split(';')
    for (const bad of [
      null,
      42,
      '',
      'garbage',
      `${GHOST_VERSION + 1};${stepMs};${payload}`,
      `${GHOST_VERSION};0;${payload}`,
      `${GHOST_VERSION};${stepMs};${payload};`,
      `${GHOST_VERSION};${stepMs};${payload.slice(4)}A`,
      `${GHOST_VERSION};${stepMs};${payload.slice(0, -1)}*`,
      `${GHOST_VERSION};${stepMs};${btoa('\x01\x02\xff')}`,
      `${GHOST_VERSION};${stepMs};`,
      `${GHOST_VERSION};${stepMs};${payload}${'AAAA'.repeat(GHOST_MAX_SAMPLES)}`,
    ]) {
      expect(decodeGhost(bad)).toBeNull()
      // The server's check for a Daily Run's ghost (#1042) refuses all of them too.
      expect(checkGhost(bad)).toBeNull()
    }
  })

  it("passes the server's check on every ghost it encodes, the longest included (#1042)", () => {
    expect(SERVER_MAX_SAMPLES).toBe(GHOST_MAX_SAMPLES)
    const full = (n: number, step: number) => encodeGhost(track(Array.from({ length: n }, (_, i): [number, number, number] => [GHOST_AXIS_MAX, i % 1024, i % 2]), step))
    for (const ghost of [encodeGhost(track([[0, 0, 0]])), full(GHOST_MAX_SAMPLES, GHOST_STEP_S), full(GHOST_MAX_SAMPLES * 4, 59.999 / 4)]) {
      expect(ghost.length).toBeLessThanOrEqual(MAX_GHOST_CHARS)
      expect(checkGhost(ghost)).toBe(ghost)
    }
  })
})
