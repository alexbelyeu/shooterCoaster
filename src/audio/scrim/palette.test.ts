import { describe, expect, it } from 'vitest'
import { compile, DRUMS, MELODIC } from './score'
import { INSTRUMENT_RANGES, lintRanges } from './lint'
import { ARCADE_INSTRUMENTS, createCore, createSynth, DRUM_INSTRUMENTS, MELODIC_INSTRUMENTS } from './synth'
import FORMAT from '../../../docs/audio/SCORE-FORMAT.md?raw'

const PALETTE: Record<string, string> = import.meta.glob('../../../docs/audio/palette/*.scrim', { query: '?raw', import: 'default', eager: true })
const paletteScore = (name: string) => PALETTE[`../../../docs/audio/palette/${name}.scrim`]

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const midi = (name: string) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(name)
  if (!m) throw new Error(`bad note ${name}`)
  return 12 * (Number(m[2]) + 1) + NAMES.indexOf(m[1])
}

function documented() {
  const start = FORMAT.indexOf('\n## Instruments')
  const section = FORMAT.slice(start, FORMAT.indexOf('\n## ', start + 1))
  const melodic: string[] = [], drums: string[] = []
  const ranges: Record<string, [number, number]> = {}
  for (const line of section.split('\n')) {
    const list = /^- (Melodic|Drums): (.*)$/.exec(line)
    if (list) (list[1] === 'Melodic' ? melodic : drums).push(...[...list[2].matchAll(/`(\w+)`/g)].map((m) => m[1]))
    const row = /^\| `(\w+)` \| (melodic|drum) \| ([^|]+) \|/.exec(line)
    if (!row) continue
    if (row[2] === 'drum') { drums.push(row[1]); continue }
    melodic.push(row[1])
    const [lo, hi] = row[3].trim().split('–')
    ranges[row[1]] = [midi(lo), midi(hi)]
  }
  return { melodic, drums, ranges }
}

describe('instrument list', () => {
  const doc = documented()

  it('SCORE-FORMAT.md names every instrument the synth has, and nothing else', () => {
    expect([...doc.melodic].sort()).toEqual([...MELODIC_INSTRUMENTS].sort())
    expect([...doc.drums].sort()).toEqual([...DRUM_INSTRUMENTS].sort())
  })

  it('the compiler accepts exactly the synth\'s instruments', () => {
    expect([...MELODIC].sort()).toEqual([...MELODIC_INSTRUMENTS].sort())
    expect([...DRUMS].sort()).toEqual([...DRUM_INSTRUMENTS].sort())
  })

  it('every melodic instrument has a lint range, and the documented ones match it', () => {
    for (const name of MELODIC_INSTRUMENTS) expect(INSTRUMENT_RANGES[name], name).toBeDefined()
    for (const [name, range] of Object.entries(doc.ranges)) expect(INSTRUMENT_RANGES[name], name).toEqual(range)
  })
})

describe('palette scores', () => {
  it.each(['palette-melodic', 'palette-drums', 'palette-groove'])('%s compiles, keeps every note in range and uses only the arcade palette', (name) => {
    const song = compile(paletteScore(name))
    expect(song.errors).toEqual([])
    expect(lintRanges(song)).toEqual([])
    for (const v of song.voices) expect(ARCADE_INSTRUMENTS, v.inst).toContain(v.inst)
  })

  it('the groove is eight bars', () => {
    const song = compile(paletteScore('palette-groove'))
    const bar = song.loop.sections[0].barDur
    expect(song.loop.dur / bar).toBeCloseTo(8, 6)
  })
})

class FakeParam {
  value = 0
  setValueAtTime() { return this }
  linearRampToValueAtTime() { return this }
  exponentialRampToValueAtTime() { return this }
  setTargetAtTime() { return this }
  cancelScheduledValues() { return this }
}
const PARAMS = ['gain', 'frequency', 'Q', 'detune', 'pan', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release'] as const
class FakeNode {
  disconnected = false
  constructor() { for (const p of PARAMS) (this as Record<string, unknown>)[p] = new FakeParam() }
  connect<T>(n: T) { return n }
  disconnect() { this.disconnected = true }
}
class FakeSource extends FakeNode {
  started: number | null = null
  stopped: number | null = null
  onended: (() => void) | null = null
  start(t = 0) { this.started = t }
  stop(t = 0) { this.stopped = t }
  setPeriodicWave() {}
}
function fakeContext() {
  const made: FakeNode[] = []
  const node = <T extends FakeNode>(n: T) => (made.push(n), n)
  const sampleRate = 8000
  const ctx = {
    sampleRate,
    currentTime: 0,
    createGain: () => node(new FakeNode()),
    createBiquadFilter: () => node(new FakeNode()),
    createStereoPanner: () => node(new FakeNode()),
    createWaveShaper: () => node(new FakeNode()),
    createConvolver: () => node(new FakeNode()),
    createDynamicsCompressor: () => node(new FakeNode()),
    createOscillator: () => node(new FakeSource()),
    createBufferSource: () => node(new FakeSource()),
    createPeriodicWave: () => ({}),
    createBuffer: (_ch: number, len: number, sr: number) => ({ duration: len / sr, getChannelData: () => new Float32Array(len) }),
  }
  return { ctx: ctx as unknown as BaseAudioContext, made }
}

describe('arcade instruments free their nodes', () => {
  it.each(ARCADE_INSTRUMENTS)('%s: every source stops, and every node disconnects once the last one ends', (inst) => {
    const drum = DRUMS.includes(inst)
    const song = compile(`beats 2\nsteps 1\nvoice x ${inst}\npattern A\nx | ${drum ? 'X.' : 'C4-'} |\nloop A`)
    expect(song.errors).toEqual([])
    const { ctx, made } = fakeContext()
    const synth = createSynth(createCore(ctx), ctx.destination)
    const session = synth.session(song)
    const before = made.length
    session.play(song.loop.events[0], 1)
    const note = made.slice(before)
    const sources = note.filter((n): n is FakeSource => n instanceof FakeSource)
    expect(sources.length).toBeGreaterThan(0)
    for (const s of sources) {
      expect(s.started).not.toBeNull()
      expect(s.stopped!).toBeGreaterThan(s.started!)
      expect(s.onended).toBeTypeOf('function')
    }
    for (const s of sources.slice(0, -1)) s.onended!()
    expect(note.some((n) => n.disconnected)).toBe(false)
    sources[sources.length - 1].onended!()
    expect(note.filter((n) => !n.disconnected)).toEqual([])
    synth.dispose()
  })

  it('distguitar\'s 10 amp and cab nodes follow the session bus, send bus and channel, counted and disconnected with them', () => {
    const song = compile('beats 2\nsteps 1\nvoice g distguitar\npattern A\ng | E2+B2- |\nloop A')
    const { ctx, made } = fakeContext()
    const synth = createSynth(createCore(ctx), ctx.destination)
    const chainNodes = synth.nodeCount()
    const before = made.length
    synth.session(song)
    const amp = made.slice(before + 5)
    expect(amp.length).toBe(10)
    expect(synth.nodeCount() - chainNodes).toBe(2 + 4 + amp.length)
    synth.dispose()
    expect(amp.filter((n) => !n.disconnected)).toEqual([])
  })
})
