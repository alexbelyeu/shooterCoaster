import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { PostcardArt } from '@/ui/screens/LevelPostcard'
import { CARD_FONTS, layoutScoreCard, starPoints, type CardItem, type CardSize, type Rect, type ScoreCardLayout, type ScoreCardRun } from '@/ui/scoreCard'

/** Draws the score card (#272) on a 2D canvas, on demand: no WebGL, no request (the art is an inline SVG data URL). */

const BACKDROP = 'rgb(9, 9, 15)'
const BACKDROP_CLEAR = 'rgba(9, 9, 15, 0)'
const GOLD = '#ffd23f'
const GOLD_GLOW = 'rgba(255, 210, 63, 0.8)'
const STAR_EMPTY = 'rgba(255, 255, 255, 0.22)'

/** The faces the card uses, loaded before measuring: a canvas silently falls back to a system font. */
async function fontsReady(): Promise<void> {
  const fonts = document.fonts
  if (!fonts) return
  await Promise.all([`400 64px ${CARD_FONTS.display}`, `700 64px ${CARD_FONTS.body}`, `800 64px ${CARD_FONTS.body}`].map((f) => fonts.load(f))).catch(() => {})
  await fonts.ready
}

/** The level-select postcard's SVG, sized to `rect` so the browser does the slice crop. */
function artMarkup(biome: ScoreCardRun['biome'], rect: Rect): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(<PostcardArt biome={biome} width={rect.width} height={rect.height} />))
  const markup = host.innerHTML
  root.unmount()
  return markup
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = src
  return img.decode().then(() => img)
}

function drawItem(ctx: CanvasRenderingContext2D, item: CardItem) {
  ctx.save()
  switch (item.kind) {
    case 'pill': {
      const { x, y, width, height } = item.rect
      ctx.fillStyle = item.color
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, height / 2)
      ctx.fill()
      break
    }
    case 'stars':
      item.centres.forEach(({ x, y }, i) => {
        const earned = i < item.earned
        ctx.fillStyle = earned ? GOLD : STAR_EMPTY
        ctx.shadowColor = earned ? GOLD_GLOW : 'transparent'
        ctx.shadowBlur = earned ? item.radius * 0.6 : 0
        ctx.beginPath()
        for (const [px, py] of starPoints(x, y, item.radius)) ctx.lineTo(px, py)
        ctx.closePath()
        ctx.fill()
      })
      break
    case 'text':
      ctx.font = item.font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = item.color
      if (item.glow) {
        ctx.shadowColor = item.glow
        ctx.shadowBlur = item.size * 0.3
      }
      ctx.fillText(item.text, item.x, item.y)
      break
  }
  ctx.restore()
}

async function draw(ctx: CanvasRenderingContext2D, run: ScoreCardRun, layout: ScoreCardLayout) {
  const { width, height, art } = layout
  ctx.fillStyle = BACKDROP
  ctx.fillRect(0, 0, width, height)

  const sky = ctx.createLinearGradient(0, art.y, 0, art.y + art.height)
  for (const [colour, at] of layout.sky) sky.addColorStop(at, colour)
  ctx.fillStyle = sky
  ctx.fillRect(art.x, art.y, art.width, art.height)
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artMarkup(run.biome, art))}`)
  ctx.drawImage(img, art.x, art.y, art.width, art.height)
  img.src = ''

  const { from, to } = layout.fade
  const fade = ctx.createLinearGradient(from[0], from[1], to[0], to[1])
  fade.addColorStop(0, BACKDROP_CLEAR)
  fade.addColorStop(1, BACKDROP)
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, width, height)
  const { x, y, radius, colour } = layout.glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
  glow.addColorStop(0, colour)
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.globalAlpha = 0.3
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.globalAlpha = 1

  for (const item of layout.items) drawItem(ctx, item)
}

/** Empties the canvas afterwards so its pixels don't linger. */
export async function renderScoreCard(run: ScoreCardRun, size: CardSize): Promise<Blob> {
  await fontsReady()
  const canvas = document.createElement('canvas')
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2D canvas')
    const layout = layoutScoreCard(run, size, (text, font) => {
      ctx.font = font
      return ctx.measureText(text).width
    })
    canvas.width = layout.width
    canvas.height = layout.height
    await draw(ctx, run, layout)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
