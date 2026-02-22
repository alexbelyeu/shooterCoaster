import { useEffect, useState, useCallback } from 'react'
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

/**
 * Renders floating score popups projected from 3D kill positions.
 * Listens to 'enemy:killed:screen' events emitted with screen coords.
 */
export default function ScorePopups() {
  const [popups, setPopups] = useState<ScorePopup[]>([])

  const handleKill = useCallback((data: unknown) => {
    const { screenX, screenY, combo, score } = data as {
      screenX: number
      screenY: number
      combo: number
      score: number
    }

    const id = nextId++
    setPopups((prev) => [...prev, { id, score, combo, screenX, screenY }])

    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id))
    }, 1000)
  }, [])

  useEffect(() => {
    eventBus.on('enemy:killed:screen', handleKill)
    return () => eventBus.off('enemy:killed:screen', handleKill)
  }, [handleKill])

  return (
    <div className="score-popups-container">
      <AnimatePresence>
        {popups.map((popup) => (
          <motion.div
            key={popup.id}
            className="score-popup"
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -60, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{
              left: popup.screenX,
              top: popup.screenY,
            }}
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
