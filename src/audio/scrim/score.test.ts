import { describe, expect, it } from 'vitest'
import { compile, type CompiledSong, type Timeline } from './score'
import HTML from '../../../docs/audio/reference/scrimshaw-jukebox.html?raw'

/** The original `ScrimScore` IIFE, run as CommonJS (it exports through `module.exports` when it can). */
function originalScrimScore(): { compile: (text: string) => CompiledSong } {
  const start = HTML.indexOf('/* Scrimshaw score format: parser + compiler')
  const end = HTML.indexOf('</script>', start)
  const mod = { exports: {} as { compile: (text: string) => CompiledSong } }
  new Function('module', HTML.slice(start, end))(mod)
  return mod.exports
}

const original = originalScrimScore()

/** The page's six demo scores (`const TRACKS = [...]`, one JSON line). */
function vendoredTracks(html: string): { file: string; text: string }[] {
  const m = /^const TRACKS = (\[.*\]);$/m.exec(html)
  if (!m) throw new Error('TRACKS not found in the vendored page')
  return JSON.parse(m[1])
}

function expectSameTimeline(port: Timeline, orig: Timeline) {
  expect(port.dur).toBeCloseTo(orig.dur, 9)
  expect(port.sections).toEqual(orig.sections)
  expect(port.events.length).toBe(orig.events.length)
  port.events.forEach((e, i) => {
    const o = orig.events[i]
    expect(Math.abs(e.t - o.t)).toBeLessThan(1e-9)
    expect(Math.abs(e.d - o.d)).toBeLessThan(1e-9)
    expect({ v: e.v, vel: e.vel, s: e.s, m: e.m, g: e.g }).toEqual({ v: o.v, vel: o.vel, s: o.s, m: o.m, g: o.g })
  })
}

describe('score parity with the original Scrimshaw compiler', () => {
  const tracks = vendoredTracks(HTML)

  it('finds all six vendored scores', () => {
    expect(tracks.map((t) => t.file)).toHaveLength(6)
  })

  for (const track of tracks) {
    it(`compiles ${track.file} to the same intro and loop timelines`, () => {
      const port = compile(track.text)
      const orig = original.compile(track.text)
      expect(port.errors).toEqual([])
      expect(orig.errors).toEqual([])
      expect(port.voices).toEqual(orig.voices)
      expect(port.intro.events.length + port.loop.events.length).toBeGreaterThan(100)
      expectSameTimeline(port.intro, orig.intro)
      expectSameTimeline(port.loop, orig.loop)
      expect({ ...port, intro: null, loop: null }).toEqual({ ...orig, intro: null, loop: null })
    })
  }

  const head = 'tempo 120\nvoice lead flute\nvoice kick kick\nvoice pad strings\n'
  const broken: [string, string][] = [
    ['short melodic bar', 'pattern A\nlead | C4 D4 E4 | C4--------------- |\nloop A'],
    ['long melodic bar', 'pattern A\nlead | C4------- D4------- E4 |\nloop A'],
    ['short drum bar', 'pattern A\nkick | x... x... x... |\nloop A'],
    ['bad drum character', 'pattern A\nkick | x..z x... x... x... |\nloop A'],
    ['unknown chord', 'pattern A\npad | [Cfoo]--------------- |\nloop A'],
    ['unreadable token', 'pattern A\nlead | H4--------------- |\nloop A'],
    ['% first', 'pattern A\nlead | % |\nloop A'],
    ['= without a note', 'pattern A\nlead | .--------------- | = |\nloop A'],
    ['% not alone', 'pattern A\nlead | C4 % .-------------- |\nloop A'],
    ['empty bar', 'pattern A\nlead | C4--------------- | | C4--------------- |\nloop A'],
    ['undeclared voice', 'pattern A\nbass | C2--------------- |\nloop A'],
    ['missing pattern', 'pattern A\nlead | C4--------------- |\nloop A B'],
    ['from a missing pattern', 'pattern A from Z\nlead | C4--------------- |\nloop A'],
    ['from itself', 'pattern A from B\nlead | C4--------------- |\npattern B from A\nlead | D4--------------- |\nloop A B'],
    ['unknown instrument', 'voice x kazoo\npattern A\nlead | C4--------------- |\nloop A'],
    ['bad voice option', 'voice y flute loud\nvoice z flute volume=2\npattern A\nlead | C4--------------- |\nloop A'],
    ['bad center', 'voice y flute center=Q9\npattern A\nlead | C4--------------- |\nloop A'],
    ['music before a pattern', 'lead | C4--------------- |\npattern A\nlead | C4--------------- |\nloop A'],
    ['unknown line', 'pattern A\nflourish now\nlead | C4--------------- |\nloop A'],
    ['bad loop token', 'pattern A\nlead | C4--------------- |\nloop A^2'],
    ['bad pattern option', 'pattern A speed=3 blah\nlead | C4--------------- |\nloop A'],
    ['nothing to play', ''],
    ['duplicate voice and pattern', 'voice lead flute\npattern A\nlead | C4--------------- |\npattern A\nlead | C4--------------- |\nloop A'],
  ]
  for (const [name, body] of broken) {
    it(`reports the same errors for: ${name}`, () => {
      const text = name === 'nothing to play' ? body : head + body
      const port = compile(text)
      const orig = original.compile(text)
      expect(port.errors.length).toBeGreaterThan(0)
      expect(port.errors).toEqual(orig.errors)
      expectSameTimeline(port.intro, orig.intro)
      expectSameTimeline(port.loop, orig.loop)
    })
  }
})
