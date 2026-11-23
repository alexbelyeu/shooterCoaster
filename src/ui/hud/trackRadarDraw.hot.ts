import type { CollisionTarget } from '@/combat/CollisionManager'
import { FAIR } from '@/ui/theme'
import { inRadar, radarX, radarY, type RadarFit } from './trackRadar'

const ENEMY_R = 2.6
const CAR_R = 5.5

/** Every enemy goes in one path, so a frame is two fills and two strokes whatever the count. */
export function drawRadarFrame(
  ctx: CanvasRenderingContext2D,
  outline: CanvasImageSource,
  fit: RadarFit,
  dpr: number,
  targets: readonly CollisionTarget[],
  carX: number,
  carZ: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.drawImage(outline, 0, 0)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.strokeStyle = FAIR.tar

  ctx.beginPath()
  let enemies = 0
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    if (target.kind !== undefined) continue // pickups, switches and bystanders are no enemies
    const p = target.getPosition()
    const x = radarX(fit, p.x)
    const y = radarY(fit, p.z)
    if (!inRadar(fit, x, y)) continue
    ctx.moveTo(x + ENEMY_R, y)
    ctx.arc(x, y, ENEMY_R, 0, Math.PI * 2)
    enemies++
  }
  if (enemies > 0) {
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = FAIR.vermilion
    ctx.fill()
  }

  ctx.beginPath()
  ctx.arc(radarX(fit, carX), radarY(fit, carZ), CAR_R, 0, Math.PI * 2)
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = FAIR.gilt
  ctx.fill()
}
