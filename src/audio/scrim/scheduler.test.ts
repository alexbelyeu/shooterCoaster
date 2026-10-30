import { describe, expect, it } from 'vitest'
import { compile } from './score'
import { LOOK_AHEAD_S, ScoreScheduler } from './scheduler'

const song = compile(`tempo 120
voice kick kick
voice lead flute
pattern intro
kick | x... x... x... x... |
pattern A
kick | x... x... x... x... | % |
lead | C5------- .------- | E5--------------- |
play intro
loop A`)

function run(from = 0, until = 12, step = 0.025, startAt = 1) {
  const played: { t: number; v: number }[] = []
  const s = new ScoreScheduler(song, (ev, t) => played.push({ t, v: ev.v }))
  s.start(startAt, from)
  for (let now = 0; now <= until; now += step) s.tick(now)
  return { played, s }
}

describe('ScoreScheduler', () => {
  it('test score: 2 s bars, a 1-bar intro of kicks, a 2-bar loop of kicks + 2 notes', () => {
    expect(song.errors).toEqual([])
    expect(song.intro.dur).toBeCloseTo(2)
    expect(song.loop.dur).toBeCloseTo(4)
  })

  it('plays the intro once, then the loop end to end, each event once at its song time', () => {
    const { played } = run()
    const kicks = played.filter((p) => p.v === 0).map((p) => p.t)
    const expected: number[] = []
    for (let t = 1; t <= 12 + LOOK_AHEAD_S; t += 0.5) expected.push(t)
    expect(kicks).toHaveLength(expected.length)
    kicks.forEach((t, i) => expect(t).toBeCloseTo(expected[i], 9))
    const notes = played.filter((p) => p.v === 1).map((p) => p.t)
    expect(notes).toEqual([3, 5, 7, 9, 11].map((t) => expect.closeTo(t, 9)))
  })

  it('never schedules past the look-ahead horizon', () => {
    const played: number[] = []
    const s = new ScoreScheduler(song, (_, t) => played.push(t))
    s.start(0)
    s.tick(5)
    expect(Math.max(...played)).toBeLessThanOrEqual(5 + LOOK_AHEAD_S + 1e-9)
  })

  it('resumes mid-loop: song time 7.5 (1.5 s into the second pass) sounds at the start time', () => {
    const { played, s } = run(7.5, 6, 0.025, 1)
    expect(s.position(1)).toBeCloseTo(7.5)
    expect(played[0].t).toBeCloseTo(1, 9)
    expect(played.find((p) => p.v === 1)?.t).toBeCloseTo(1.5, 9)
  })

  it('skips an event 520 ms late and plays one 20 ms late at once', () => {
    const played: number[] = []
    const s = new ScoreScheduler(song, (_, t) => played.push(t))
    s.start(0)
    s.tick(0.52)
    expect(played[0]).toBeCloseTo(0.525, 9)
  })

  it('stops after the intro when there is no loop', () => {
    const once = compile('voice kick kick\npattern A\nkick | x... .... .... .... |\nplay A')
    const played: number[] = []
    const s = new ScoreScheduler(once, (_, t) => played.push(t))
    s.start(0)
    for (let now = 0; now < 5; now += 0.1) s.tick(now)
    expect(played).toHaveLength(1)
  })
})
