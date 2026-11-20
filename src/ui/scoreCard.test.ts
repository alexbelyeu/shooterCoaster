import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { VIEWBOX } from '@/ui/logoArt'
import {
  CARD_DIMENSIONS,
  dailyDateLabel,
  fitText,
  itemBounds,
  layoutScoreCard,
  scoreCardFileName,
  scoreCardRun,
  starPoints,
  type CardSize,
  type CardText,
  type Measure,
  type Rect,
  type ScoreCardRun,
} from './scoreCard'

/** A generous stand-in for `measureText`: every glyph 0.85 em wide (wider than Ultra's and Big Shoulders' digits). */
const measure: Measure = (text, font) => [...text].length * Number(/(\d+)px/.exec(font)![1]) * 0.85

const SIZES: CardSize[] = ['feed', 'story']

const RUN: ScoreCardRun = {
  levelId: 'level1',
  levelName: 'Theme Park',
  biome: 'themePark',
  score: 12_345,
  stars: 2,
  bestCombo: 14,
  accuracy: '87%',
  daily: null,
  worldRank: null,
}

const texts = (run: ScoreCardRun, size: CardSize) => layoutScoreCard(run, size, measure).items.filter((i): i is CardText => i.kind === 'text')
const role = (run: ScoreCardRun, size: CardSize, r: CardText['role']) => texts(run, size).filter((t) => t.role === r)

function expectInsideSafe(run: ScoreCardRun, size: CardSize) {
  const layout = layoutScoreCard(run, size, measure)
  const { safe } = layout
  for (const item of layout.items) {
    const b = itemBounds(item)
    const what = item.kind === 'text' ? `${item.role} "${item.text}"` : item.kind
    expect(b.x, what).toBeGreaterThanOrEqual(safe.x - 0.5)
    expect(b.y, what).toBeGreaterThanOrEqual(safe.y - 0.5)
    expect(b.x + b.width, what).toBeLessThanOrEqual(safe.x + safe.width + 0.5)
    expect(b.y + b.height, what).toBeLessThanOrEqual(safe.y + safe.height + 0.5)
    if (item.kind === 'text') expect(item.width, what).toBeLessThanOrEqual(item.maxWidth)
  }
}

