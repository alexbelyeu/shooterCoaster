import { describe, expect, it } from 'vitest'
import {
  bandEnergy, barLines, clippedSamples, compareTargets, fft, powerSpectrum, seamExcess, seamJump, silenceShare,
  soundEnvelope, stereoCorrelation,
} from './metrics.mjs'

const SR = 44100

const sine = (hz: number, seconds: number, amp = 0.5) =>
  Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR))

const bandsOf = (x: Float32Array) => bandEnergy(powerSpectrum([x, x]), SR)

describe('fft', () => {
  it('matches a direct DFT (a wrong bit-reversal permutation would not)', () => {
    const n = 16
    const x = Array.from({ length: n }, (_, i) => Math.sin(i * 1.3) + 0.5 * Math.cos(i * 0.4) + (i % 3))
    const re = Float64Array.from(x)
    const im = new Float64Array(n)
    fft(re, im)
    for (let k = 0; k < n; k++) {
      let dr = 0
      let di = 0
      for (let t = 0; t < n; t++) {
        dr += x[t] * Math.cos((-2 * Math.PI * k * t) / n)
        di += x[t] * Math.sin((-2 * Math.PI * k * t) / n)
      }
      expect(re[k]).toBeCloseTo(dr, 6)
      expect(im[k]).toBeCloseTo(di, 6)
    }
  })
})

describe('bandEnergy', () => {
  it('puts each tone in its band (a bin-to-Hz factor of 2 would move 50 Hz to low and 1.5 kHz to presence)', () => {
    expect(bandsOf(sine(50, 1)).sub.pct).toBeGreaterThan(95)
    expect(bandsOf(sine(1500, 1)).mid.pct).toBeGreaterThan(95)
    expect(bandsOf(sine(4000, 1)).presence.pct).toBeGreaterThan(95)
    expect(bandsOf(sine(9000, 1)).air.pct).toBeGreaterThan(95)
  })

  it('reports energy below 30 Hz relative to the total (a 20 Hz tone is nearly all of it, a 100 Hz tone none)', () => {
    expect(bandsOf(sine(20, 1)).below30.db).toBeGreaterThan(-1)
    expect(bandsOf(sine(100, 1)).below30.db).toBeLessThan(-40)
  })

  it('splits a two-tone mix by power (amplitude shares would give 67/33, not 80/20)', () => {
    const a = sine(100, 1, 0.4)
    const b = sine(1000, 1, 0.2)
    const mix = a.map((v, i) => v + b[i])
    const bands = bandsOf(mix)
    expect(bands.low.pct).toBeCloseTo(80, 0)
    expect(bands.mid.pct).toBeCloseTo(20, 0)
  })
})

describe('seamJump', () => {
  it('measures a doubling of amplitude across the seam as +6 dB (10·log of the amplitude ratio would say 3)', () => {
    const x = sine(440, 2, 0.25).map((v, i) => (i >= SR ? v * 2 : v))
    expect(seamJump([x, x], SR, 1)).toBeCloseTo(6.02, 1)
  })

  it('is 0 across a steady tone', () => {
    const x = sine(440, 2)
    expect(Math.abs(seamJump([x, x], SR, 1))).toBeLessThan(0.05)
  })
})

describe('seamExcess', () => {
  // A bar-long "pad" that swells on every downbeat: every bar line has the same raw jump.
  const barS = 1
  const swelling = (gapAt: number | null) =>
    Float32Array.from({ length: 6 * SR }, (_, i) => {
      const t = i / SR
      if (gapAt !== null && t >= gapAt - 0.3 && t < gapAt) return 0
      const inBar = (t % barS) / barS
      return (1 - 0.8 * inBar) * 0.3 * Math.sin(2 * Math.PI * 220 * t)
    })

  it('is ~0 for a clean loop whose downbeats all swell alike (the raw jump would fail it)', () => {
    const x = swelling(null)
    const bars = barLines(0, barS, 6, [3])
    expect(Math.abs(seamJump([x, x], SR, 3))).toBeGreaterThan(3)
    expect(Math.abs(seamExcess([x, x], SR, 3, bars))).toBeLessThan(0.3)
  })

  it('stands out when the seam has a gap before it', () => {
    const x = swelling(3)
    const bars = barLines(0, barS, 6, [3])
    expect(seamExcess([x, x], SR, 3, bars)).toBeGreaterThan(3)
  })

  it('matches the seam to the closest bar line, so a part resting every other bar passes (the median bar would not)', () => {
    const x = Float32Array.from({ length: 8 * SR }, (_, i) => (Math.floor(i / SR) % 2 ? 0 : 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR)))
    const bars = barLines(0, 1, 8, [4])
    expect(Math.abs(seamExcess([x, x], SR, 4, bars))).toBeLessThan(0.3)
  })
})

