/**
 * Pure audio metric maths for `npm run audio:check` / `audio:render` (unit-tested in
 * metrics.test.ts). Inputs are Float32Array channels at a sample rate; loudness and
 * true peak come from ffmpeg's ebur128 instead (measure.mjs).
 */

export const dbFromPower = (p) => (p > 0 ? 10 * Math.log10(p) : -Infinity)
export const dbFromAmp = (a) => (a > 0 ? 20 * Math.log10(a) : -Infinity)

/** 16-bit full scale decodes to 32767/32768, so "at full scale" means within that of 1. */
export const FULL_SCALE = 32767 / 32768

/** Samples at or over digital full scale, across all channels. */
export function clippedSamples(channels) {
  let n = 0
  for (const ch of channels) for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) >= FULL_SCALE) n++
  return n
}

/** Share (0–1) of `windowS` windows whose peak, over all channels, is under `floorDb` dBFS: digital silence. */
export function silenceShare(channels, sampleRate, { windowS = 0.01, floorDb = -90 } = {}) {
  const len = channels[0].length
  const win = Math.max(1, Math.round(windowS * sampleRate))
  const floor = 10 ** (floorDb / 20)
  let silent = 0
  let total = 0
  for (let start = 0; start + win <= len; start += win) {
    let peak = 0
    for (const ch of channels) for (let i = start; i < start + win; i++) peak = Math.max(peak, Math.abs(ch[i]))
    total++
    if (peak < floor) silent++
  }
  return total ? silent / total : 1
}

/** Zero-lag correlation of L and R: 1 mono, 0 unrelated, < 0 cancels when summed to mono. null when silent. */
export function stereoCorrelation(left, right) {
  let lr = 0
  let ll = 0
  let rr = 0
  for (let i = 0; i < left.length; i++) {
    lr += left[i] * right[i]
    ll += left[i] * left[i]
    rr += right[i] * right[i]
  }
  return ll > 0 && rr > 0 ? lr / Math.sqrt(ll * rr) : null
}

