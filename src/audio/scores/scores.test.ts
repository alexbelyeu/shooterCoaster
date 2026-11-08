import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { compile } from '@/audio/scrim/score'
import { lintLayers, lintRanges } from '@/audio/scrim/lint'
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

  it('theme option names are unique across slots (`?theme=` matches by name)', () => {
    const names = Object.keys(SCORES).filter((id) => id.includes('.')).map((id) => id.split('.')[1])
    expect(new Set(names).size).toBe(names.length)
  })

  it('?theme= puts each named option in its slot and ignores unknown names', () => {
    const options = ['title.neon', 'title.highway', 'level1.carousel']
    expect(themesFromQuery('', options)).toEqual({})
    expect(themesFromQuery('?theme=neon', options)).toEqual({ title: 'title.neon' })
    expect(themesFromQuery('?theme=carousel,%20highway,nope', options)).toEqual({ title: 'title.highway', level1: 'level1.carousel' })
    expect(themesFromQuery('?theme=neon')).toEqual({})
  })

  it('the range lint flags a note outside its instrument', () => {
    const song = compile('voice low tuba\npattern A\nlow | C6--------------- |\nloop A')
    expect(lintRanges(song)).toEqual(['"low" (tuba) plays C6–C6; its range is E1–A#3.'])
  })

  it('the layer lint wants the tune in base: a higher layer may only double it or play under it (#415)', () => {
    const score = (leadLayer: string, extra: string) =>
      compile(`steps 1\nvoice pad strings\nvoice lead organ ${leadLayer}\nvoice top xylophone layer=lead\nvoice low brass layer=lead
pattern A
pad  | [C]--- |
lead | C5 E5 G5 E5 |
${extra}
loop A`)
    expect(lintLayers(score('', 'top  | C7 E7 G7 E7 |\nlow  | E4 G4 B4 G4 |'))).toEqual([])
    expect(lintLayers(score('layer=lead', 'top  | C7 E7 G7 E7 |'))).toEqual([
      '"lead" (layer=lead) plays above the base layer\'s top line without doubling a base voice: the tune belongs in base, layers only add.',
      '"top" (layer=lead) plays above the base layer\'s top line without doubling a base voice: the tune belongs in base, layers only add.',
    ])
    expect(lintLayers(score('', 'top  | C7 D7 G7 E7 |'))).toHaveLength(1)
  })

  for (const [id, text] of Object.entries(SCORES)) {
    it(`${id} compiles cleanly, loops, keeps every note in range and its tune in base`, () => {
      const song = compile(text)
      expect(song.errors).toEqual([])
      expect(lintRanges(song)).toEqual([])
      expect(lintLayers(song)).toEqual([])
      expect(song.intro.dur).toBeGreaterThan(0)
      expect(song.loop.dur).toBeGreaterThan(0)
    })
  }

  for (const [id, text] of Object.entries(SCORES)) {
    const song = compile(text)
    if (!song.voices.some((v) => v.layer)) continue
    it(`${id}'s loop has every layer it tags, and base plays all through it (a run opens on base alone)`, () => {
      const bars = song.loop.sections.reduce((n, s) => n + s.bars, 0)
      const barS = song.loop.dur / bars
      const playing = new Set(song.loop.events.map((e) => song.voices[e.v].layer ?? 'base'))
      expect([...playing].sort()).toEqual([...new Set(song.voices.map((v) => v.layer ?? 'base'))].sort())
      const baseBars = new Set(song.loop.events.filter((e) => !song.voices[e.v].layer).map((e) => Math.floor(e.t / barS)))
      expect(baseBars.size).toBe(bars)
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
