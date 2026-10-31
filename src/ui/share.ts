import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'

/** Share copy for the results screen (#87); the `/go/share` path attributes visits, since UTM dimensions are paywalled. */
export const SITE_URL = 'https://scoaster.com/'
const SHARE_PATH = 'go/share'

export interface ShareRun {
  levelName: string
  score: number
  stars: number
  url: string
}

export interface SharePayload {
  title: string
  text: string
  url: string
}

export function buildShareUrl(campaign: string): string {
  const query = new URLSearchParams({ utm_source: 'share', utm_medium: 'organic', utm_campaign: campaign })
  return `${SITE_URL}${SHARE_PATH}?${query}`
}

/** 3 stars as ★ earned / ☆ missed. */
export function starString(stars: number): string {
  const earned = Math.max(0, Math.min(3, Math.round(stars)))
  return '★'.repeat(earned) + '☆'.repeat(3 - earned)
}

const fmt = new Intl.NumberFormat('en-US')

export function buildShareText({ levelName, score, stars, url }: ShareRun): SharePayload {
  return {
    title: 'ShooterCoaster',
    text: `I scored ${fmt.format(Math.round(score))} ${starString(stars)} on ${levelName} in ShooterCoaster 🎢 — beat me:`,
    url,
  }
}

/** What a finished run shares, or null for an unknown level. */
export function sharePayloadForRun(levelId: string, score: number): SharePayload | null {
  const config = getLevelConfig(levelId)
  if (!config) return null
  return buildShareText({
    levelName: config.name,
    score,
    stars: computeStars(score, config.maxScore, config.starThresholds),
    url: buildShareUrl('results'),
  })
}

/** The one string the clipboard fallback copies. */
export function clipboardText(payload: SharePayload): string {
  return `${payload.text} ${payload.url}`
}

/** The parts of `navigator` sharing uses, so tests can pass a fake. */
export interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

/** How this browser can share, or null when it can't (the button is hidden then). */
export function shareMethod(nav: ShareNavigator | undefined, payload: SharePayload): 'share' | 'clipboard' | null {
  if (!nav) return null
  if (typeof nav.share === 'function' && (typeof nav.canShare !== 'function' || nav.canShare(payload))) return 'share'
  if (typeof nav.clipboard?.writeText === 'function') return 'clipboard'
  return null
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Share sheet if there is one, else the clipboard. Never throws. */
export async function sharePayload(nav: ShareNavigator | undefined, payload: SharePayload): Promise<ShareOutcome> {
  const method = shareMethod(nav, payload)
  try {
    if (method === 'share' && nav?.share) {
      await nav.share(payload)
      return 'shared'
    }
    if (method === 'clipboard' && nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(clipboardText(payload))
      return 'copied'
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
  }
  return 'failed'
}
