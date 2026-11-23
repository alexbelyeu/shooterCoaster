import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { rideSeatX, rideSeatZ } from '@/track/rideProgress.hot'
import { subscribeTrackOutline, trackOutline } from '@/track/trackOutline'
import { getCollisionTargets } from '@/combat/CollisionManager'
import { FAIR } from '@/ui/theme'
import { fitRadar, radarBox, radarLongSide, radarShown, radarX, radarY, type RadarFit } from './trackRadar'
import { drawRadarFrame } from './trackRadarDraw.hot'

const PADDING = 8
/** A 3x phone would paint 2.25x the pixels for nothing a 150 px radar shows. */
const MAX_DPR = 2

/** Every path's keyline before any cream, so crossings read as one track. */
function paintOutline(canvas: HTMLCanvasElement, paths: readonly Float32Array[], fit: RadarFit, dpr: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const [colour, width] of [[FAIR.tar, 5.5], [FAIR.cream, 2.5]] as const) {
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.beginPath()
    for (const xz of paths) {
      ctx.moveTo(radarX(fit, xz[0]), radarY(fit, xz[1]))
      for (let i = 2; i + 1 < xz.length; i += 2) ctx.lineTo(radarX(fit, xz[i]), radarY(fit, xz[i + 1]))
    }
    ctx.stroke()
  }
}

function useViewport(): { width: number; height: number } {
  const [view, setView] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setView({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return view
}

/** The lap from above (#834), its outline cached per level and resize; the HUD it lives in is gone in the intro, pause, photo mode and results. */
export default function TrackRadar({ levelId }: { levelId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = useViewport()
  const paths = useSyncExternalStore(subscribeTrackOutline, () => trackOutline(levelId))
  const shown = paths !== null && radarShown(view.width, view.height)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!shown || !paths || !canvas || !ctx) return
    const box = radarBox(paths, radarLongSide(view.width, view.height))
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const fit = fitRadar(paths, box.width, box.height, PADDING)
    const outline = document.createElement('canvas')
    for (const c of [canvas, outline]) {
      c.width = Math.round(box.width * dpr)
      c.height = Math.round(box.height * dpr)
    }
    canvas.style.width = `${box.width}px`
    canvas.style.height = `${box.height}px`
    paintOutline(outline, paths, fit, dpr)

    let raf = 0
    const frame = () => {
      drawRadarFrame(ctx, outline, fit, dpr, getCollisionTargets(), rideSeatX(), rideSeatZ())
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => {
      cancelAnimationFrame(raf)
      outline.width = 0
    }
  }, [paths, shown, view])

  if (!shown) return null
  return <canvas ref={canvasRef} className="hud-radar" aria-hidden="true" />
}
