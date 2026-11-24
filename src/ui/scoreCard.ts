import { getLevelConfig } from '@/levels/LevelRegistry'
import { runStars, shownScore } from '@/levels/scoring'
import type { RunMode } from '@/types/game'
import type { BiomeType } from '@/types/level'
import { biomeTheme, FAIR, type SkyStop } from '@/ui/theme'
import { formatAccuracy, formatBestCombo } from '@/ui/screens/resultsStats'
import { VIEWBOX } from '@/ui/logoArt'
import { rankLabel } from '@/ui/share'

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

/** Ultra for the name, score and numbers, Big Shoulders for the rest (docs/art/PERSONALITY.md "Type"). */
export const CARD_FONTS = { display: '"Ultra", serif', body: '"Big Shoulders", sans-serif' } as const
/** Text box height per unit of font size: Ultra's glyph box is 1.27 em. */
export const LINE = 1.3

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
  /** 0-based World top 10 place (#445); null draws no ribbon. */
  worldRank: number | null
}

export interface RunForCard {
  levelId: string
  score: number
  bestCombo: number
  hits: number
  shotsFired: number
  mode: RunMode
  worldRank?: number | null
}

export function scoreCardRun({ levelId, score, bestCombo, hits, shotsFired, mode, worldRank = null }: RunForCard): ScoreCardRun | null {
  const config = getLevelConfig(levelId)
  if (!config) return null
  return {
    levelId,
    levelName: config.name,
    biome: config.biome,
    score: shownScore(score),
    stars: runStars(score, config),
    bestCombo,
    accuracy: formatAccuracy(hits, shotsFired),
    daily: mode.mode === 'daily' ? dailyDateLabel(mode.dateKey) : null,
    worldRank: mode.mode === 'daily' ? null : worldRank,
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
  return `shootercoaster-${levelId}-${shownScore(score)}.png`
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface CardText {
  kind: 'text'
  role: 'badge' | 'rank' | 'name' | 'score' | 'statLabel' | 'statValue' | 'cta' | 'url'
  text: string
  font: string
  size: number
  /** Centre of the text box; drawn with `textAlign: center`, `textBaseline: middle`. */
  x: number
  y: number
  width: number
  maxWidth: number
  color: string
  /** `title`: gilt letters with their block and cast shadow; `number`: the cast shadow alone; `plain`: neither. */
  paint: 'title' | 'number' | 'plain'
}

/** A show card tacked on the board, a little askew, with its hard shadow (`.fair-showcard`). */
export interface CardShowcard {
  kind: 'showcard'
  rect: Rect
  color: string
  /** Radians, about the card's centre. */
  tilt: number
}

export interface CardStars {
  kind: 'stars'
  centres: { x: number; y: number }[]
  radius: number
  earned: number
}

export interface CardLogo {
  kind: 'logo'
  rect: Rect
}

export type CardItem = CardText | CardShowcard | CardStars | CardLogo

/** The painted board the card is: notched ticket corners, a gilt lining `inset` in and `line` wide, a hard tar shadow. */
export interface CardBoard {
  rect: Rect
  notch: number
  inset: number
  line: number
  shadow: [dx: number, dy: number]
}

export interface ScoreCardLayout {
  size: CardSize
  width: number
  height: number
  safe: Rect
  board: CardBoard
  /** The level's postcard, framed in tar on the board. */
  art: Rect
  frame: number
  sky: readonly SkyStop[]
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
  paint?: CardText['paint']
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
    paint: spec.paint ?? 'plain',
  }
}

interface Row {
  h: number
  gap: number
  place: (top: number, scale: number) => CardItem[]
}

interface SizeSpec {
  column: (safe: Rect) => Rect
  /** Where the call to action and the address go when they don't close the column: under the art. */
  tail?: Rect
  board: CardBoard
  art: Rect
  frame: number
  logo: number
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
    column: (safe) => ({ x: safe.x + 16, y: safe.y, width: 500, height: safe.height }),
    board: { rect: { x: 16, y: 14, width: 1156, height: 592 }, notch: 30, inset: 18, line: 4, shadow: [12, 16] },
    art: { x: 608, y: 56, width: 520, height: 368 },
    tail: { x: 608, y: 440, width: 520, height: 146 },
    frame: 6,
    logo: 48,
    badge: 22,
    name: 60,
    star: 30,
    score: 96,
    statLabel: 24,
    statValue: 40,
    cta: 40,
    url: 24,
    gap: 12,
  },
  story: {
    column: (safe) => ({ x: safe.x, y: 776, width: safe.width, height: safe.y + safe.height - 776 }),
    board: { rect: { x: 20, y: 20, width: 1024, height: 1864 }, notch: 44, inset: 26, line: 5, shadow: [16, 20] },
    art: { x: 80, y: 92, width: 904, height: 640 },
    frame: 8,
    logo: 110,
    badge: 36,
    name: 116,
    star: 60,
    score: 180,
    statLabel: 40,
    statValue: 72,
    cta: 60,
    url: 42,
    gap: 26,
  },
}

/** Rows top to bottom, centred in `col` and scaled down together when they don't fit. */
function stack(rows: Row[], col: Rect): CardItem[] {
  const natural = rows.reduce((sum, r, i) => sum + r.h + (i < rows.length - 1 ? r.gap : 0), 0)
  const scale = Math.min(1, col.height / natural)
  let top = col.y + (col.height - natural * scale) / 2
  const items: CardItem[] = []
  for (const row of rows) {
    items.push(...row.place(top, scale))
    top += (row.h + row.gap) * scale
  }
  return items
}

