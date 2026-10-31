import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import {
  buildShareText,
  buildShareUrl,
  clipboardText,
  shareMethod,
  sharePayload,
  sharePayloadForRun,
  starString,
  type ShareNavigator,
} from './share'

const level1 = getLevelConfig('level1')!
const URL = buildShareUrl('results')

describe('buildShareUrl', () => {
  it('links the share campaign path with the UTM tags', () => {
    expect(URL).toBe('https://scoaster.com/go/share?utm_source=share&utm_medium=organic&utm_campaign=results')
  })
})

describe('buildShareText', () => {
  it('rounds and thousands-separates the score and draws the stars', () => {
    const p = buildShareText({ levelName: 'Theme Park', score: 1239.6, stars: 2, url: URL })
    expect(p.text).toBe('I scored 1,240 ★★☆ on Theme Park in ShooterCoaster 🎢 — beat me:')
    expect(p.url).toBe(URL)
    expect(p.title).toBe('ShooterCoaster')
    expect(clipboardText(p)).toBe(`${p.text} ${URL}`)
  })

  it('renders 0 to 3 stars as ★ / ☆', () => {
    expect([0, 1, 2, 3].map(starString)).toEqual(['☆☆☆', '★☆☆', '★★☆', '★★★'])
    expect(starString(7)).toBe('★★★')
  })
})

describe('sharePayloadForRun', () => {
  it('takes the level name and stars from the registry', () => {
    const score = Math.ceil(level1.maxScore * level1.starThresholds[2])
    const p = sharePayloadForRun('level1', score)!
    expect(p.text).toContain(`on ${level1.name} in`)
    expect(p.text).toContain('★★★')
    expect(sharePayloadForRun('level1', 0)!.text).toContain('I scored 0 ☆☆☆')
    expect(sharePayloadForRun('nope', 10)).toBeNull()
  })
})

describe('sharing', () => {
  const payload = sharePayloadForRun('level1', 1240)!

  it('prefers the share sheet, falls back to the clipboard, or offers nothing', () => {
    const share = async () => {}
    const writeText = async () => {}
    expect(shareMethod({ share, canShare: () => true, clipboard: { writeText } }, payload)).toBe('share')
    expect(shareMethod({ share, canShare: () => false, clipboard: { writeText } }, payload)).toBe('clipboard')
    expect(shareMethod({ clipboard: { writeText } }, payload)).toBe('clipboard')
    expect(shareMethod({}, payload)).toBeNull()
    expect(shareMethod(undefined, payload)).toBeNull()
  })

  it('copies text and link together', async () => {
    let copied = ''
    const nav: ShareNavigator = { clipboard: { writeText: async (t) => void (copied = t) } }
    expect(await sharePayload(nav, payload)).toBe('copied')
    expect(copied).toBe(clipboardText(payload))
  })

  it('treats a dismissed share sheet as cancelled and never throws', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const rejecting = (e: unknown) => async () => Promise.reject(e)
    expect(await sharePayload({ share: rejecting(abort) }, payload)).toBe('cancelled')
    expect(await sharePayload({ share: rejecting(new Error('denied')) }, payload)).toBe('failed')
    expect(await sharePayload({ clipboard: { writeText: rejecting('no focus') } }, payload)).toBe('failed')
    expect(await sharePayload({}, payload)).toBe('failed')
  })
})
