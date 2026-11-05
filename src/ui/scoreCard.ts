import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'
import type { RunMode } from '@/store/useGameStore'
import type { BiomeType } from '@/types/level'
import { biomeTheme, type SkyStop } from '@/ui/theme'
import { formatAccuracy } from '@/ui/screens/resultsStats'

/** The shareable score card (#272): pure layout, drawn on a 2D canvas by `scoreCardImage.tsx`. */

export type CardSize = 'feed' | 'story'

export const CARD_DIMENSIONS: Record<CardSize, { width: number; height: number }> = {
  feed: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
}

/** Story apps lay their own header and reply bar over the top and bottom ~250 px. */
const MARGIN: Record<CardSize, { x: number; y: number }> = {
  feed: { x: 56, y: 44 },
  story: { x: 80, y: 230 },
}

export const CARD_FONTS = { display: '"Lobster", cursive', body: '"Inter", sans-serif' } as const
const GOLD = '#ffd23f'
const WHITE = '#ffffff'
const DIM = 'rgba(255, 255, 255, 0.62)'
/** Text box height per unit of font size. */
export const LINE = 1.25

export interface ScoreCardRun {
  levelId: string
  levelName: string
  biome: BiomeType
  score: number
  stars: number
  bestCombo: number
  accuracy: string
  /** The Daily Run's date (`Nov 4, 2026`), or null for a campaign run. */
  daily: string | null
}

export interface RunForCard {
  levelId: string
  score: number
  bestCombo: number
  hits: number
  shotsFired: number
  mode: RunMode
}

