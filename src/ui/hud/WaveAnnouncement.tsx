import { useEffect, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { eventBus } from '@/core/EventBus'
import { FairBoard } from '@/ui/Fair'

const SHOW_MS = 2000

/** The wave's show card, up for 2 s; `wave:incoming`, 1 s before a wave, shows it early with a vermilion frame's flash. */
export default function WaveAnnouncement() {
  const [text, setText] = useState<string | null>(null)
  const [tells, setTells] = useState(0)
  const clearTextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  return (
    <>
      {/* Keyed per tell so each one restarts the CSS flash. */}
      {tells > 0 && <div key={tells} className="wave-tell" aria-hidden />}
      <div className="wave-announcement">
        <AnimatePresence>
          {text && (
            <m.div key={text} className="wave-banner" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <FairBoard className="wave-card" shadowClassName="wave-card-shadow fair-hook">
                <span className="wave-banner-text fair-title">{text}</span>
              </FairBoard>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