describe('score card layout', () => {
  it('has the feed and story pixel sizes', () => {
    expect(CARD_DIMENSIONS.feed).toEqual({ width: 1200, height: 630 })
    expect(CARD_DIMENSIONS.story).toEqual({ width: 1080, height: 1920 })
    for (const size of SIZES) {
      const l = layoutScoreCard(RUN, size, measure)
      expect([l.width, l.height]).toEqual([CARD_DIMENSIONS[size].width, CARD_DIMENSIONS[size].height])
    }
  })

  it.each(SIZES)('keeps every item inside the safe margins (%s)', (size) => {
    expectInsideSafe(RUN, size)
    expectInsideSafe({ ...RUN, daily: 'Nov 4, 2026' }, size)
    expectInsideSafe({ ...RUN, worldRank: 9 }, size)
  })

  it.each(SIZES)('fits a 7-digit score and a long level name without cutting the score (%s)', (size) => {
    const long = { ...RUN, levelName: 'The Extremely Long Frostbitten Glacier Gauntlet of Doom', score: 9_999_999, daily: 'Sep 30, 2026' }
    expectInsideSafe(long, size)
    expect(role(long, size, 'score')[0].text).toBe('9,999,999')
    const name = role(long, size, 'name')[0]
    expect(name.size).toBeLessThan(role(RUN, size, 'name')[0].size)
  })

  it('cuts a name too long to shrink with an ellipsis', () => {
    const name = role({ ...RUN, levelName: 'W'.repeat(200) }, 'feed', 'name')[0]
    expect(name.text.endsWith('…')).toBe(true)
    expect(name.width).toBeLessThanOrEqual(name.maxWidth)
  })

  it.each(SIZES)('shows the earned stars (%s)', (size) => {
    for (const stars of [0, 1, 2, 3]) {
      const item = layoutScoreCard({ ...RUN, stars }, size, measure).items.find((i) => i.kind === 'stars')
      expect(item).toMatchObject({ earned: stars })
      expect(item?.kind === 'stars' && item.centres.length).toBe(3)
    }
  })

  it.each(SIZES)('has the logo, the run, the call to action and the address (%s)', (size) => {
    const logo = layoutScoreCard(RUN, size, measure).items[0]
    expect(logo.kind).toBe('logo')
    if (logo.kind === 'logo') expect(logo.rect.width / logo.rect.height).toBeCloseTo(VIEWBOX.width / VIEWBOX.height)
    const t = texts(RUN, size).map((i) => i.text)
    expect(t).toEqual(expect.arrayContaining(['Theme Park', '12,345', 'Best combo', '×14', 'Accuracy', '87%', 'Can you beat it?', 'scoaster.com']))
    expect(t.some((s) => s.startsWith('Daily Run'))).toBe(false)
    expect(layoutScoreCard(RUN, size, measure).items.some((i) => i.kind === 'showcard')).toBe(false)
  })

  it.each(SIZES)('gives a daily run its badge and date (%s)', (size) => {
    const daily = { ...RUN, daily: 'Nov 4, 2026' }
    expect(role(daily, size, 'badge').map((t) => t.text)).toEqual(['Daily Run, Nov 4, 2026'])
    const items = layoutScoreCard(daily, size, measure).items
    const card = items.find((i) => i.kind === 'showcard')
    const badge = role(daily, size, 'badge')[0]
    expect(card).toBeDefined()
    const p = itemBounds(card!)
    const b = itemBounds(badge)
    expect(b.x).toBeGreaterThan(p.x)
    expect(b.x + b.width).toBeLessThan(p.x + p.width)
    expect(b.y).toBeGreaterThanOrEqual(p.y)
    expect(b.y + b.height).toBeLessThanOrEqual(p.y + p.height + 0.5)
  })

  it.each(SIZES)('puts a World show card between the stars and the score of a run on the World board (%s)', (size) => {
    const ranked = { ...RUN, worldRank: 2 }
    expect(role(ranked, size, 'rank').map((t) => t.text)).toEqual(['World #3'])
    expect(role({ ...RUN, worldRank: 9 }, size, 'rank')[0].text).toBe('World #10')
    const items = layoutScoreCard(ranked, size, measure).items
    const card = itemBounds(items.find((i) => i.kind === 'showcard')!)
    const label = itemBounds(role(ranked, size, 'rank')[0])
    expect(label.x).toBeGreaterThan(card.x)
    expect(label.x + label.width).toBeLessThan(card.x + card.width)
    const stars = itemBounds(items.find((i) => i.kind === 'stars')!)
    const score = itemBounds(role(ranked, size, 'score')[0])
    expect(card.y).toBeGreaterThanOrEqual(stars.y + stars.height)
    expect(score.y).toBeGreaterThanOrEqual(card.y + card.height)
  })

  it.each(SIZES)('lays out a run without a World rank exactly as before (%s)', (size) => {
    expect(layoutScoreCard({ ...RUN, worldRank: null }, size, measure)).toEqual(layoutScoreCard(RUN, size, measure))
    expect(role(RUN, size, 'rank')).toEqual([])
  })

  it.each(SIZES)('stacks the rows without overlaps (%s)', (size) => {
    const layout = layoutScoreCard({ ...RUN, daily: 'Nov 4, 2026', worldRank: 0 }, size, measure)
    const stack = layout.items
      .filter((i) => i.kind !== 'showcard' && !(i.kind === 'text' && (i.role === 'statValue' || i.role === 'badge' || i.role === 'rank')))
      .map(itemBounds)
    // The feed card's closing lines stand in their own column under the art.
    const underArt = (b: Rect) => size === 'feed' && b.x >= layout.art.x
    for (const column of [stack.filter((b) => !underArt(b)), stack.filter(underArt)]) {
      // Stat labels share a row: compare row tops only.
      const rows = [...new Map(column.map((b) => [Math.round(b.y), b])).values()].sort((a, b) => a.y - b.y)
      for (let i = 1; i < rows.length; i++) expect(rows[i].y).toBeGreaterThanOrEqual(rows[i - 1].y + rows[i - 1].height - 0.5)
    }
    if (size === 'feed') {
      const art = layout.art
      expect(stack.filter(underArt).map((b) => b.y).every((y) => y > art.y + art.height)).toBe(true)
      expect(stack.filter((b) => !underArt(b)).every((b) => b.x + b.width < art.x)).toBe(true)
    }
  })

  it('keeps the story stack off the clear part of its art', () => {
    const l = layoutScoreCard({ ...RUN, daily: 'Nov 4, 2026' }, 'story', measure)
    for (const item of l.items) expect(itemBounds(item).y).toBeGreaterThan(l.art.y + l.art.height)
  })

  it('shows a dash for a run without a combo or shots', () => {
    const t = texts({ ...RUN, bestCombo: 0, accuracy: '—' }, 'feed').filter((i) => i.role === 'statValue').map((i) => i.text)
    expect(t).toEqual(['—', '—'])
  })
})

