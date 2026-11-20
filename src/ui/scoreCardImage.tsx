import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { PostcardArt } from '@/ui/screens/LevelPostcard'
import { CAR, CAR_PARK, CROSSHAIR, CROSSHAIR_PATH, GOLD, LOGO_TEXT, NAVY, RAIL, RED, TARGET, TRACK, VIEWBOX, WHITE, WORDMARK } from '@/ui/logoArt'
import { CARD_FONTS, layoutScoreCard, starPoints, type CardBoard, type CardItem, type CardSize, type CardText, type Rect, type ScoreCardLayout, type ScoreCardRun } from '@/ui/scoreCard'
import { FAIR } from '@/ui/theme'

/** Draws the score card (#272) on a 2D canvas, on demand: no WebGL, no request (the art is an inline SVG data URL). */

/** The faces the card uses, loaded before measuring: a canvas silently falls back to a system font. */
async function fontsReady(): Promise<void> {
  const fonts = document.fonts
  if (!fonts) return
  const faces = [`400 64px ${CARD_FONTS.display}`, `800 64px ${CARD_FONTS.body}`, `${WORDMARK.weight} 64px ${WORDMARK.family}`]
  await Promise.all(faces.map((f) => fonts.load(f))).catch(() => {})
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

/**
 * A ticket's outline `inset` in from `rect`: straight edges, and at each corner a concave notch whose circle is centred on
 * the board's own corner (radius `notch + inset`), so a lining's corners run parallel to the board's (`.fair-notched`).
 */
function ticketPath(ctx: CanvasRenderingContext2D, { x, y, width: w, height: h }: Rect, notch: number, inset: number) {
  const r = notch + inset
  const d = Math.sqrt(r * r - inset * inset)
  // Each corner: its centre, the point the path arrives at and the point it leaves from, relative to the centre.
  const corners: [number, number, number, number, number, number][] = [
    [x + w, y, -d, inset, -inset, d],
    [x + w, y + h, -inset, -d, -d, -inset],
    [x, y + h, d, -inset, inset, -d],
    [x, y, inset, d, d, inset],
  ]
  ctx.beginPath()
  ctx.moveTo(x + d, y + inset)
  for (const [cx, cy, ax, ay, bx, by] of corners) {
    ctx.lineTo(cx + ax, cy + ay)
    ctx.arc(cx, cy, r, Math.atan2(ay, ax), Math.atan2(by, bx), true)
  }
  ctx.closePath()
}

/** The board: its hard shadow on the tar ground, the oxblood, then the gilt lining. */
function drawBoard(ctx: CanvasRenderingContext2D, { rect, notch, inset, line, shadow }: CardBoard) {
  ctx.fillStyle = FAIR.tar
  ticketPath(ctx, { ...rect, x: rect.x + shadow[0], y: rect.y + shadow[1] }, notch, 0)
  ctx.fill()
  ctx.fillStyle = FAIR.oxblood
  ticketPath(ctx, rect, notch, 0)
  ctx.fill()
  ctx.fillStyle = FAIR.gilt
  ticketPath(ctx, rect, notch, inset)
  ctx.fill()
  ctx.fillStyle = FAIR.oxblood
  ticketPath(ctx, rect, notch, inset + line)
  ctx.fill()
}

/** Signwriter's letters (`.fair-title`, `.fair-number`): a hard cast shadow, a block in the letter's darker shade, the face. */
function drawText(ctx: CanvasRenderingContext2D, item: CardText) {
  ctx.font = item.font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const { text, x, y, size, paint } = item
  if (paint !== 'plain') {
    const cast = paint === 'title' ? size * 0.09 : size * 0.05
    ctx.fillStyle = FAIR.tar
    ctx.fillText(text, x + cast, y + cast * 1.15)
  }
  if (paint === 'title') {
    ctx.fillStyle = FAIR.giltBlock
    const depth = Math.max(1, Math.round(size * 0.05))
    for (let i = depth; i > 0; i--) ctx.fillText(text, x + i, y + i)
  }
  ctx.fillStyle = item.color
  ctx.fillText(text, x, y)
}

function drawItem(ctx: CanvasRenderingContext2D, item: CardItem) {
  ctx.save()
  switch (item.kind) {
    case 'logo':
      drawLogo(ctx, item.rect)
      break
    case 'showcard': {
      const { x, y, width, height } = item.rect
      const cast = height * 0.08
      ctx.translate(x + width / 2, y + height / 2)
      ctx.rotate(item.tilt)
      ctx.translate(-width / 2, -height / 2)
      ctx.fillStyle = FAIR.tar
      ctx.beginPath()
      ctx.roundRect(cast, cast * 1.3, width, height, cast)
      ctx.fill()
      ctx.fillStyle = item.color
      ctx.beginPath()
      ctx.roundRect(0, 0, width, height, cast)
      ctx.fill()
      break
    }
    case 'stars':
      ctx.lineJoin = 'round'
      item.centres.forEach(({ x, y }, i) => {
        const earned = i < item.earned
        ctx.fillStyle = earned ? FAIR.gilt : FAIR.oxbloodDeep
        ctx.strokeStyle = earned ? FAIR.tar : FAIR.oxbloodDeep
        ctx.lineWidth = item.radius * 0.12
        ctx.beginPath()
        for (const [px, py] of starPoints(x, y, item.radius)) ctx.lineTo(px, py)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      })
      break
    case 'text':
      drawText(ctx, item)
      break
  }
  ctx.restore()
}

/**
 * The title logo (`logoArt.ts`) at rest, its viewBox fitted to `rect`. Drawn with the 2D API rather than as TitleLogo's SVG
 * in an image: an SVG image is sandboxed from the page's fonts and would set the wordmark in a fallback face.
 */
function drawLogo(ctx: CanvasRenderingContext2D, rect: Rect) {
  const scale = rect.width / VIEWBOX.width
  ctx.translate(rect.x, rect.y)
  ctx.scale(scale, scale)
  ctx.translate(-VIEWBOX.x, -VIEWBOX.y)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  ctx.font = `${WORDMARK.weight} ${WORDMARK.size}px ${WORDMARK.family}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = NAVY
  ctx.lineWidth = WORDMARK.edge
  ctx.strokeText(LOGO_TEXT, WORDMARK.x, WORDMARK.y)
  ctx.fillStyle = WHITE
  ctx.fillText(LOGO_TEXT, WORDMARK.x, WORDMARK.y)

  ctx.save()
  ctx.translate(TARGET.x, TARGET.y)
  for (const ring of TARGET.rings) {
    ctx.fillStyle = ring.fill
    ctx.beginPath()
    ctx.arc(0, 0, ring.r, 0, 2 * Math.PI)
    ctx.fill()
  }
  const crosshair = new Path2D(CROSSHAIR_PATH)
  for (const [colour, width] of [[NAVY, CROSSHAIR.edge], [WHITE, CROSSHAIR.width]] as const) {
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.stroke(crosshair)
  }
  ctx.restore()

  const track = new Path2D(TRACK)
  for (const [colour, width] of [[NAVY, RAIL.edge], [GOLD, RAIL.width]] as const) {
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.stroke(track)
  }

  ctx.translate(CAR_PARK.x, CAR_PARK.y)
  ctx.rotate((CAR_PARK.deg * Math.PI) / 180)
  ctx.strokeStyle = NAVY
  ctx.lineWidth = CAR.edge
  const { rider, body, wheels } = CAR
  const shapes: [string, Path2D][] = [[WHITE, circle(rider.cx, rider.cy, rider.r)], [RED, roundRect(body)], ...wheels.map((w): [string, Path2D] => [NAVY, circle(w.cx, w.cy, w.r)])]
  for (const [fill, shape] of shapes) {
    ctx.fillStyle = fill
    ctx.fill(shape)
    ctx.stroke(shape)
  }
}

function circle(x: number, y: number, r: number): Path2D {
  const p = new Path2D()
  p.arc(x, y, r, 0, 2 * Math.PI)
  return p
}

function roundRect({ x, y, width, height, rx }: { x: number; y: number; width: number; height: number; rx: number }): Path2D {
  const p = new Path2D()
  p.roundRect(x, y, width, height, rx)
  return p
}

async function draw(ctx: CanvasRenderingContext2D, run: ScoreCardRun, layout: ScoreCardLayout) {
  const { width, height, art, frame } = layout
  ctx.fillStyle = FAIR.tar
  ctx.fillRect(0, 0, width, height)
  drawBoard(ctx, layout.board)

  // The postcard: its own sky behind the landmark, framed in tar.
  ctx.fillStyle = FAIR.tar
  ctx.fillRect(art.x - frame, art.y - frame, art.width + 2 * frame, art.height + 2 * frame)
  const sky = ctx.createLinearGradient(0, art.y, 0, art.y + art.height)
  for (const [colour, at] of layout.sky) sky.addColorStop(at, colour)
  ctx.fillStyle = sky
  ctx.fillRect(art.x, art.y, art.width, art.height)
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artMarkup(run.biome, art))}`)
  ctx.drawImage(img, art.x, art.y, art.width, art.height)
  img.src = ''

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

/** iOS Safari reads the URL when the player answers its download prompt, which can be long after the click (#374). */
export const DOWNLOAD_URL_LIFETIME_MS = 40_000

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS)
}
