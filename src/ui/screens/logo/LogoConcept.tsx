import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { LogoOption } from './logoOptions'

/**
 * The three title logo concepts (#476), each one inline SVG over the self-hosted Lobster: white letters with a
 * navy edge, gold and red accents. Each plays one short build-in when it mounts (CSS pops, a car ride on rAF),
 * then holds still; `still` (reduced motion) draws the final frame at once. Lazy-loaded by TitleScreen under `?logo=`.
 *
 * Coordinates are in Lobster units at font-size 160 with the baseline at y = 200: the wordmark runs x 0..940,
 * its caps and ascenders reach y ≈ 80, its x-height y ≈ 118. The o's centres were measured in Chromium.
 */

const NAVY = '#14213d'
const WHITE = '#fff'
const GOLD = '#ffc93c'
const RED = '#ff4757'

const FONT_SIZE = 160
const O_CENTRES: readonly [number, number][] = [
  [181, 160],
  [251, 160],
  [573, 160],
]

const STYLE = `
.logo-pop { transform-box: fill-box; transform-origin: center; animation: logo-pop 0.45s cubic-bezier(0.3, 1.6, 0.5, 1) both; }
.logo-lock { transform-box: fill-box; transform-origin: center; animation: logo-lock 0.35s ease-out both; }
@keyframes logo-pop { from { transform: scale(0); } }
@keyframes logo-lock { from { transform: scale(1.8); opacity: 0; } }
`

function Wordmark() {
  return (
    <text
      x={0}
      y={200}
      fontFamily="Lobster, cursive"
      fontSize={FONT_SIZE}
      fill={WHITE}
      stroke={NAVY}
      strokeWidth={12}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      ShooterCoaster
    </text>
  )
}

/** Scales its children in from nothing after `delay` s; `still` shows them at once. */
function Pop({ delay, still, lock, children }: { delay: number; still: boolean; lock?: boolean; children: ReactNode }) {
  if (still) return <g>{children}</g>
  return (
    <g className={lock ? 'logo-lock' : 'logo-pop'} style={{ animationDelay: `${delay}s` }}>
      {children}
    </g>
  )
}

function Target({ r, bull = RED }: { r: number; bull?: string }) {
  return (
    <>
      <circle r={r + 6} fill={NAVY} />
      <circle r={r} fill={WHITE} />
      <circle r={r * 0.76} fill={RED} />
      <circle r={r * 0.52} fill={WHITE} />
      <circle r={r * 0.28} fill={bull} />
    </>
  )
}

/** Four crosshair ticks round a target, from `inner` to `outer`. */
function Crosshair({ inner, outer }: { inner: number; outer: number }) {
  const d = `M0 ${-outer}V${-inner}M0 ${inner}V${outer}M${-outer} 0H${-inner}M${inner} 0H${outer}`
  return (
    <>
      <path d={d} stroke={NAVY} strokeWidth={13} strokeLinecap="round" />
      <path d={d} stroke={WHITE} strokeWidth={5} strokeLinecap="round" />
    </>
  )
}

/** A coaster car (red, one rider) standing on the rail at the origin, facing +x. */
function Car() {
  return (
    <g stroke={NAVY} strokeWidth={5}>
      <circle cx={4} cy={-33} r={7} fill={WHITE} />
      <rect x={-25} y={-28} width={50} height={22} rx={7} fill={RED} />
      <circle cx={-13} cy={-5} r={5} fill={NAVY} />
      <circle cx={13} cy={-5} r={5} fill={NAVY} />
    </g>
  )
}

