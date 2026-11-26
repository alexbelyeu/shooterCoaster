import { describe, expect, it } from 'vitest'
import { SNOW_SINK, snowSinkDepth, snowSunk } from './snowSink.hot'

describe('snowmen sink into the snow (#1059)', () => {
  it('stands while it lingers, then sinks past its height and is gone, unscored', () => {
    const { linger, sinkS, depth } = SNOW_SINK
    expect(snowSinkDepth(0)).toBe(0)
    expect(snowSinkDepth(linger)).toBe(0)
    expect(snowSinkDepth(linger + sinkS / 2)).toBeGreaterThan(0)
    expect(snowSinkDepth(linger + sinkS / 2)).toBeLessThan(depth / 2)
    expect(snowSinkDepth(linger + sinkS)).toBeCloseTo(depth)
    expect(snowSunk(linger + sinkS - 0.01)).toBe(false)
    expect(snowSunk(linger + sinkS)).toBe(true)
  })
})
