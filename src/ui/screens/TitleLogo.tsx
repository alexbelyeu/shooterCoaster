import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { CAR, CAR_PARK, CROSSHAIR, CROSSHAIR_PATH, GOLD, LOGO_TEXT, NAVY, RAIL, RED, TARGET, TRACK, VIEWBOX, WHITE, WORDMARK } from '@/ui/logoArt'

/**
 * The title logo (`logoArt.ts`): one build-in on mount, the car riding the rail on rAF (so `npm run clip`'s virtual
 * time steps it), then still. index.html's poster inlines the `still` markup; `indexHtml.test.ts` keeps them equal.
 */

const RIDE = { wait: 0.3, seconds: 2.3 }
const TARGET_POP_S = 1.9
const CROSSHAIR_LOCK_S = 2.5

const STYLE = `
.logo-pop { transform-box: fill-box; transform-origin: center; animation: logo-pop 0.45s cubic-bezier(0.3, 1.6, 0.5, 1) both; }
.logo-lock { transform-box: fill-box; transform-origin: center; animation: logo-lock 0.35s ease-out both; }
@keyframes logo-pop { from { transform: scale(0); } }
@keyframes logo-lock { from { transform: scale(1.8); opacity: 0; } }
`

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

function Pop({ delay, still, lock, children }: { delay: number; still: boolean; lock?: boolean; children: ReactNode }) {
  if (still) return <g>{children}</g>
  return (
    <g className={lock ? 'logo-lock' : 'logo-pop'} style={{ animationDelay: `${delay}s` }}>
      {children}
    </g>
  )
}

function RailRide({ still }: { still: boolean }) {
  const rail = useRef<SVGPathElement>(null)
  const edge = useRef<SVGPathElement>(null)
  const car = useRef<SVGGElement>(null)

  useLayoutEffect(() => {
    const path = rail.current
    if (still || !path) return
    const length = path.getTotalLength()
    const place = (f: number) => {
      const at = f * length
      const p = path.getPointAtLength(at)
      const ahead = path.getPointAtLength(Math.min(length, at + 1))
      const behind = path.getPointAtLength(Math.max(0, at - 1))
      const deg = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI
      car.current?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${deg.toFixed(1)})`)
      const offset = String(1 - f)
      path.style.strokeDashoffset = offset
      if (edge.current) edge.current.style.strokeDashoffset = offset
    }
    place(0)
    let raf = 0
    let start = -1
    const tick = (now: number) => {
      if (start < 0) start = now
      const t = Math.min(1, Math.max(0, ((now - start) / 1000 - RIDE.wait) / RIDE.seconds))
      place(easeInOut(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      place(1)
    }
  }, [still])

  const dash = still ? {} : { pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 }
  const { rider, body, wheels } = CAR
  return (
    <>
      <path ref={edge} d={TRACK} fill="none" strokeLinecap="round" stroke={NAVY} strokeWidth={RAIL.edge} {...dash} />
      <path ref={rail} d={TRACK} fill="none" strokeLinecap="round" stroke={GOLD} strokeWidth={RAIL.width} {...dash} />
      <g ref={car} transform={`translate(${CAR_PARK.x} ${CAR_PARK.y}) rotate(${CAR_PARK.deg})`}>
        <g stroke={NAVY} strokeWidth={CAR.edge}>
          <circle cx={rider.cx} cy={rider.cy} r={rider.r} fill={WHITE} />
          <rect x={body.x} y={body.y} width={body.width} height={body.height} rx={body.rx} fill={RED} />
          {wheels.map((w) => (
            <circle key={w.cx} cx={w.cx} cy={w.cy} r={w.r} fill={NAVY} />
          ))}
        </g>
      </g>
    </>
  )
}

export default function TitleLogo({ still }: { still: boolean }) {
  const { x, y, width, height } = VIEWBOX
  return (
    <svg viewBox={`${x} ${y} ${width} ${height}`} width={`${width / WORDMARK.size}em`} aria-hidden="true">
      {!still && <style>{STYLE}</style>}
      <text
        x={WORDMARK.x}
        y={WORDMARK.y}
        fontFamily={WORDMARK.family}
        fontSize={WORDMARK.size}
        fontWeight={WORDMARK.weight}
        fill={WHITE}
        stroke={NAVY}
        strokeWidth={WORDMARK.edge}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {LOGO_TEXT}
      </text>
      <g transform={`translate(${TARGET.x} ${TARGET.y})`}>
        <Pop delay={TARGET_POP_S} still={still}>
          {TARGET.rings.map((ring) => (
            <circle key={ring.r} r={ring.r} fill={ring.fill} />
          ))}
        </Pop>
        <Pop delay={CROSSHAIR_LOCK_S} still={still} lock>
          <path d={CROSSHAIR_PATH} stroke={NAVY} strokeWidth={CROSSHAIR.edge} strokeLinecap="round" />
          <path d={CROSSHAIR_PATH} stroke={WHITE} strokeWidth={CROSSHAIR.width} strokeLinecap="round" />
        </Pop>
      </g>
      <RailRide still={still} />
    </svg>
  )
}
