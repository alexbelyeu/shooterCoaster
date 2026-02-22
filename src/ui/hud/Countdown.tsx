import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CountdownProps {
  onComplete: () => void
}

const STEPS = ['Ready', 'Set', 'GO!']

export default function Countdown({ onComplete }: CountdownProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step < STEPS.length) {
      const timer = setTimeout(() => setStep((s) => s + 1), 1000)
      return () => clearTimeout(timer)
    } else {
      onComplete()
    }
  }, [step, onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {step < STEPS.length && (
          <motion.div
            key={step}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: "'Lobster', cursive",
              fontSize: step === STEPS.length - 1 ? '6rem' : '4rem',
              color: step === STEPS.length - 1 ? '#ffd700' : '#fff',
              textShadow: '0 0 20px rgba(255, 200, 0, 0.6), 0 4px 8px rgba(0,0,0,0.5)',
            }}
          >
            {STEPS[step]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
