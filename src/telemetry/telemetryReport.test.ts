import { describe, expect, it } from 'vitest'
import {
  addFrame,
  buildReport,
  cleanMessage,
  createLevelFrames,
  firstStackFrame,
  isGameError,
  MAX_ERRORS,
  MAX_MESSAGE,
  MIN_FRAMES,
  percentileMs,
  recordError,
  type ErrorEntry,
} from './telemetryReport'

const device = { version: '0.1.0+abc1234', touch: true, cores: 8, gpu: 'Adreno (TM) 640' }

function played(level: string, frameMs: number[], quality = 'auto', dpr = 1.5) {
  const lf = createLevelFrames(level)
  for (const ms of frameMs) addFrame(lf, ms)
  lf.quality = quality
  lf.dpr = dpr
  return lf
}

describe('frame percentiles', () => {
  it('gives the median and p95 within a quarter millisecond', () => {
    const frames = [...Array(90).fill(16.7), ...Array(10).fill(40)]
    const lf = played('level1', frames)
    expect(lf.frames).toBe(100)
    expect(percentileMs(lf.hist, lf.frames, 0.5)).toBe(16.75)
    expect(percentileMs(lf.hist, lf.frames, 0.95)).toBe(40.25)
  })

  it('puts frames of 100 ms and more in the last bin, and drops background stalls and nonsense', () => {
    const lf = played('level1', [150, 999, 1001, 5000, 0, -3, NaN])
    expect(lf.frames).toBe(2)
    expect(percentileMs(lf.hist, lf.frames, 0.95)).toBe(100)
  })
})

describe('errors', () => {
  it('keeps only the path of URLs, without query or hash', () => {
    expect(cleanMessage('Failed to fetch https://scoaster.com/assets/x.js?seed=4#a now')).toBe('Failed to fetch /assets/x.js now')
    expect(cleanMessage(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe("Cannot read properties of undefined (reading 'x')")
    expect(cleanMessage({ toString: () => 'weird\n\tthing' })).toBe('weird thing')
    expect(cleanMessage('')).toBe('unknown error')
    expect(cleanMessage('x'.repeat(500))).toHaveLength(MAX_MESSAGE)
  })

  it('reads the first frame of V8 and Firefox / Safari stacks', () => {
    const v8 = "TypeError: x\n    at tick (https://scoaster.com/assets/index-abc.js:1:2345)\n    at loop (https://scoaster.com/assets/index-abc.js:9:1)"
    expect(firstStackFrame(v8)).toBe('tick (/assets/index-abc.js:1:2345)')
    expect(firstStackFrame('tick@https://scoaster.com/assets/index-abc.js:1:2345\nloop@x:1:1')).toBe('tick (/assets/index-abc.js:1:2345)')
    expect(firstStackFrame('@https://scoaster.com/assets/index-abc.js:3:4')).toBe('<anonymous> (/assets/index-abc.js:3:4)')
    expect(firstStackFrame(undefined)).toBe('')
    expect(firstStackFrame('no frames here')).toBe('')
  })

  it("ignores errors that aren't the game's", () => {
    const origin = 'https://scoaster.com'
    expect(isGameError('https://scoaster.com/assets/index.js', 'boom', undefined, origin)).toBe(true)
    expect(isGameError(undefined, 'boom', 'at f (https://scoaster.com/a.js:1:1)', origin)).toBe(true)
    expect(isGameError('', 'Script error.', undefined, origin)).toBe(false)
    expect(isGameError('chrome-extension://abc/content.js', 'boom', undefined, origin)).toBe(false)
    expect(isGameError(undefined, 'boom', 'at f (chrome-extension://abc/x.js:1:1)', origin)).toBe(false)
  })

  it('dedupes by message and frame, keeps the first few and counts repeats', () => {
    const errors: ErrorEntry[] = []
    for (let i = 0; i < 3; i++) recordError(errors, 'boom', 'f (/a.js:1:1)')
    recordError(errors, 'boom', 'g (/a.js:2:2)')
    for (let i = 0; i < 10; i++) recordError(errors, `other ${i}`, '')
    expect(errors).toHaveLength(MAX_ERRORS)
    expect(errors[0]).toEqual({ message: 'boom', frame: 'f (/a.js:1:1)', count: 3 })
    expect(errors[1].count).toBe(1)
  })
})

describe('buildReport', () => {
  it('reports each level played long enough, with its quality and dpr', () => {
    const report = buildReport(device, [], 0, [played('level1', Array(MIN_FRAMES).fill(20), 'low', 1.25), played('level2', Array(MIN_FRAMES - 1).fill(20))])
    expect(report).toEqual({
      version: device.version,
      touch: true,
      cores: 8,
      gpu: 'Adreno (TM) 640',
      contextLost: 0,
      errors: [],
      levels: [{ level: 'level1', quality: 'low', dpr: 1.3, frames: MIN_FRAMES, p50Ms: 20.25, p95Ms: 20.25 }],
    })
  })

  it('sends nothing for a visit with nothing to say, but does for an error or a context loss alone', () => {
    expect(buildReport(device, [], 0, [played('level1', [16])])).toBeNull()
    expect(buildReport(device, [{ message: 'boom', frame: '', count: 1 }], 0, [])?.errors).toHaveLength(1)
    expect(buildReport(device, [], 2, [])?.contextLost).toBe(2)
  })

  it('caps the device fields', () => {
    const report = buildReport({ ...device, cores: 0, gpu: `  ${'g'.repeat(300)} ` }, [], 1, [])!
    expect(report.cores).toBeNull()
    expect(report.gpu).toHaveLength(120)
    expect(buildReport({ ...device, gpu: '   ' }, [], 1, [])!.gpu).toBeNull()
  })
})