export function scoreCardRun({ levelId, score, bestCombo, hits, shotsFired, mode }: RunForCard): ScoreCardRun | null {
  const config = getLevelConfig(levelId)
  if (!config) return null
  const rounded = Math.max(0, Math.round(score))
  return {
    levelId,
    levelName: config.name,
    biome: config.biome,
    score: rounded,
    stars: computeStars(rounded, config.maxScore, config.starThresholds),
    bestCombo,
    accuracy: formatAccuracy(hits, shotsFired),
    daily: mode.mode === 'daily' ? dailyDateLabel(mode.dateKey) : null,
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-11-04` (the daily's UTC key) → `Nov 4, 2026`. */
export function dailyDateLabel(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined
  return m && month ? `${month} ${Number(m[3])}, ${m[1]}` : dateKey
}

export function scoreCardFileName(levelId: string, score: number): string {
  return `shootercoaster-${levelId}-${Math.max(0, Math.round(score))}.png`
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface CardText {
  kind: 'text'
  role: 'wordmark' | 'badge' | 'name' | 'score' | 'statLabel' | 'statValue' | 'cta' | 'url'
  text: string
  font: string
  size: number
  /** Centre of the text box; drawn with `textAlign: center`, `textBaseline: middle`. */
  x: number
  y: number
  width: number
  maxWidth: number
  color: string
  glow: string | null
}

export interface CardPill {
  kind: 'pill'
  rect: Rect
  color: string
}

export interface CardStars {
  kind: 'stars'
  centres: { x: number; y: number }[]
  radius: number
  earned: number
}

export type CardItem = CardText | CardPill | CardStars

export interface ScoreCardLayout {
  size: CardSize
  width: number
  height: number
  safe: Rect
  art: Rect
  sky: readonly SkyStop[]
  /** The dark results backdrop fades in over the art along this line: transparent at `from`, solid at `to`. */
  fade: { from: [number, number]; to: [number, number] }
  glow: { x: number; y: number; radius: number; colour: string }
  accent: string
  items: CardItem[]
}

export type Measure = (text: string, font: string) => number

const fmt = new Intl.NumberFormat('en-US')

function font(family: keyof typeof CARD_FONTS, weight: number, size: number): string {
  return `${weight} ${size}px ${CARD_FONTS[family]}`
}

interface TextSpec {
  role: CardText['role']
  text: string
  family: keyof typeof CARD_FONTS
  weight: number
  size: number
  color: string
  glow?: string
}

/** Shrinks to fit `maxWidth` (text width scales with size), down to `minSize`; past that, cuts the text with an ellipsis. */
export function fitText(measure: Measure, spec: TextSpec, maxWidth: number, minSize: number): Omit<CardText, 'x' | 'y'> {
  let size = spec.size
  let text = spec.text
  let width = measure(text, font(spec.family, spec.weight, size))
  if (width > maxWidth) {
    size = Math.max(minSize, Math.floor((size * maxWidth) / width))
    width = measure(text, font(spec.family, spec.weight, size))
    while (width > maxWidth && size > minSize) {
      size -= 1
      width = measure(text, font(spec.family, spec.weight, size))
    }
  }
  while (width > maxWidth && text.length > 1) {
    text = `${text.slice(0, -2).trimEnd()}…`
    width = measure(text, font(spec.family, spec.weight, size))
  }
  return {
    kind: 'text',
    role: spec.role,
    text,
    font: font(spec.family, spec.weight, size),
    size,
    width,
    maxWidth,
    color: spec.color,
    glow: spec.glow ?? null,
  }
}

interface Row {
  h: number
  gap: number
  place: (top: number, scale: number) => CardItem[]
}

interface SizeSpec {
  column: (safe: Rect) => Rect
  art: Rect
  fade: ScoreCardLayout['fade']
  wordmark: number
  badge: number
  name: number
  star: number
  score: number
  statLabel: number
  statValue: number
  cta: number
  url: number
  gap: number
}

const SPECS: Record<CardSize, SizeSpec> = {
  feed: {
    column: (safe) => ({ x: safe.x, y: safe.y, width: 560, height: safe.height }),
    art: { x: 400, y: 0, width: 800, height: 630 },
    fade: { from: [700, 0], to: [440, 0] },
    wordmark: 30,
    badge: 18,
    name: 68,
    star: 30,
    score: 104,
    statLabel: 16,
    statValue: 38,
    cta: 36,
    url: 24,
    gap: 12,
  },
  story: {
    column: (safe) => ({ x: safe.x, y: 640, width: safe.width, height: safe.y + safe.height - 640 }),
    art: { x: 0, y: 0, width: 1080, height: 900 },
    fade: { from: [0, 520], to: [0, 880] },
    wordmark: 64,
    badge: 30,
    name: 120,
    star: 60,
    score: 190,
    statLabel: 28,
    statValue: 68,
    cta: 64,
    url: 42,
    gap: 26,
  },
}

export function layoutScoreCard(run: ScoreCardRun, size: CardSize, measure: Measure): ScoreCardLayout {
  const { width, height } = CARD_DIMENSIONS[size]
  const margin = MARGIN[size]
  const safe = { x: margin.x, y: margin.y, width: width - 2 * margin.x, height: height - 2 * margin.y }
  const spec = SPECS[size]
  const theme = biomeTheme(run.biome)
  const col = spec.column(safe)
  const cx = col.x + col.width / 2
  const text = (t: TextSpec, scale: number, top: number, x = cx, maxWidth = col.width): CardText => {
    const fitted = fitText(measure, { ...t, size: Math.round(t.size * scale) }, maxWidth, Math.ceil(t.size * scale * 0.4))
    return { ...fitted, x, y: top + (fitted.size * LINE) / 2 }
  }
  const textRow = (t: TextSpec, gap = spec.gap): Row => ({ h: t.size * LINE, gap, place: (top, s) => [text(t, s, top)] })

  const rows: Row[] = []
  rows.push(textRow({ role: 'wordmark', text: 'ShooterCoaster', family: 'display', weight: 400, size: spec.wordmark, color: WHITE, glow: 'rgba(0, 0, 0, 0.6)' }, spec.gap * 1.5))

  if (run.daily) {
    const badge: TextSpec = { role: 'badge', text: `DAILY RUN · ${run.daily.toUpperCase()}`, family: 'body', weight: 800, size: spec.badge, color: '#1a1206' }
    const padY = spec.badge * 0.45
    rows.push({
      h: spec.badge * LINE + 2 * padY,
      gap: spec.gap,
      place: (top, s) => {
        const label = text(badge, s, top + padY * s, cx, col.width - 3 * spec.badge * s)
        const padX = label.size * 1.1
        const h = label.size * LINE + 2 * padY * s
        return [{ kind: 'pill', rect: { x: cx - label.width / 2 - padX, y: top, width: label.width + 2 * padX, height: h }, color: GOLD }, label]
      },
    })
  }
  rows.push(textRow({ role: 'name', text: run.levelName, family: 'display', weight: 400, size: spec.name, color: WHITE, glow: theme.glow }, spec.gap * 0.5))
  rows.push({
    h: spec.star * 2,
    gap: spec.gap * 0.5,
    place: (top, s) => {
      const radius = spec.star * s
      const step = radius * 2.5
      return [{ kind: 'stars', centres: [-1, 0, 1].map((i) => ({ x: cx + i * step, y: top + radius })), radius, earned: Math.max(0, Math.min(3, Math.round(run.stars))) }]
    },
  })
  rows.push(textRow({ role: 'score', text: fmt.format(run.score), family: 'display', weight: 400, size: spec.score, color: WHITE, glow: theme.glow }, spec.gap * 0.75))
  const stats: [string, string][] = [
    ['BEST COMBO', run.bestCombo > 0 ? `×${run.bestCombo}` : '—'],
    ['ACCURACY', run.accuracy],
  ]
  rows.push({
    h: (spec.statLabel + spec.statValue) * LINE,
    gap: spec.gap * 1.25,
    place: (top, s) => {
      const cell = col.width / stats.length
      return stats.flatMap(([label, value], i) => {
        const x = col.x + cell * (i + 0.5)
        const l = text({ role: 'statLabel', text: label, family: 'body', weight: 700, size: spec.statLabel, color: DIM }, s, top, x, cell * 0.9)
        const v = text({ role: 'statValue', text: value, family: 'body', weight: 800, size: spec.statValue, color: WHITE }, s, top + spec.statLabel * LINE * s, x, cell * 0.9)
        return [l, v]
      })
    },
  })
  rows.push(textRow({ role: 'cta', text: 'Can you beat it?', family: 'display', weight: 400, size: spec.cta, color: theme.accent, glow: 'rgba(0, 0, 0, 0.5)' }, spec.gap * 0.25))
  rows.push(textRow({ role: 'url', text: 'scoaster.com', family: 'body', weight: 800, size: spec.url, color: WHITE }, 0))

  const natural = rows.reduce((sum, r, i) => sum + r.h + (i < rows.length - 1 ? r.gap : 0), 0)
  const scale = Math.min(1, col.height / natural)
  let top = col.y + (col.height - natural * scale) / 2
  const items: CardItem[] = []
  for (const row of rows) {
    items.push(...row.place(top, scale))
    top += (row.h + row.gap) * scale
  }

  return {
    size,
    width,
    height,
    safe,
    art: spec.art,
    sky: theme.sky,
    fade: spec.fade,
    glow: { x: cx, y: col.y + col.height / 2, radius: Math.max(col.width, col.height) * 0.6, colour: theme.glow },
    accent: theme.accent,
    items,
  }
}

export function itemBounds(item: CardItem): Rect {
  switch (item.kind) {
    case 'text':
      return { x: item.x - item.width / 2, y: item.y - (item.size * LINE) / 2, width: item.width, height: item.size * LINE }
    case 'pill':
      return item.rect
    case 'stars': {
      const xs = item.centres.map((c) => c.x)
      const y = item.centres[0]?.y ?? 0
      return { x: Math.min(...xs) - item.radius, y: y - item.radius, width: Math.max(...xs) - Math.min(...xs) + 2 * item.radius, height: 2 * item.radius }
    }
  }
}

export function starPoints(cx: number, cy: number, outer: number, inner = outer * 0.45): [number, number][] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  })
}