/** A ride along a rail: the car waits `wait` s, then runs the track in `ride` s, the rail drawing in under it. */
interface Ride {
  wait: number
  ride: number
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/**
 * A rail along `d` with a car on it. On mount the car rides it once on rAF (so `npm run clip`'s virtual time steps
 * it like the rest of the page) with the rail drawing in behind it, then parks at the end; `still` parks it at once.
 */
function RailRide({ d, timing, still }: { d: string; timing: Ride; still: boolean }) {
  const rail = useRef<SVGPathElement>(null)
  const edge = useRef<SVGPathElement>(null)
  const car = useRef<SVGGElement>(null)

  useLayoutEffect(() => {
    const path = rail.current
    if (!path) return
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
    if (still) {
      place(1)
      return
    }
    place(0)
    let raf = 0
    let start = -1
    const tick = (now: number) => {
      if (start < 0) start = now
      const t = Math.min(1, Math.max(0, ((now - start) / 1000 - timing.wait) / timing.ride))
      place(easeInOut(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [still, timing.wait, timing.ride])

  const stroke = { d, fill: 'none', strokeLinecap: 'round' as const, pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 }
  return (
    <>
      <path ref={edge} {...stroke} stroke={NAVY} strokeWidth={17} />
      <path ref={rail} {...stroke} stroke={GOLD} strokeWidth={7} />
      <g ref={car}>
        <Car />
      </g>
    </>
  )
}

/** Alex's first idea: the o's are targets; Coaster's takes the hit. */
function Bullseye({ still }: { still: boolean }) {
  return (
    <svg viewBox="-24 40 990 190" width={`${990 / FONT_SIZE}em`}>
      <Wordmark />
      {O_CENTRES.map(([x, y], i) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <Pop delay={0.25 + i * 0.15} still={still}>
            <Target r={38} bull={i === 2 ? GOLD : RED} />
          </Pop>
          {i === 2 && (
            <Pop delay={0.95} still={still} lock>
              <Crosshair inner={49} outer={62} />
            </Pop>
          )}
        </g>
      ))}
    </svg>
  )
}

const HILLS =
  'M-30 190C0 110 30 48 70 48S150 108 210 108S310 80 345 80S380 108 420 108S500 48 540 48S580 108 640 108S770 80 800 80S850 108 900 108L960 108'
const HILLS_RIDE: Ride = { wait: 0.3, ride: 1.8 }

/** Alex's second idea: a rail rides over the letters, up the caps and down between them, a car on it. */
function Coaster({ still }: { still: boolean }) {
  return (
    <svg viewBox="-44 10 1030 210" width={`${1030 / FONT_SIZE}em`}>
      <Wordmark />
      <RailRide d={HILLS} timing={HILLS_RIDE} still={still} />
    </svg>
  )
}

const LOOP_CENTRE: [number, number] = [1050, 140]
const LOOP_RIDE: Ride = { wait: 0.3, ride: 2.3 }
const LOOP_TRACK = 'M-20 232C300 236 700 232 960 232C1030 232 1105 200 1105 140A55 55 0 1 0 995 140C995 200 1040 238 1120 238'

/** The blend: the rail runs under the wordmark into a loop, and the loop is the target. */
function Loop({ still }: { still: boolean }) {
  return (
    <svg viewBox="-32 52 1185 202" width={`${1185 / FONT_SIZE}em`}>
      <Wordmark />
      <g transform={`translate(${LOOP_CENTRE[0]} ${LOOP_CENTRE[1]})`}>
        <Pop delay={1.9} still={still}>
          <circle r={34} fill={RED} />
          <circle r={22} fill={WHITE} />
          <circle r={10} fill={RED} />
        </Pop>
        <Pop delay={2.5} still={still} lock>
          <Crosshair inner={66} outer={80} />
        </Pop>
      </g>
      <RailRide d={LOOP_TRACK} timing={LOOP_RIDE} still={still} />
    </svg>
  )
}

const CONCEPTS: Record<LogoOption, (props: { still: boolean }) => ReactNode> = { bullseye: Bullseye, coaster: Coaster, loop: Loop }

export default function LogoConcept({ name, still }: { name: LogoOption; still: boolean }) {
  const Concept = CONCEPTS[name]
  return (
    <>
      {!still && <style>{STYLE}</style>}
      <Concept still={still} />
    </>
  )
}
