import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { eventBus } from '@/core/EventBus'

interface ScorePopup {
  id: number
  score: number
  combo: number
  screenX: number
  screenY: number
}

let nextId = 0

const MAX_POPUPS = 6

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
    const { screenX, screenY, combo, score } = data as {
      screenX: number
      screenY: number
      combo: number
      score: number
    }

    const id = nextId++
    pendingRef.current.push({ id, score, combo, screenX, screenY })

    // Schedule removal
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) return
      setPopups((prev) => prev.filter((p) => p.id !== id))
    }, 1000)
    timeoutIdsRef.current.push(timeoutId)

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
            className="score-popup"
            initial={{ opacity: 1, x: popup.screenX, y: popup.screenY, scale: 0.5 }}
            animate={{ opacity: 0, x: popup.screenX, y: popup.screenY - 60, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            +{popup.score}
            {popup.combo > 1 && (
              <span className="score-popup-combo">x{popup.combo}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