describe('barLines', () => {
  it('lists bar lines inside the render, without the seams or the last window', () => {
    expect(barLines(0.1, 1, 4.5, [2.1])).toEqual([1.1, 3.1])
  })
})

describe('silenceShare', () => {
  it('counts windows under −90 dBFS as silent, so dither-level noise is silence and −80 dB is not (an exact-zero test would miss both)', () => {
    const n = SR
    const half = Float32Array.from({ length: n }, (_, i) => (i < n / 2 ? 1e-5 * Math.sin(i) : 0.1 * Math.sin(i)))
    expect(silenceShare([half, half], SR)).toBeCloseTo(0.5, 2)
    const quiet = Float32Array.from({ length: n }, (_, i) => 1e-4 * Math.sin(i * 0.1))
    expect(silenceShare([quiet, quiet], SR)).toBeLessThan(0.05)
  })
})

describe('clippedSamples', () => {
  it('counts samples at 16-bit full scale and over, not just over 1 (">1" would miss a 16-bit clip)', () => {
    const x = Float32Array.from([0, 0.5, 32767 / 32768, -1, 1.2, 0.999])
    expect(clippedSamples([x])).toBe(3)
  })
})

describe('stereoCorrelation', () => {
  it('is 1 for mono, −1 for inverted channels, null for silence', () => {
    const x = sine(300, 0.1)
    expect(stereoCorrelation(x, x)).toBeCloseTo(1, 6)
    expect(stereoCorrelation(x, x.map((v) => -v))).toBeCloseTo(-1, 6)
    expect(stereoCorrelation(new Float32Array(10), new Float32Array(10))).toBeNull()
  })
})

describe('soundEnvelope', () => {
  it('times a 100 ms blip to silence and reads its peak', () => {
    const x = new Float32Array(SR)
    x.set(sine(1000, 0.1, 0.5), Math.round(0.2 * SR))
    const env = soundEnvelope([x, x], SR, 0.2, 1)
    expect(env.peakDb).toBeCloseTo(-6.02, 1)
    expect(env.tailMs).toBeGreaterThanOrEqual(95)
    expect(env.tailMs).toBeLessThanOrEqual(105)
  })
})

describe('compareTargets', () => {
  const status = (metrics: Record<string, number>, kind: string, key: string) =>
    compareTargets(metrics, kind).find((r: { key: string }) => r.key === key)?.status

  it('checks music loudness against −18…−16 LUFS', () => {
    expect(status({ integrated: -17 }, 'music', 'integrated')).toBe('pass')
    expect(status({ integrated: -20 }, 'music', 'integrated')).toBe('fail')
    expect(status({ integrated: -12 }, 'music', 'integrated')).toBe('fail')
  })

  it('shows a target meant for another kind as info, not a failure', () => {
    expect(status({ integrated: -30 }, 'mix', 'integrated')).toBe('info')
    expect(status({ shortTermMax: -30 }, 'music', 'shortTermMax')).toBe('info')
  })

  it('bounds the seam jump by its size, so a −1.5 dB drop fails (a signed check would pass it)', () => {
    expect(status({ seamJumpMax: -1.5 }, 'music', 'seamJumpMax')).toBe('fail')
    expect(status({ seamJumpMax: 0.4 }, 'music', 'seamJumpMax')).toBe('pass')
  })

  it('fails a true peak over −1 dBTP and any clipped sample', () => {
    expect(status({ truePeak: -0.5 }, 'mix', 'truePeak')).toBe('fail')
    expect(status({ clipped: 1 }, 'sfx', 'clipped')).toBe('fail')
    expect(status({ clipped: 0 }, 'sfx', 'clipped')).toBe('pass')
  })

  it('leaves out metrics the file has no value for', () => {
    expect(compareTargets({ truePeak: -3 }, 'music').map((r: { key: string }) => r.key)).toEqual(['truePeak'])
  })
})
