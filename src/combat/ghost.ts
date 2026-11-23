/**
 * The ghost's storage (#844): a level's best campaign run as one compact string in localStorage, one key per level.
 * `version;stepMs;base64`, three bytes per sample (x 10 bits, y 10, shot 1), ~9.6 KB at most. Anything that doesn't
 * decode exactly (another version, a hand edit, half a write) is no ghost. Timeline and sampling: `ghostTrack.hot.ts`.
 */
import { GHOST_KEY as KEY } from './ghostKey'
import { GHOST_MAX_SAMPLES, decimateGhost, type GhostTrack } from './ghostTrack.hot'

export const GHOST_VERSION = 1

/** Decimates the track in place until it fits `GHOST_MAX_SAMPLES` (a recording never needs it). */
export function encodeGhost(t: GhostTrack): string {
  while (t.count > GHOST_MAX_SAMPLES) decimateGhost(t)
  let bytes = ''
  for (let i = 0; i < t.count; i++) {
    const x = t.x[i]
    const y = t.y[i]
    bytes += String.fromCharCode(x & 255, (x >> 8) | ((y & 63) << 2), (y >> 6) | (t.shot[i] << 4))
  }
  return `${GHOST_VERSION};${Math.round(t.step * 1000)};${btoa(bytes)}`
}

export function decodeGhost(raw: unknown): GhostTrack | null {
  if (typeof raw !== 'string') return null
  const [version, stepMs, payload, ...rest] = raw.split(';')
  const step = Number(stepMs) / 1000
  if (version !== String(GHOST_VERSION) || rest.length || !(step > 0 && step < 60)) return null
  let bytes: string
  try {
    bytes = atob(payload)
  } catch {
    return null
  }
  const count = bytes.length / 3
  if (!Number.isInteger(count) || count < 1 || count > GHOST_MAX_SAMPLES) return null
  const track: GhostTrack = { step, count, x: new Uint16Array(count), y: new Uint16Array(count), shot: new Uint8Array(count) }
  for (let i = 0; i < count; i++) {
    const b1 = bytes.charCodeAt(3 * i + 1)
    const b2 = bytes.charCodeAt(3 * i + 2)
    if (b2 > 31) return null
    track.x[i] = bytes.charCodeAt(3 * i) | ((b1 & 3) << 8)
    track.y[i] = (b1 >> 2) | ((b2 & 15) << 6)
    track.shot[i] = b2 >> 4
  }
  return track
}

/** A full or blocked storage just means no ghost. */
export function saveGhost(levelId: string, track: GhostTrack): void {
  try {
    if (track.count) localStorage.setItem(KEY + levelId, encodeGhost(track))
  } catch {
    // no ghost this time
  }
}

export function loadGhost(levelId: string): GhostTrack | null {
  try {
    return decodeGhost(localStorage.getItem(KEY + levelId))
  } catch {
    return null
  }
}
