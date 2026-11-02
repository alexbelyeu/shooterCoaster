import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { compile } from '@/audio/scrim/score'
import { lintRanges } from '@/audio/scrim/lint'
import { SCORE_KEYS } from '@/audio/sfxDesign'
import { SCORES, themesFromQuery } from './index'

describe('game scores', () => {
  it('has a score for the title, every level and the results screen', () => {
    const slots = Object.keys(SCORES).filter((id) => !id.includes('.'))
    expect(slots.sort()).toEqual(['results', 'title', ...getAllLevels().map((l) => l.id)].sort())
  })

  it('every theme option belongs to a slot that has a score', () => {
    for (const id of Object.keys(SCORES).filter((id) => id.includes('.'))) expect(SCORES[id.split('.')[0]]).toBeDefined()
  })

  it('?theme= puts each named option in its slot and ignores unknown names', () => {
    expect(themesFromQuery('')).toEqual({})
    expect(themesFromQuery('?audio=scrim&theme=neon')).toEqual({ title: 'title.neon' })
    expect(themesFromQuery('?theme=carousel,%20highway,nope')).toEqual({ title: 'title.highway', level1: 'level1.carousel' })
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

describe('score keys (SCORE_KEYS: the arcade SFX play in them)', () => {
  for (const [id, text] of Object.entries(SCORES)) {
    it(`${id}'s tonic is among its three most-played pitch classes, with its mode's third`, () => {
      const key = SCORE_KEYS[id]
      expect(key).toBeDefined()
      const song = compile(text)
      const weight = new Array<number>(12).fill(0)
      for (const tl of [song.intro, song.loop])
        for (const e of tl.events) if (e.m && !song.voices[e.v].drum) for (const m of e.m) weight[m % 12] += e.d
      const top3 = weight.map((w, pc) => [w, pc]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, pc]) => pc)
      const tonic = key.tonic % 12
      expect(top3).toContain(tonic)
      expect(weight[(tonic + (key.minor ? 3 : 4)) % 12]).toBeGreaterThan(weight[(tonic + (key.minor ? 4 : 3)) % 12])
    })
  }
})
