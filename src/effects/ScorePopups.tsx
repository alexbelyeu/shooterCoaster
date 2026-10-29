import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { eventBus } from '@/core/EventBus'
import { isFeedbackHeld } from '@/combat/hitFeedback'

interface ScorePopup {
  id: number
  score: number
  multiplier: number
  screenX: number
  screenY: number
  /** Test hold (`holdFeedback`): stays at full opacity until released. */
  held: boolean
}

let nextId = 0

const MAX_POPUPS = 6
const POPUP_MS = 1000
/** A boss defeat and other big scores get the big popup. */
const BIG_SCORE = 200

/**
 * Renders floating score popups projected from 3D kill positions.
 * Listens to 'enemy:killed:screen' events emitted with screen coords.
 * Batches rapid kills into a single state update to avoid AnimatePresence thrashing.
 */
export default function ScorePopups() {
  const [popups, setPopups] = useState<ScorePopup[]>([])
  const pendingRef = useRef<ScorePopup[]>([])
  const flushScheduled = useRef(false)
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const mountedRef = useRef(true)

  const handleKill = useCallback((data: unknown) => {
    const { screenX, screenY, multiplier, score } = data as {
      screenX: number
      screenY: number
      multiplier: number
      score: number
    }

    const id = nextId++
    pendingRef.current.push({ id, score, multiplier, screenX, screenY, held: isFeedbackHeld() })

    // Schedule removal (re-armed while a test holds feedback)
    const remove = () => {
      if (!mountedRef.current) return
      if (isFeedbackHeld()) timeoutIdsRef.current.push(setTimeout(remove, POPUP_MS))
      else setPopups((prev) => prev.filter((p) => p.id !== id))
    }
    timeoutIdsRef.current.push(setTimeout(remove, POPUP_MS))

    // Batch: flush pending popups once per microtask
    if (!flushScheduled.current) {
      flushScheduled.current = true
      queueMicrotask(() => {
        if (!mountedRef.current) return
        const batch = pendingRef.current
        pendingRef.current = []
        flushScheduled.current = false
        setPopups((prev) => {
          const next = [...prev, ...batch]
          return next.length > MAX_POPUPS ? next.slice(next.length - MAX_POPUPS) : next
        })
      })
    }
  }, [])

  useEffect(() => {
    eventBus.on('enemy:killed:screen', handleKill)
    return () => {
      mountedRef.current = false
      for (const timeoutId of timeoutIdsRef.current) clearTimeout(timeoutId)
      timeoutIdsRef.current = []
      pendingRef.current = []
      flushScheduled.current = false
      eventBus.off('enemy:killed:screen', handleKill)
    }
  }, [handleKill])

  return (
    <div className="score-popups-container">
      <AnimatePresence>
        {popups.map((popup) => (
          <motion.div
            key={popup.id}
            className={popup.score >= BIG_SCORE ? 'score-popup score-popup--big' : 'score-popup'}
            initial={{ opacity: 1, x: popup.screenX, y: popup.screenY, scale: 0.5 }}
            animate={{ opacity: popup.held ? 1 : 0, x: popup.screenX, y: popup.screenY - 60, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            +{popup.score}
            {popup.multiplier > 1 && (
              <span className="score-popup-combo">×{popup.multiplier}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