describe('fitText', () => {
  it('keeps the size when the text fits', () => {
    expect(fitText(measure, { role: 'url', text: 'abc', family: 'body', weight: 800, size: 20, color: '#fff' }, 1000, 8).size).toBe(20)
  })

  it('shrinks to the widest size that fits', () => {
    const t = fitText(measure, { role: 'name', text: 'x'.repeat(20), family: 'display', weight: 400, size: 100, color: '#fff' }, 620, 10)
    expect(t.width).toBeLessThanOrEqual(620)
    expect(measure(t.text, t.font.replace(`${t.size}px`, `${t.size + 1}px`))).toBeGreaterThan(620)
  })
})

describe('scoreCardRun', () => {
  it('reads the level, stars and stats of a campaign run', () => {
    const level = getAllLevels()[0]
    const run = scoreCardRun({ levelId: level.id, score: level.maxScore + 0.4, bestCombo: 9, hits: 3, shotsFired: 4, mode: { mode: 'campaign' } })
    expect(run).toMatchObject({ levelName: level.name, biome: level.biome, score: Math.round(level.maxScore), stars: 3, bestCombo: 9, accuracy: '75%', daily: null, worldRank: null })
  })

  it('carries a campaign run\'s World rank, never a daily\'s', () => {
    const run = { levelId: 'level1', score: 100, bestCombo: 0, hits: 0, shotsFired: 0, worldRank: 2 }
    expect(scoreCardRun({ ...run, mode: { mode: 'campaign' } })?.worldRank).toBe(2)
    expect(scoreCardRun({ ...run, mode: { mode: 'daily', dateKey: '2026-11-04' } })?.worldRank).toBeNull()
  })

  it('dates a daily run and dashes accuracy with no shots', () => {
    const run = scoreCardRun({ levelId: 'level1', score: 0, bestCombo: 0, hits: 0, shotsFired: 0, mode: { mode: 'daily', dateKey: '2026-11-04' } })
    expect(run).toMatchObject({ score: 0, stars: 0, accuracy: '—', daily: 'Nov 4, 2026' })
  })

  it('is null for an unknown level', () => {
    expect(scoreCardRun({ levelId: 'nope', score: 1, bestCombo: 0, hits: 0, shotsFired: 0, mode: { mode: 'campaign' } })).toBeNull()
  })
})

describe('helpers', () => {
  it('formats the daily date from its UTC key', () => {
    expect(dailyDateLabel('2026-01-09')).toBe('Jan 9, 2026')
    expect(dailyDateLabel('2026-12-31')).toBe('Dec 31, 2026')
    expect(dailyDateLabel('garbage')).toBe('garbage')
  })

  it('names the PNG after the level and score', () => {
    expect(scoreCardFileName('level3', 12345.6)).toBe('shootercoaster-level3-12346.png')
  })

  it('draws a five-pointed star, point up', () => {
    const pts = starPoints(0, 0, 10)
    expect(pts).toHaveLength(10)
    expect(pts[0][0]).toBeCloseTo(0)
    expect(pts[0][1]).toBeCloseTo(-10)
    expect(Math.hypot(...pts[1])).toBeCloseTo(4.5)
  })
})
