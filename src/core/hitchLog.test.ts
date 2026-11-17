import { describe, expect, it } from 'vitest'
import {
  HITCH_MS,
  MAX_ENTRIES,
  callerLabel,
  createHitchLog,
  formatHitchReport,
  hitchSummary,
  noteCallback,
  noteEvent,
  noteMilestone,
  noteTabShown,
  noteWarmup,
  playingSplitLine,
  programsAfterWarmup,
  recordFrame,
  type FrameSample,
} from './hitchLog'

const sample = (over: Partial<FrameSample> = {}): FrameSample => ({
  t: 1000,
  frameMs: 16,
  phase: 'playing',
  level: 'level1',
  programs: 40,
  geometries: 100,
  textures: 10,
  drawCalls: 120,
  heap: null,
  rafMs: 4,
  renderMs: 2,
  timerMs: 0,
  ...over,
})

describe('hitch log', () => {
  it('keeps only frames over the threshold or blank', () => {
    const log = createHitchLog()
    expect(recordFrame(log, sample())).toBeNull()
    expect(recordFrame(log, sample({ frameMs: HITCH_MS }))).toBeNull()
    expect(recordFrame(log, sample({ frameMs: HITCH_MS + 1 }))).not.toBeNull()
    const blank = recordFrame(log, sample({ drawCalls: 0 }))
    expect(blank?.drawCalls).toBe(0)
    expect(log.frames).toBe(4)
    expect(log.hitches).toBe(1)
    expect(log.blankFrames).toBe(1)
    expect(log.entries).toHaveLength(2)
  })

  it('records the deltas since the previous sample and the worst frame', () => {
    const log = createHitchLog()
    recordFrame(log, sample({ heap: 5_000_000 }))
    const e = recordFrame(log, sample({ t: 2000, frameMs: 310, programs: 43, geometries: 98, textures: 12, heap: 5_204_800 }))!
    expect(e).toMatchObject({ programs: 3, geometries: -2, textures: 2, heap: 204_800 })
    recordFrame(log, sample({ frameMs: 80, programs: 43 }))
    expect(log.worst).toEqual({ frameMs: 310, t: 2000, phase: 'playing', level: 'level1' })
  })

  it('reports no deltas on the first sample, and no heap where the browser has none', () => {
    const log = createHitchLog()
    const e = recordFrame(log, sample({ frameMs: 400 }))!
    expect(e).toMatchObject({ programs: 0, geometries: 0, textures: 0, heap: null })
  })

  it('attributes the events noted since the previous sample to the next frame, then clears them', () => {
    const log = createHitchLog()
    noteEvent(log, 'wave:incoming')
    noteEvent(log, 'enemy:killed')
    noteEvent(log, 'enemy:killed')
    expect(recordFrame(log, sample({ frameMs: 90 }))!.events).toEqual({ 'wave:incoming': 1, 'enemy:killed': 2 })
    expect(recordFrame(log, sample({ frameMs: 90 }))!.events).toEqual({})
  })

  it('counts programs compiled only once a warm-up has finished', () => {
    const log = createHitchLog()
    recordFrame(log, sample({ programs: 10 }))
    recordFrame(log, sample({ programs: 30 }))
    expect(log.programsAfterWarmup).toBe(0)
    // The warm-up's own last compiles show up in the next sample: not counted.
    noteWarmup(log, 34)
    recordFrame(log, sample({ programs: 34 }))
    recordFrame(log, sample({ programs: 36 }))
    recordFrame(log, sample({ programs: 37 }))
    expect(log.programsAfterWarmup).toBe(3)
    // The next level's warm-up isn't either.
    noteWarmup(log, null)
    recordFrame(log, sample({ programs: 50 }))
    noteWarmup(log, 50)
    recordFrame(log, sample({ programs: 51 }))
    expect(log.programsAfterWarmup).toBe(4)
  })

  it('stops keeping entries at the cap but keeps counting', () => {
    const log = createHitchLog()
    for (let i = 0; i < MAX_ENTRIES + 5; i++) recordFrame(log, sample({ frameMs: 100 }))
    expect(log.entries).toHaveLength(MAX_ENTRIES)
    expect(log.dropped).toBe(5)
    expect(log.hitches).toBe(MAX_ENTRIES + 5)
  })

  it('writes a plain-text report with the header, load path, milestones and every kept frame', () => {
    const log = createHitchLog()
    noteMilestone(log, 'phase countdown level1', 5000)
    noteWarmup(log, 40)
    recordFrame(log, sample({ heap: 1_000_000 }))
    noteEvent(log, 'boss:spawn')
    recordFrame(log, sample({ t: 41_234.6, frameMs: 312.4, programs: 42, heap: 1_102_400, rafMs: 40, renderMs: 25, timerMs: 12 }))
    noteCallback(log, 'tick player-x.js:1:582', 1000, 2)
    noteCallback(log, 'tick player-x.js:1:582', 1250, 6)
    recordFrame(log, sample({ t: 41_300, drawCalls: 0, programs: 42 }))
    const text = formatHitchReport(log, {
      userAgent: 'UA',
      gpu: 'Apple GPU',
      quality: 'low',
      dpr: 2,
      startup: { boot: 120, titleFrame: 900 },
    })
    expect(text).toContain('gpu: Apple GPU')
    expect(text).toContain('quality: low | dpr: 2')
    expect(text).toContain('      900 titleFrame')
    expect(text).toContain('   5000 phase countdown level1')
    expect(text).toContain(
      '  41235 ms |   312 ms frame | playing/level1 | programs +2 | heap +100 KB | rAF 40 (render 25) / timers 12 / outside 260 ms | events: boss:spawn',
    )
    expect(text).toContain('  1 hitches while playing, 0.3 s: in animation frames 13% (render 8%), timers 4%, outside 83%')
    expect(text).toContain('  tick player-x.js:1:582 | every ~250 ms | calls 2 | total 8 ms | max 6.0 ms')
    expect(text).toContain('BLANK (0 draw calls)')
    expect(hitchSummary(log)).toBe('hitches 1 | worst 312 ms | programs after warm-up 2 | blank frames 1')
  })
})

