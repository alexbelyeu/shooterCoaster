import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { eventBus } from '@/core/EventBus'

/**
 * Displays "Wave N!" announcements when new waves spawn.
 */
export default function WaveAnnouncement() {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const handler = (label: unknown) => {
      setText(label as string)
      setTimeout(() => setText(null), 2000)
    }
    eventBus.on('wave:announce', handler)
    return () => eventBus.off('wave:announce', handler)
  }, [])

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key={text}
          className="wave-announcement"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
