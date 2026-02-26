import * as Tone from 'tone'
import { sfxChannel, isAudioReady } from './AudioEngine'

let fireSynth: Tone.Synth | null = null
let popPing: Tone.Synth | null = null
let popSnap: Tone.NoiseSynth | null = null
let windNoise: Tone.Noise | null = null
let windFilter: Tone.Filter | null = null
let windGain: Tone.Gain | null = null

/*
 * Volume hierarchy (individual synth dB + sfxChannel -6 dB):
 *   Fire pew  : -20 → sits in background, fires 10×/sec
 *   Balloon pop: -14 snap + -18 ping → punchy but brief
 *   Wind      : gain 0–0.12 → ambient bed, never dominates
 */

function ensureSynths() {
  if (fireSynth) return

  // Soft laser "pew" — sine wave with smooth pitch sweep
  fireSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.005,
      decay: 0.12,
      sustain: 0,
      release: 0.06,
    },
    volume: -20,
  }).connect(sfxChannel)

  // Balloon pop — short high-pitched sine ping (rubber snap)
  popPing = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: 0.05,
      sustain: 0,
      release: 0.03,
    },
    volume: -18,
  }).connect(sfxChannel)

  // Balloon pop — bright noise burst (the "pop" itself)
  popSnap = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.001,
      decay: 0.06,
      sustain: 0,
    },
    volume: -14,
  }).connect(sfxChannel)
}

export function playFireSound(): void {
  if (!isAudioReady()) return
  ensureSynths()
  // Soft "pew" — start at a random mid-high pitch, sweep down smoothly
  const startFreq = 900 + Math.random() * 500
  const endFreq = 200 + Math.random() * 150
  const now = Tone.now()
  fireSynth!.triggerAttack(startFreq, now)
  fireSynth!.frequency.exponentialRampTo(endFreq, 0.1, now)
  fireSynth!.triggerRelease(now + 0.12)
}

/** Start continuous wind whoosh noise — call once on level start */
export function startWindWhoosh(): void {
  if (!isAudioReady() || windNoise) return

  windFilter = new Tone.Filter({
    frequency: 400,
    type: 'bandpass',
    Q: 0.5,
  })

  windGain = new Tone.Gain(0).connect(sfxChannel)
  windFilter.connect(windGain)

  windNoise = new Tone.Noise('white')
  windNoise.connect(windFilter)
  windNoise.start()
}

/** Update wind intensity based on velocity (0-1 normalized) */
export function updateWindWhoosh(velocityNormalized: number): void {
  if (!windFilter || !windGain) return
  // Map velocity to filter frequency (200-2000Hz) and volume
  const freq = 200 + velocityNormalized * 1800
  windFilter.frequency.rampTo(freq, 0.1)
  windGain.gain.rampTo(velocityNormalized * 0.12, 0.1)
}

/** Stop wind whoosh when leaving level */
export function stopWindWhoosh(): void {
  if (windNoise) {
    windNoise.stop()
    windNoise.dispose()
    windNoise = null
  }
  if (windFilter) {
    windFilter.dispose()
    windFilter = null
  }
  if (windGain) {
    windGain.dispose()
    windGain = null
  }
}

export function disposeSFX(): void {
  if (fireSynth) { fireSynth.dispose(); fireSynth = null }
  if (popPing) { popPing.dispose(); popPing = null }
  if (popSnap) { popSnap.dispose(); popSnap = null }
}

let lastExplosionTime = 0
const EXPLOSION_SOUND_MIN_INTERVAL = 30 // ms — throttle rapid pops

export function playExplosionSound(comboCount: number = 0): void {
  if (!isAudioReady()) return

  const now = performance.now()
  if (now - lastExplosionTime < EXPLOSION_SOUND_MIN_INTERVAL) return
  lastExplosionTime = now

  ensureSynths()

  const toneNow = Tone.now()
  // Balloon pop — snappy white noise burst
  popSnap!.triggerAttackRelease(0.05 + Math.random() * 0.02, toneNow)

  // Rubber-snap ping — pitch rises with combo for satisfying feedback
  const pingFreq = 1400 + Math.min(comboCount, 10) * 80 + Math.random() * 300
  popPing!.triggerAttackRelease(pingFreq, 0.04, toneNow)
}