/** In-place radix-2 FFT; `re.length` must be a power of two. */
export function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = (-2 * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(step * k)
        const wi = Math.sin(step * k)
        const a = start + k
        const b = a + size / 2
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

/** Average power spectrum of the mono sum (Hann frames, 50% overlap); bin k is k·sampleRate/size Hz. */
export function powerSpectrum(channels, size = 8192) {
  const len = channels[0].length
  const power = new Float64Array(size / 2 + 1)
  const hann = new Float64Array(size)
  for (let i = 0; i < size; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  let frames = 0
  for (let start = 0; start + size <= len; start += size / 2) {
    for (let i = 0; i < size; i++) {
      let m = 0
      for (const ch of channels) m += ch[start + i]
      re[i] = (m / channels.length) * hann[i]
      im[i] = 0
    }
    fft(re, im)
    for (let k = 0; k <= size / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k]
    frames++
  }
  if (frames) for (let k = 0; k < power.length; k++) power[k] /= frames
  return power
}

/** The sound bible's bands, plus `below30` (overlaps `sub`) for "nothing below 30 Hz". */
export const BANDS = [
  { name: 'sub', lo: 0, hi: 60 },
  { name: 'low', lo: 60, hi: 250 },
  { name: 'mid', lo: 250, hi: 2000 },
  { name: 'presence', lo: 2000, hi: 6000 },
  { name: 'air', lo: 6000, hi: Infinity },
]

/** Each band's share of the total energy, in % and dB relative to the total. A bin belongs to the band its centre falls in. */
export function bandEnergy(power, sampleRate, size = (power.length - 1) * 2) {
  const binHz = sampleRate / size
  const sums = Object.fromEntries([...BANDS.map((b) => [b.name, 0]), ['below30', 0]])
  let total = 0
  for (let k = 1; k < power.length; k++) {
    const hz = k * binHz
    const p = power[k]
    total += p
    for (const b of BANDS) if (hz >= b.lo && hz < b.hi) sums[b.name] += p
    if (hz < 30) sums.below30 += p
  }
  const out = {}
  for (const [name, p] of Object.entries(sums)) {
    out[name] = { pct: total ? (100 * p) / total : 0, db: total ? dbFromPower(p / total) : -Infinity }
  }
  return out
}

function rmsDb(channels, from, to) {
  let sum = 0
  let n = 0
  for (const ch of channels) for (let i = Math.max(0, from); i < Math.min(ch.length, to); i++, n++) sum += ch[i] * ch[i]
  return n ? dbFromPower(sum / n) : -Infinity
}

/** Silence reads as this, so a jump out of silence is a large finite number. */
const JUMP_FLOOR_DB = -100

/**
 * Level jump across a loop point: RMS of the `windowS` after `seamS` minus the `windowS`
 * before it, in dB (+ = louder after). Windows of ~400 ms (loudness's momentary window)
 * average over a beat or two, so a drum hit next to the seam doesn't read as a jump.
 */
export function seamJump(channels, sampleRate, seamS, windowS = 0.4) {
  const at = Math.round(seamS * sampleRate)
  const w = Math.round(windowS * sampleRate)
  const level = (from, to) => Math.max(JUMP_FLOOR_DB, rmsDb(channels, from, to))
  return level(at, at + w) - level(at - w, at)
}

/**
 * The seam's jump minus the closest jump at one of the loop's other bar lines
 * (`barTimes`), in dB. Music swells on downbeats, so a clean loop's seam jumps like some
 * bar line inside it does (the closest, not the typical one: a part that rests every other
 * bar has two kinds of bar line). A gap, cut or level change at the seam matches none.
 * Without bar lines it is the raw jump.
 */
export function seamExcess(channels, sampleRate, seamS, barTimes = []) {
  const jump = seamJump(channels, sampleRate, seamS)
  let closest = null
  for (const t of barTimes) {
    const diff = jump - seamJump(channels, sampleRate, t)
    if (closest === null || Math.abs(diff) < Math.abs(closest)) closest = diff
  }
  return closest ?? jump
}

/** Bar lines from `startS` every `barS` up to `endS` (minus a window), skipping the seams. */
export function barLines(startS, barS, endS, seams, windowS = 0.4) {
  const bars = []
  for (let k = 1; startS + k * barS < endS - windowS; k++) {
    const t = startS + k * barS
    if (!seams.some((s) => Math.abs(s - t) < barS / 2)) bars.push(t)
  }
  return bars
}

/**
 * One SFX alone in [startS, endS): its peak (dBFS) and how long after `startS` its 5 ms
 * RMS envelope last rises above `floorDb` (time to silence).
 */
export function soundEnvelope(channels, sampleRate, startS, endS, { floorDb = -60, windowS = 0.005 } = {}) {
  const from = Math.round(startS * sampleRate)
  const to = Math.min(channels[0].length, Math.round(endS * sampleRate))
  const win = Math.max(1, Math.round(windowS * sampleRate))
  let peak = 0
  for (const ch of channels) for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(ch[i]))
  let lastLoud = -1
  for (let s = from; s + win <= to; s += win) if (rmsDb(channels, s, s + win) > floorDb) lastLoud = s + win
  return { peakDb: dbFromAmp(peak), tailMs: lastLoud < 0 ? 0 : ((lastLoud - from) / sampleRate) * 1000 }
}

/**
 * Mix targets from docs/audio/SOUND-BIBLE.md, per render kind ('music' = music bus alone,
 * 'mix' = full game mix in combat, 'sfx' = an SFX sheet). `min`/`max` bound the value;
 * a row without a bound is shown for information. Keep in step with the bible.
 */
export const TARGETS = [
  { key: 'integrated', label: 'Integrated loudness', unit: 'LUFS', kinds: ['music'], min: -18, max: -16 },
  { key: 'shortTermMax', label: 'Short-term max', unit: 'LUFS', kinds: ['mix'], min: -15, max: -13, note: '≈ −14' },
  { key: 'truePeak', label: 'True peak', unit: 'dBTP', max: -1 },
  { key: 'clipped', label: 'Clipped samples', unit: '', max: 0 },
  { key: 'below30Db', label: 'Energy below 30 Hz', unit: 'dB rel', max: -30, note: '"nothing below 30 Hz"' },
  { key: 'correlation', label: 'Stereo correlation', unit: '', min: 0, note: 'mono-compatible' },
  { key: 'seamJumpMax', label: 'Loop-seam jump vs bar lines', unit: 'dB', max: 1, abs: true, note: 'worst seam' },
  { key: 'gunTailMs', label: 'Gun to silence (−60 dB)', unit: 'ms', kinds: ['sfx'], max: 150 },
  { key: 'lra', label: 'Loudness range', unit: 'LU' },
  { key: 'silence', label: 'Digital silence', unit: '%' },
]

/**
 * One row per target with a value: pass / fail against its bounds where the target
 * applies to `kind`, info otherwise (e.g. a music render's short-term max).
 */
export function compareTargets(metrics, kind) {
  const rows = []
  for (const t of TARGETS) {
    const value = metrics[t.key]
    if (value === undefined || value === null) continue
    const applies = (!t.kinds || t.kinds.includes(kind)) && (t.min !== undefined || t.max !== undefined)
    const v = t.abs ? Math.abs(value) : value
    const ok = (t.min === undefined || v >= t.min) && (t.max === undefined || v <= t.max)
    rows.push({ ...t, value, status: applies ? (ok ? 'pass' : 'fail') : 'info' })
  }
  return rows
}

/** The target as shown in tables; '—' for an info row. */
export function targetText(t) {
  if (t.status === 'info') return '—'
  if (t.note && t.min !== undefined && t.max !== undefined) return `${t.note} (${t.min}…${t.max})`
  if (t.min !== undefined && t.max !== undefined) return `${t.min} … ${t.max}`
  if (t.max !== undefined) return `${t.abs ? '|x| ' : ''}≤ ${t.max}${t.note ? ` (${t.note})` : ''}`
  if (t.min !== undefined) return `≥ ${t.min}${t.note ? ` (${t.note})` : ''}`
  return '—'
}
