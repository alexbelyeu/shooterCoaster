/** ffmpeg side of the audio toolkit: decode, EBU R128 loudness + true peak, spectrogram, MP3. */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import {
  bandEnergy, barLines, clippedSamples, compareTargets, powerSpectrum, seamExcess, seamJump, silenceShare, soundEnvelope, stereoCorrelation, targetText,
} from './metrics.mjs'

export const SAMPLE_RATE = 44100

export function requireFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  } catch {
    throw new Error('ffmpeg not found: install it (apt-get install -y ffmpeg)')
  }
}

/** Any file ffmpeg reads → stereo float channels at 44.1 kHz. */
export function decode(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SAMPLE_RATE), '-'], {
    maxBuffer: 1 << 30,
  })
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
  const n = pcm.length / 2
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    left[i] = pcm[2 * i]
    right[i] = pcm[2 * i + 1]
  }
  return [left, right]
}

/** Integrated, LRA and true peak from the ebur128 summary; short-term max from its 100 ms log lines. */
export function loudness(file) {
  const r = spawnSync('ffmpeg', ['-nostats', '-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  if (r.status !== 0) throw new Error(`ffmpeg ebur128 failed on ${file}: ${r.stderr.slice(-400)}`)
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'))
  const num = (re) => {
    const m = summary.match(re)
    return m ? Number(m[1]) : null
  }
  let shortTermMax = -Infinity
  for (const m of r.stderr.matchAll(/ S:\s*(-?[\d.]+|-inf)/g)) if (m[1] !== '-inf') shortTermMax = Math.max(shortTermMax, Number(m[1]))
  const finite = (x) => (x === null || !Number.isFinite(x) ? null : x)
  return {
    integrated: finite(num(/I:\s*(-?[\d.]+) LUFS/)),
    lra: finite(num(/LRA:\s*(-?[\d.]+) LU/)),
    truePeak: finite(num(/True peak:\s*Peak:\s*(-?[\d.]+|-inf) dBFS/)),
    shortTermMax: finite(shortTermMax),
  }
}

const round = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? x ?? null : Math.round(x * 10 ** d) / 10 ** d)

/**
 * Every metric the toolkit reports for one file. `seams`: loop points in seconds; with
 * `bar` ({startS, barS}: where bar 1 starts and how long a bar is) each seam's jump is
 * measured against the jumps at the other bar lines.
 * `sounds`: an SFX sheet's `{t, name}` list; each is measured alone up to the next one,
 * and the single shots (names starting "fire (") give the gun's time to silence.
 */
export function measure(file, { seams = [], bar = null, sounds = [] } = {}) {
  const channels = decode(file)
  const bands = bandEnergy(powerSpectrum(channels), SAMPLE_RATE)
  const end = channels[0].length / SAMPLE_RATE
  const bars = bar ? barLines(bar.startS, bar.barS, end, seams) : []
  const jumps = seams.map((s) => ({
    at: round(s, 3),
    db: round(seamJump(channels, SAMPLE_RATE, s)),
    vsBars: round(seamExcess(channels, SAMPLE_RATE, s, bars)),
  }))
  const worst = jumps.reduce((w, j) => (w === null || Math.abs(j.vsBars) > Math.abs(w) ? j.vsBars : w), null)
  const l = loudness(file)
  const items = sounds.map((s, i) => {
    const env = soundEnvelope(channels, SAMPLE_RATE, s.t, sounds[i + 1]?.t ?? end)
    return { t: s.t, name: s.name, peakDb: round(env.peakDb, 1), tailMs: Math.round(env.tailMs) }
  })
  const shots = items.filter((s) => s.name.startsWith('fire ('))
  return {
    seconds: round(channels[0].length / SAMPLE_RATE),
    integrated: round(l.integrated, 1),
    shortTermMax: round(l.shortTermMax, 1),
    lra: round(l.lra, 1),
    truePeak: round(l.truePeak, 1),
    clipped: clippedSamples(channels),
    silence: round(silenceShare(channels, SAMPLE_RATE) * 100, 1),
    correlation: round(stereoCorrelation(channels[0], channels[1]), 3),
    below30Db: round(bands.below30.db, 1),
    bands: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, { pct: round(v.pct, 1), db: round(v.db, 1) }])),
    seamJumps: jumps,
    seamJumpMax: worst,
    ...(shots.length ? { gunTailMs: Math.max(...shots.map((s) => s.tailMs)) } : {}),
    ...(items.length ? { sounds: items } : {}),
  }
}

/** Plain-text table of `metrics` against the sound bible's targets for `kind`; returns [text, anyFail]. */
export function targetTable(metrics, kind) {
  const rows = compareTargets(metrics, kind)
  const fmt = (v) => (typeof v === 'number' ? String(v) : String(v ?? '—'))
  const lines = rows.map((r) => [r.label, `${fmt(r.value)} ${r.unit}`.trim(), targetText(r), r.status.toUpperCase()])
  const bandLine = metrics.bands
    ? ['Bands sub/low/mid/pres/air', ['sub', 'low', 'mid', 'presence', 'air'].map((b) => `${metrics.bands[b].pct}%`).join(' / '), '(spectrogram)', 'INFO']
    : null
  if (bandLine) lines.push(bandLine)
  const widths = [0, 1, 2, 3].map((i) => Math.max(...lines.map((l) => l[i].length), 6))
  const text = lines.map((l) => l.map((c, i) => c.padEnd(widths[i])).join('  ')).join('\n')
  return [text, rows.some((r) => r.status === 'fail')]
}

/** An SFX sheet's per-sound lines. */
export function soundLines(sounds) {
  return sounds.map((s) => `  ${String(s.t).padStart(5)} s  ${s.name.padEnd(40)} peak ${s.peakDb} dBFS, silent after ${s.tailMs} ms`).join('\n')
}

/** Log-frequency spectrogram PNG, shrunk until it is under `maxBytes`. */
export function spectrogram(file, png, maxBytes = 150 * 1024) {
  for (const [w, h] of [[800, 300], [640, 240], [480, 200]]) {
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-i', file, '-lavfi',
      `aformat=channel_layouts=mono,showspectrumpic=s=${w}x${h}:scale=log:fscale=log:legend=1:color=intensity,format=pal8`,
      png,
    ])
    if (fs.statSync(png).size <= maxBytes) return
  }
}

export function toMp3(wav, mp3) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3])
}

/** 32-bit float stereo WAV, so clipping is measured on the exact render. */
export function writeFloatWav(file, interleaved, sampleRate) {
  const data = Buffer.from(interleaved.buffer, interleaved.byteOffset, interleaved.byteLength)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(3, 20) // IEEE float
  h.writeUInt16LE(2, 22)
  h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(sampleRate * 8, 28)
  h.writeUInt16LE(8, 32)
  h.writeUInt16LE(32, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  fs.writeFileSync(file, Buffer.concat([h, data]))
}