describe('hitch log with a reused sample', () => {
  it('compares against the previous values, not the object the probe keeps overwriting', () => {
    const log = createHitchLog()
    const s = sample({ programs: 10 })
    recordFrame(log, s)
    s.programs = 12
    s.frameMs = 200
    expect(recordFrame(log, s)!.programs).toBe(2)
  })
})

describe('where a long frame went (#596)', () => {
  it('splits a hitch into animation frames, timers and the rest, and sums those while playing', () => {
    const log = createHitchLog()
    expect(playingSplitLine(log)).toBe('no hitches while playing')
    const e = recordFrame(log, sample({ frameMs: 300, rafMs: 60, renderMs: 40, timerMs: 30 }))!
    expect(e.split).toEqual({ raf: 60, render: 40, timers: 30, outside: 210 })
    recordFrame(log, sample({ frameMs: 100, rafMs: 140, renderMs: 100, timerMs: 0 }))
    recordFrame(log, sample({ phase: 'countdown', frameMs: 900, rafMs: 0, timerMs: 0 }))
    expect(log.playingHitches).toEqual({ frames: 2, ms: 400, raf: 200, render: 140, timers: 30, outside: 210 })
  })

  it('times each callback source with its period', () => {
    const log = createHitchLog()
    for (let i = 0; i < 5; i++) noteCallback(log, 'a', 100 + i * 25, i)
    expect(log.callbacks.get('a')).toEqual({ calls: 5, ms: 10, maxMs: 4, firstT: 100, lastT: 200 })
  })

  it('names a callback by the first stack frame outside the recorder, in Chrome and Safari', () => {
    const chrome = [
      'Error',
      '    at labelOf (http://x/assets/perfRecorder-a1.js:2:100)',
      '    at window.setInterval (http://x/assets/perfRecorder-a1.js:2:300)',
      '    at Y (http://x/assets/player-DP6q30eL.js:1:582)',
    ].join('\n')
    expect(callerLabel(chrome, 'perfRecorder-a1.js')).toBe('Y player-DP6q30eL.js:1:582')
    expect(callerLabel('Error\n    at http://x/assets/index-1.js:9:20', 'perfRecorder-a1.js')).toBe('anon index-1.js:9:20')
    const safari = ['labelOf@http://x/assets/perfRecorder-a1.js:2:100', '@http://x/assets/index-1.js:372:19411'].join('\n')
    expect(callerLabel(safari, 'perfRecorder-a1.js')).toBe('anon index-1.js:372:19411')
    expect(callerLabel(undefined, 'perfRecorder-a1.js')).toBe('unknown')
  })
})

describe('tab switches (#541)', () => {
  it('does not count the frame that spans a hidden tab', () => {
    const log = createHitchLog()
    recordFrame(log, sample())
    noteTabShown(log)
    expect(recordFrame(log, sample({ frameMs: 9000 }))).toBeNull()
    expect(log.hitches).toBe(0)
    expect(log.worst).toBeNull()
    expect(recordFrame(log, sample({ frameMs: 120 }))).not.toBeNull()
    expect(log.frames).toBe(3)
  })
})

describe('programsAfterWarmup', () => {
  it('counts only programs above both the previous count and the warm-up, and none before a warm-up', () => {
    expect(programsAfterWarmup(50, 40, null)).toBe(0)
    expect(programsAfterWarmup(36, 34, 34)).toBe(2)
    expect(programsAfterWarmup(34, 30, 34)).toBe(0)
    expect(programsAfterWarmup(30, 34, 34)).toBe(0)
  })
})
