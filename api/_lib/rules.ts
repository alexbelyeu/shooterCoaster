/**
 * The online leaderboard's server rules (pure, unit-tested): what a submission must look like,
 * the per-IP rate limit and the IP hash. No imports from src/ at runtime: Vercel builds each
 * function on its own, without the game's `@/` alias.
 */
import { LEVEL_LIMITS } from './levelLimits.js'

export const BOARD_SIZE = 10
export const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 } as const
/** A real body is ~150 bytes. */
export const MAX_BODY_BYTES = 2048

/** Three letters A-Z: what `normalizeInitials` (src/store/leaderboard.ts) always produces. */
const INITIALS = /^[A-Z]{3}$/
const VERSION = /^[\w.+-]{1,40}$/

export interface Submission {
  level: string
  initials: string
  score: number
  seed: number
  kills: number
  accuracy: number
  version: string
}

export interface PublicEntry {
  initials: string
  score: number
  at: string
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

export function isCampaignLevel(level: unknown): level is string {
  return typeof level === 'string' && Object.prototype.hasOwnProperty.call(LEVEL_LIMITS, level)
}

const isInt = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max

/** The POST body, checked against the level's limits (`src/levels/scoreLimits.ts`). */
export function checkSubmission(body: unknown): Checked<Submission> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'bad body' }
  const { level, initials, score, seed, kills, accuracy, version } = body as Record<string, unknown>
  if (!isCampaignLevel(level)) return { ok: false, error: 'unknown level' }
  if (typeof initials !== 'string' || !INITIALS.test(initials)) return { ok: false, error: 'bad initials' }
  const limits = LEVEL_LIMITS[level]
  if (!isInt(score, 1, limits.maxScore)) return { ok: false, error: 'bad score' }
  if (!isInt(kills, 1, limits.maxKills)) return { ok: false, error: 'bad kills' }
  if (score > kills * limits.maxKillPoints) return { ok: false, error: 'score not possible with those kills' }
  if (!isInt(seed, 0, 0xffffffff)) return { ok: false, error: 'bad seed' }
  if (typeof accuracy !== 'number' || !(accuracy >= 0 && accuracy <= 1)) return { ok: false, error: 'bad accuracy' }
  if (typeof version !== 'string' || !VERSION.test(version)) return { ok: false, error: 'bad version' }
  return { ok: true, value: { level, initials, score, seed, kills, accuracy, version } }
}

/** True once `recent` accepted submissions from this IP fall inside the window. */
export function rateLimited(recent: number): boolean {
  return recent >= RATE_LIMIT.max
}

export function windowStart(now: number): string {
  return new Date(now - RATE_LIMIT.windowMs).toISOString()
}

/** Vercel puts the client's address first in `x-forwarded-for` (and in `x-real-ip`). */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

/** HMAC-SHA256 of the IP, hex: rate limiting works on this, and no raw IP is ever stored. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(ip)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 1-based rank from the number of scores at or above this one (itself included; earlier ties rank higher), or null off the board. */
export function rankFrom(atOrAbove: number): number | null {
  return atOrAbove >= 1 && atOrAbove <= BOARD_SIZE ? atOrAbove : null
}
