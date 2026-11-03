import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'

/** Share copy for the results screen (#87, #271); the `/go/share` path attributes visits, since UTM dimensions are paywalled. */
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

/** Networks the desktop share menu links to, in menu order. Plain share-intent links: no SDK, no script, no runtime request. */
export const SHARE_TARGETS = [
  { id: 'x', label: 'X' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'threads', label: 'Threads' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'email', label: 'Email' },
] as const

export type ShareTargetId = (typeof SHARE_TARGETS)[number]['id']
/** How a share went out: the phone's share sheet, Copy link, or a network link. The analytics `share` event's `method`. */
export type ShareMethod = 'native' | 'copy' | ShareTargetId

export function buildShareUrl(campaign: string): string {
  const query = new URLSearchParams({ utm_source: 'share', utm_medium: 'organic', utm_campaign: campaign })
  return `${SITE_URL}${SHARE_PATH}?${query}`
}

/** One campaign per way out, so the Marketer can tell which network brings players. */
export function shareCampaign(method: ShareMethod): string {
  return `share_${method}`
}

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

export function sharePayloadForRun(levelId: string, score: number, method: ShareMethod): SharePayload | null {
  const config = getLevelConfig(levelId)
  if (!config) return null
  return buildShareText({
    levelName: config.name,
    score,
    stars: computeStars(score, config.maxScore, config.starThresholds),
    url: buildShareUrl(shareCampaign(method)),
  })
}

export function clipboardText(payload: SharePayload): string {
  return `${payload.text} ${payload.url}`
}

/** The line without its trailing colon, for places the link doesn't follow it (a Reddit title, an email subject). */
function headline(payload: SharePayload): string {
  return payload.text.replace(/:$/, '')
}

function query(params: Record<string, string>): string {
  // encodeURIComponent, not URLSearchParams: mailto: needs %20 for spaces, and every intent accepts it.
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
}

export function shareTargetHref(id: ShareTargetId, payload: SharePayload): string {
  const { text, url } = payload
  switch (id) {
    case 'x':
      return `https://x.com/intent/post?${query({ text, url })}`
    case 'reddit':
      return `https://www.reddit.com/submit?${query({ url, title: headline(payload) })}`
    case 'bluesky':
      return `https://bsky.app/intent/compose?${query({ text: clipboardText(payload) })}`
    case 'threads':
      return `https://www.threads.net/intent/post?${query({ text, url })}`
    case 'whatsapp':
      return `https://wa.me/?${query({ text: clipboardText(payload) })}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?${query({ u: url })}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?${query({ url })}`
    case 'email':
      return `mailto:?${query({ subject: headline(payload), body: `${text}\n\n${url}` })}`
  }
}

export const X_MAX_LENGTH = 280
const X_URL_LENGTH = 23

/** X's weighted length of a post of `text` plus a link: links count 23, code points outside X's light ranges count 2 (twitter-text v3). */
export function xPostLength(text: string): number {
  let n = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    const light = c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)
    n += light ? 1 : 2
  }
  return n + 1 + X_URL_LENGTH
}

export interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

function canNativeShare(nav: ShareNavigator | undefined, payload: SharePayload): boolean {
  return typeof nav?.share === 'function' && (typeof nav.canShare !== 'function' || nav.canShare(payload))
}

export function canCopy(nav: ShareNavigator | undefined): boolean {
  return typeof nav?.clipboard?.writeText === 'function'
}

/** The share sheet only on touch devices: on desktop it offers little (macOS: Notes), so our menu instead. */
export function shareMode(nav: ShareNavigator | undefined, coarsePointer: boolean, payload: SharePayload): 'native' | 'menu' {
  return coarsePointer && canNativeShare(nav, payload) ? 'native' : 'menu'
}

/** `failed` means the menu should open instead; a dismissed sheet is `cancelled`. Never throws. */
export async function nativeShare(nav: ShareNavigator | undefined, payload: SharePayload): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    if (!nav?.share) return 'failed'
    await nav.share(payload)
    return 'shared'
  } catch (e) {
    return e instanceof Error && e.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

/** Text + link to the clipboard. Never throws. */
export async function copyShare(nav: ShareNavigator | undefined, payload: SharePayload): Promise<boolean> {
  try {
    if (!nav?.clipboard?.writeText) return false
    await nav.clipboard.writeText(clipboardText(payload))
    return true
  } catch {
    return false
  }
}
