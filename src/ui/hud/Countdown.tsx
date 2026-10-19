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
    <div className="countdown">
      <AnimatePresence mode="wait">
        {step < STEPS.length && (
          <motion.div
            key={step}
            className={`countdown-step${step === STEPS.length - 1 ? ' countdown-step--go' : ''}`}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {STEPS[step]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
