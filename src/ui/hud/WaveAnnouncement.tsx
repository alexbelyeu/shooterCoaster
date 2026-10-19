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
 */
export default function WaveAnnouncement() {
  const [text, setText] = useState<string | null>(null)
  const clearTextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const theme = biomeTheme(currentLevel ? getLevelConfig(currentLevel)?.biome : null)

  useEffect(() => {
    const handler = (label: unknown) => {
      setText(label as string)
      if (clearTextTimeoutRef.current) clearTimeout(clearTextTimeoutRef.current)
      clearTextTimeoutRef.current = setTimeout(() => setText(null), SHOW_MS)
    }
    eventBus.on('wave:announce', handler)
    return () => {
      if (clearTextTimeoutRef.current) clearTimeout(clearTextTimeoutRef.current)
      clearTextTimeoutRef.current = null
      eventBus.off('wave:announce', handler)
    }
  }, [])

  const style = { '--hud-accent': theme.accent, '--hud-glow': theme.glow } as CSSProperties

  return (
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
  )
}