export function layoutScoreCard(run: ScoreCardRun, size: CardSize, measure: Measure): ScoreCardLayout {
  const { width, height } = CARD_DIMENSIONS[size]
  const margin = MARGIN[size]
  const safe = { x: margin.x, y: margin.y, width: width - 2 * margin.x, height: height - 2 * margin.y }
  const spec = SPECS[size]
  const col = spec.column(safe)
  const cx = col.x + col.width / 2
  const text = (t: TextSpec, scale: number, top: number, x: number, maxWidth: number): CardText => {
    const fitted = fitText(measure, { ...t, size: Math.floor(t.size * scale) }, maxWidth, Math.ceil(t.size * scale * 0.4))
    return { ...fitted, x, y: top + (fitted.size * LINE) / 2 }
  }
  const textRow = (t: TextSpec, gap: number, c = col): Row => ({ h: t.size * LINE, gap, place: (top, s) => [text(t, s, top, c.x + c.width / 2, c.width)] })

  const rows: Row[] = []
  const logoHeight = Math.min(spec.logo, (col.width * VIEWBOX.height) / VIEWBOX.width)
  rows.push({
    h: logoHeight,
    gap: spec.gap * 1.5,
    place: (top, s) => {
      const height = logoHeight * s
      const width = (height * VIEWBOX.width) / VIEWBOX.height
      return [{ kind: 'logo', rect: { x: cx - width / 2, y: top, width, height } }]
    },
  })

  const showcardRow = (role: CardText['role'], label: string, card: string, ink: string, tilt: number, gap: number): Row => {
    const t: TextSpec = { role, text: label, family: 'display', weight: 400, size: spec.badge, color: ink }
    const padY = spec.badge * 0.3
    return {
      h: spec.badge * LINE + 2 * padY,
      gap,
      place: (top, s) => {
        const fitted = text(t, s, top + padY * s, cx, col.width - 3 * spec.badge * s)
        const padX = fitted.size * 0.6
        const h = fitted.size * LINE + 2 * padY * s
        const rect = { x: cx - fitted.width / 2 - padX, y: top, width: fitted.width + 2 * padX, height: h }
        return [{ kind: 'showcard', rect, color: card, tilt }, fitted]
      },
    }
  }

  // The results board's show cards: the Daily Run on sky, the World place on cream.
  if (run.daily) rows.push(showcardRow('badge', `Daily Run, ${run.daily}`, FAIR.sky, FAIR.tar, -0.05, spec.gap))
  rows.push(textRow({ role: 'name', text: run.levelName, family: 'display', weight: 400, size: spec.name, color: FAIR.gilt, paint: 'title' }, spec.gap * 0.5))
  rows.push({
    h: spec.star * 2,
    gap: spec.gap * 0.5,
    place: (top, s) => {
      const radius = spec.star * s
      const step = radius * 2.5
      return [{ kind: 'stars', centres: [-1, 0, 1].map((i) => ({ x: cx + i * step, y: top + radius })), radius, earned: Math.max(0, Math.min(3, Math.round(run.stars))) }]
    },
  })
  if (run.worldRank !== null) rows.push(showcardRow('rank', `World ${rankLabel(run.worldRank)}`, FAIR.cream, FAIR.oxblood, 0.06, spec.gap * 0.75))
  rows.push(textRow({ role: 'score', text: fmt.format(run.score), family: 'display', weight: 400, size: spec.score, color: FAIR.cream, paint: 'number' }, spec.gap * 0.75))
  const stats: [string, string][] = [
    ['Best combo', formatBestCombo(run.bestCombo)],
    ['Accuracy', run.accuracy],
  ]
  rows.push({
    h: (spec.statLabel + spec.statValue) * LINE,
    gap: spec.gap * 1.25,
    place: (top, s) => {
      const cell = col.width / stats.length
      return stats.flatMap(([label, value], i) => {
        const x = col.x + cell * (i + 0.5)
        const l = text({ role: 'statLabel', text: label, family: 'body', weight: 600, size: spec.statLabel, color: FAIR.cream }, s, top, x, cell * 0.9)
        const v = text({ role: 'statValue', text: value, family: 'display', weight: 400, size: spec.statValue, color: FAIR.cream, paint: 'number' }, s, top + spec.statLabel * LINE * s, x, cell * 0.9)
        return [l, v]
      })
    },
  })
  const closing = [
    textRow({ role: 'cta', text: 'Can you beat it?', family: 'body', weight: 800, size: spec.cta, color: FAIR.gilt }, spec.gap * 0.25, spec.tail),
    textRow({ role: 'url', text: 'scoaster.com', family: 'body', weight: 700, size: spec.url, color: FAIR.cream }, 0, spec.tail),
  ]
  const items = spec.tail ? [...stack(rows, col), ...stack(closing, spec.tail)] : stack([...rows, ...closing], col)

  return { size, width, height, safe, board: spec.board, art: spec.art, frame: spec.frame, sky: biomeTheme(run.biome).sky, items }
}

export function itemBounds(item: CardItem): Rect {
  switch (item.kind) {
    case 'text':
      return { x: item.x - item.width / 2, y: item.y - (item.size * LINE) / 2, width: item.width, height: item.size * LINE }
    case 'showcard':
    case 'logo':
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

/** The part of a `width` × `height` image that covers `rect` without stretching (#701: the on-ride photo in the art's place), centred. */
export function coverCrop(width: number, height: number, rect: Rect): Rect {
  const k = Math.max(rect.width / width, rect.height / height)
  const w = rect.width / k
  const h = rect.height / k
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }
}
