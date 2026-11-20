import { useEffect, useRef, type CSSProperties } from 'react'
import { animate } from 'framer-motion'
import { bulbRing, bulbStar, counterWheels } from './resultsStats'

const fmt = new Intl.NumberFormat('en-US')
const COUNT_UP_S = 1.2
const RING = bulbRing(11, 2)
/** A wheel's faces: 0 to 9, then 0 again so 9 rolls on into 0. */
const FACES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/**
 * The score in its string of chaser bulbs (docs/art/PERSONALITY.md, the signature moment). The score rolls up like a
 * ticket counter while `counting`; at `lit` the bulbs light, chasing once round the ring when `chase`, and the third
 * of the ring for each earned star holds lit. `done` paints the final score at once.
 */
export default function ResultsMarquee({ score, stars, counting, lit, chase, done }: {
  score: number
  stars: number
  counting: boolean
  lit: boolean
  chase: boolean
  done: boolean
}) {
  const digits = String(score).length
  const strips = useRef<(HTMLSpanElement | null)[]>([])
  const commas = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (done) return
    const wheels: number[] = []
    const paint = (v: number) => {
      counterWheels(v, digits, wheels)
      for (let i = 0; i < digits; i++) {
        const strip = strips.current[i]
        if (!strip) continue
        strip.style.transform = `translateY(${(-wheels[i] / FACES.length) * 100}%)`
        // A leading wheel shows blank until the count reaches it, and a real 0 once it has rolled past 9.
        const place = digits - 1 - i
        const first = strip.firstElementChild
        const zero = place === 0 || v >= 10 ** (place + 1) - 1 ? '0' : ''
        if (first && first.textContent !== zero) first.textContent = zero
        const comma = commas.current[i]
        if (comma) comma.style.visibility = v >= 10 ** place ? 'visible' : 'hidden'
      }
    }
    if (!counting) {
      paint(0)
      return
    }
    const controls = animate(0, score, { duration: COUNT_UP_S, ease: 'easeOut', onUpdate: paint })
    return () => controls.stop()
  }, [counting, done, score, digits])

  const final = String(score)
  return (
    <div className="results-marquee" role="img" aria-label={`${fmt.format(score)} points`}>
      <span className={`results-bulbs${chase ? ' is-chasing' : ''}`} aria-hidden="true">
        {RING.map((p, i) => (
          <i
            key={i}
            className={lit && bulbStar(i, RING.length) < stars ? 'lit' : undefined}
            style={{ left: `${p.x}%`, top: `${p.y}%`, '--i': i } as CSSProperties}
          />
        ))}
      </span>
      <span className="results-score-value fair-number" aria-hidden="true">
        {[...final].map((d, i) => {
          const place = digits - 1 - i
          return (
            <span key={`${done ? 'd' : 'r'}${i}`} className="results-wheel-slot">
              <span className="results-wheel">
                {done ? (
                  <span className="results-wheel-strip">{d}</span>
                ) : (
                  <span
                    className="results-wheel-strip"
                    ref={(el) => {
                      strips.current[i] = el
                    }}
                  >
                    {FACES.map((f, j) => (
                      <span key={j}>{f}</span>
                    ))}
                  </span>
                )}
              </span>
              {place > 0 && place % 3 === 0 && (
                <span
                  className="results-comma"
                  ref={(el) => {
                    commas.current[i] = done ? null : el
                  }}
                >
                  ,
                </span>
              )}
            </span>
          )
        })}
      </span>
    </div>
  )
}
