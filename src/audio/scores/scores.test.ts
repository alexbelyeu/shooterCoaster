import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { compile } from '@/audio/scrim/score'
import { lintRanges } from '@/audio/scrim/lint'
import { SCORES } from './index'

describe('game scores', () => {
  it('has a score for the title, every level and the results screen', () => {
    expect(Object.keys(SCORES).sort()).toEqual(['results', 'title', ...getAllLevels().map((l) => l.id)].sort())
  })

  it('the range lint flags a note outside its instrument', () => {
    const song = compile('voice low tuba\npattern A\nlow | C6--------------- |\nloop A')
    expect(lintRanges(song)).toEqual(['"low" (tuba) plays C6–C6; its range is E1–A#3.'])
  })

  for (const [id, text] of Object.entries(SCORES)) {
    it(`${id} compiles cleanly, loops, and keeps every note in range`, () => {
      const song = compile(text)
      expect(song.errors).toEqual([])
      expect(lintRanges(song)).toEqual([])
      expect(song.intro.dur).toBeGreaterThan(0)
      expect(song.loop.dur).toBeGreaterThan(0)
    })
  }
})
