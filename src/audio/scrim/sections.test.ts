import { describe, expect, it } from 'vitest'
import { compile } from './score'
import { barLineAtOrAfter, sectionSong } from './sections'

// 120 BPM, 4 beats: 2 s bars. A 1-bar intro, a 2-bar loop, a 1-bar boss section, a 1-bar sting.
const song = compile(`tempo 120
voice kick kick
voice lead flute
pattern intro
kick | x... x... x... x... |
pattern A
kick | x... x... x... x... | % |
pattern X
lead | C5--------------- |
pattern S
lead | G5--------------- |
play intro
loop A
boss X
sting S`)

describe('score sections (#598)', () => {
  it('compiles the boss and sting lines into their own timelines', () => {
    expect(song.errors).toEqual([])
    expect(song.boss.dur).toBeCloseTo(2)
    expect(song.sting.dur).toBeCloseTo(2)
    expect(song.loop.dur).toBeCloseTo(4)
  })

  it('plays boss as its own loop, the sting once before the loop, and main straight back to the loop', () => {
    expect(sectionSong(song, 'boss')).toMatchObject({ intro: { dur: 0 }, loop: song.boss })
    expect(sectionSong(song, 'sting')).toMatchObject({ intro: song.sting, loop: song.loop })
    expect(sectionSong(song, 'main')).toMatchObject({ intro: { dur: 0 }, loop: song.loop })
  })

  it('has no sections for a score without a boss line', () => {
    expect(sectionSong(compile('pattern A\nlead | C4--------------- |\nloop A'), 'boss')).toBeNull()
  })

  it('finds the next bar line through the intro and every pass of the loop', () => {
    expect(barLineAtOrAfter(song, 0)).toBe(0)
    expect(barLineAtOrAfter(song, 0.3)).toBeCloseTo(2)
    expect(barLineAtOrAfter(song, 2)).toBeCloseTo(2)
    expect(barLineAtOrAfter(song, 2.1)).toBeCloseTo(4)
    expect(barLineAtOrAfter(song, 5.9)).toBeCloseTo(6)
    expect(barLineAtOrAfter(song, 13.2)).toBeCloseTo(14)
  })
})
