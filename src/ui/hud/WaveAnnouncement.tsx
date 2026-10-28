import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { biomeTheme } from '@/ui/theme'

const SHOW_MS = 2000

/**
 * Wave banner: letterspaced caps between two accent rules, slides in from the
 * left and out to the right, tinted with the level's biome accent.
 *
 * `wave:incoming` (1 s before a wave arrives) shows the label early and pulses a
 * screen-edge glow; `wave:announce` (on arrival, and the first wave) shows it too.
 */
export default function WaveAnnouncement() {
  const [text, setText] = useState<string | null>(null)
  const [tells, setTells] = useState(0)
  const clearTextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const theme = biomeTheme(currentLevel ? getLevelConfig(currentLevel)?.biome : null)

  useEffect(() => {
    const handler = (label: unknown) => {
      if (typeof label !== 'string' || !label) return
      setText(label)
      if (clearTextTimeoutRef.current) clearTimeout(clearTextTimeoutRef.current)
      clearTextTimeoutRef.current = setTimeout(() => setText(null), SHOW_MS)
    }
    const incoming = (label: unknown) => {
      setTells((n) => n + 1)
      handler(label)
    }
    eventBus.on('wave:announce', handler)
    eventBus.on('wave:incoming', incoming)
    return () => {
      if (clearTextTimeoutRef.current) clearTimeout(clearTextTimeoutRef.current)
      clearTextTimeoutRef.current = null
      eventBus.off('wave:announce', handler)
      eventBus.off('wave:incoming', incoming)
    }
  }, [])

  const style = { '--hud-accent': theme.accent, '--hud-glow': theme.glow } as CSSProperties

  return (
    <>
      {/* Keyed per tell so each one restarts the CSS pulse. */}
      {tells > 0 && <div key={tells} className="wave-tell" style={style} aria-hidden />}
      <div className="wave-announcement" style={style}>
        <AnimatePresence>
          {text && (
            <motion.div
              key={text}
              className="wave-banner"
              initial={{ opacity: 0, x: '-40vw' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '40vw' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="wave-banner-rule" />
              <span className="wave-banner-text">{text}</span>
              <span className="wave-banner-rule" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
