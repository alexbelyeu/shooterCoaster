import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { noteRenderer, recordFrame } from './playerTelemetry'

/** Times the frames of play per level (not the countdown, not a pause) for the telemetry beacon (#373). */
export default function TelemetryFrameProbe() {
  const gl = useThree((s) => s.gl)
  useEffect(() => noteRenderer(gl.getContext()), [gl])
  useFrame((_, delta) => {
    const { phase, currentLevel } = useGameStore.getState()
    if (phase !== 'playing' || !currentLevel) return
    recordFrame(currentLevel, delta * 1000, useSettingsStore.getState().quality, gl.getPixelRatio())
  })
  return null
}
