import { describe, expect, it } from 'vitest'
import { createHapticState, HAPTIC_MIN_GAP_MS, HAPTIC_PATTERNS, hapticFor, type HapticGates } from './haptics'

const ON: HapticGates = { enabled: true, reducedMotion: false, canVibrate: true }
const total = (p: number | readonly number[]) => (typeof p === 'number' ? p : p.reduce((a, b) => a + b, 0))

describe('haptics', () => {
  it('plays a distinct pattern per event, kill shortest and defeat longest', () => {
    const kill = hapticFor(createHapticState(), 'kill', 0, ON)
    const weakPoint = hapticFor(createHapticState(), 'weakPoint', 0, ON)
    const defeat = hapticFor(createHapticState(), 'defeat', 0, ON)
    expect([kill, weakPoint, defeat]).toEqual([HAPTIC_PATTERNS.kill, HAPTIC_PATTERNS.weakPoint, HAPTIC_PATTERNS.defeat])
    expect(total(kill!)).toBeLessThan(total(weakPoint!))
    expect(total(weakPoint!)).toBeLessThan(total(defeat!))
  })

  it('is off when the setting is off, under reduced motion, or without navigator.vibrate', () => {
    for (const gates of [
      { ...ON, enabled: false },
      { ...ON, reducedMotion: true },
      { ...ON, canVibrate: false },
    ]) {
      expect(hapticFor(createHapticState(), 'defeat', 0, gates)).toBeNull()
    }
  })

  it('rate-limits a burst of kills to one buzz per gap', () => {
    const state = createHapticState()
    let played = 0
    for (let t = 0; t < 1000; t += 10) if (hapticFor(state, 'kill', t, ON)) played++
    expect(played).toBe(Math.ceil(1000 / HAPTIC_MIN_GAP_MS))
  })

  it('lets a stronger event cut in, never a weaker one', () => {
    const state = createHapticState()
    expect(hapticFor(state, 'kill', 0, ON)).not.toBeNull()
    expect(hapticFor(state, 'defeat', 5, ON)).toBe(HAPTIC_PATTERNS.defeat)
    // The defeat's whole pattern holds the motor against kills and weak points.
    const defeatEnd = 5 + total(HAPTIC_PATTERNS.defeat)
    expect(hapticFor(state, 'weakPoint', defeatEnd - 1, ON)).toBeNull()
    expect(hapticFor(state, 'kill', defeatEnd - 1, ON)).toBeNull()
    expect(hapticFor(state, 'kill', defeatEnd, ON)).toBe(HAPTIC_PATTERNS.kill)
  })
})
