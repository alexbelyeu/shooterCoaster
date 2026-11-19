import { describe, expect, it, vi } from 'vitest'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import {
  buildShareText,
  buildShareUrl,
  canCopy,
  canCopyImage,
  canShareImage,
  clipboardText,
  copyImage,
  copyShare,
  exclusive,
  nativeShare,
  rankLabel,
  SHARE_TARGETS,
  shareCampaign,
  shareMode,
  sharePayloadForRun,
  shareTargetHref,
  starString,
  X_MAX_LENGTH,
  xPostLength,
  type ShareNavigator,
} from './share'

const level1 = getLevelConfig('level1')!
const URL_NATIVE = buildShareUrl('share_native')

describe('buildShareUrl', () => {
  it('links the share campaign path with the UTM tags', () => {
    expect(URL_NATIVE).toBe('https://scoaster.com/go/share?utm_source=share&utm_medium=organic&utm_campaign=share_native')
    expect(shareCampaign('reddit')).toBe('share_reddit')
  })
})

describe('buildShareText', () => {
  it('rounds and thousands-separates the score and draws the stars', () => {
    const p = buildShareText({ levelName: 'Theme Park', score: 1239.6, stars: 2, url: URL_NATIVE })
    expect(p.text).toBe('I scored 1,240 ★★☆ on Theme Park in ShooterCoaster 🎢 — beat me:')
    expect(p.url).toBe(URL_NATIVE)
    expect(p.title).toBe('ShooterCoaster')
    expect(clipboardText(p)).toBe(`${p.text} ${URL_NATIVE}`)
  })

  it("leads with the World place when the run is on the online top 10 (#445), and is today's line without one", () => {
    const run = { levelName: 'Theme Park', score: 1239.6, stars: 2, url: URL_NATIVE }
    expect(buildShareText({ ...run, worldRank: 2 }).text).toBe("I'm #3 in the world on Theme Park — 1,240 ★★☆ in ShooterCoaster 🎢 — beat me:")
    expect(buildShareText({ ...run, worldRank: 0 }).text).toMatch(/^I'm #1 in the world on /)
    expect(buildShareText({ ...run, worldRank: 9 }).text).toMatch(/^I'm #10 in the world on /)
    expect(buildShareText({ ...run, worldRank: null })).toEqual(buildShareText(run))
    expect(rankLabel(0)).toBe('#1')
  })

  it('renders 0 to 3 stars as ★ / ☆', () => {
    expect([0, 1, 2, 3].map(starString)).toEqual(['☆☆☆', '★☆☆', '★★☆', '★★★'])
    expect(starString(7)).toBe('★★★')
  })
})

describe('sharePayloadForRun', () => {
  it('takes the level name and stars from the registry, and the campaign from the method', () => {
    const score = Math.ceil(level1.maxScore * level1.starThresholds[2])
    const p = sharePayloadForRun('level1', score, 'native')!
    expect(p.text).toContain(`on ${level1.name} in`)
    expect(p.text).toContain('★★★')
    expect(p.url).toBe(URL_NATIVE)
    expect(sharePayloadForRun('level1', 0, 'x')!.text).toContain('I scored 0 ☆☆☆')
    expect(sharePayloadForRun('level1', 0, 'x')!.url).toBe(buildShareUrl('share_x'))
    expect(sharePayloadForRun('nope', 10, 'copy')).toBeNull()
    expect(sharePayloadForRun('level1', 0, 'x', 4)!.text).toBe(`I'm #5 in the world on ${level1.name} — 0 ☆☆☆ in ShooterCoaster 🎢 — beat me:`)
    expect(sharePayloadForRun('level1', 0, 'x', null)).toEqual(sharePayloadForRun('level1', 0, 'x'))
  })
})

/** The query of an intent link, decoded (mailto: included). */
function params(href: string): Record<string, string> {
  const q = href.slice(href.indexOf('?') + 1)
  return Object.fromEntries(q.split('&').map((kv) => kv.split('=').map(decodeURIComponent) as [string, string]))
}

describe('share targets', () => {
  // `&`, `#` and `?` in the level name and a huge score: the encoding traps and the longest line.
  const tricky = (id: string) =>
    buildShareText({ levelName: 'Fish & Chips #1?', score: 9_999_999, stars: 2, url: buildShareUrl(`share_${id}`) })

  it('builds a well-formed, fully encoded link per network that carries its own campaign', () => {
    expect(SHARE_TARGETS.map((t) => t.id)).toEqual(['x', 'reddit', 'bluesky', 'threads', 'whatsapp', 'facebook', 'linkedin', 'email'])
    for (const { id } of SHARE_TARGETS) {
      const payload = tricky(id)
      const href = shareTargetHref(id, payload)
      expect(href, id).toMatch(id === 'email' ? /^mailto:\?/ : /^https:\/\/[a-z.]+\/[^?]*\?/)
      if (id !== 'email') expect(new URL(href).protocol).toBe('https:')
      // Nothing reserved or non-ASCII survives raw in the query: only key=value pairs joined by `&`.
      const q = href.slice(href.indexOf('?') + 1)
      expect(q, id).toMatch(/^[a-z]+=[A-Za-z0-9%._~!*'()-]*(&[a-z]+=[A-Za-z0-9%._~!*'()-]*)*$/)
      const values = Object.values(params(href)).join(' ')
      expect(values, id).toContain(`utm_campaign=share_${id}`)
      if (id !== 'facebook' && id !== 'linkedin') expect(values, id).toContain('Fish & Chips #1? in ShooterCoaster 🎢')
    }
  })

  it('carries the World rank line in the X, Reddit and Bluesky links of a run that placed', () => {
    const line = "I'm #3 in the world on Theme Park — 1,240 ★★☆ in ShooterCoaster 🎢 — beat me"
    const ranked = (id: string) => buildShareText({ levelName: 'Theme Park', score: 1240, stars: 2, url: buildShareUrl(`share_${id}`), worldRank: 2 })
    expect(params(shareTargetHref('x', ranked('x'))).text).toBe(`${line}:`)
    expect(params(shareTargetHref('reddit', ranked('reddit'))).title).toBe(line)
    expect(params(shareTargetHref('bluesky', ranked('bluesky'))).text).toBe(`${line}: ${buildShareUrl('share_bluesky')}`)
  })

  it('adapts the line to what each network takes', () => {
    const x = tricky('x')
    expect(params(shareTargetHref('x', x))).toEqual({ text: x.text, url: x.url })
    const reddit = tricky('reddit')
    expect(params(shareTargetHref('reddit', reddit))).toEqual({ url: reddit.url, title: reddit.text.replace(/:$/, '') })
    expect(params(shareTargetHref('bluesky', tricky('bluesky')))).toEqual({ text: clipboardText(tricky('bluesky')) })
    expect(params(shareTargetHref('whatsapp', tricky('whatsapp')))).toEqual({ text: clipboardText(tricky('whatsapp')) })
    expect(params(shareTargetHref('facebook', tricky('facebook')))).toEqual({ u: tricky('facebook').url })
    const email = tricky('email')
    const mail = params(shareTargetHref('email', email))
    expect(mail.subject).toBe(email.text.replace(/:$/, ''))
    expect(mail.body).toBe(`${email.text}\n\n${email.url}`)
    // mailto: has no `+` for space.
    expect(shareTargetHref('email', email)).not.toContain('+')
  })

  it("fits X's and Bluesky's length limits for every level", () => {
    expect(xPostLength('a')).toBe(1 + 1 + 23)
    expect(xPostLength('★🎢—')).toBe(2 + 2 + 1 + 1 + 23)
    for (const level of getAllLevels()) {
      for (const rank of [null, 9]) {
        const x = sharePayloadForRun(level.id, 9_999_999, 'x', rank)!
        expect(xPostLength(x.text), level.id).toBeLessThanOrEqual(X_MAX_LENGTH)
        const bluesky = sharePayloadForRun(level.id, 9_999_999, 'bluesky', rank)!
        expect([...clipboardText(bluesky)].length, level.id).toBeLessThanOrEqual(300)
      }
    }
  })
})

describe('sharing', () => {
  const payload = sharePayloadForRun('level1', 1240, 'native')!
  const share = async () => {}
  const writeText = async () => {}

  it('uses the native sheet only on touch devices that have one, else the menu', () => {
    expect(shareMode({ share, clipboard: { writeText } }, false, payload)).toBe('menu')
    expect(shareMode({ share }, true, payload)).toBe('native')
    expect(shareMode({ share, canShare: () => false }, true, payload)).toBe('menu')
    expect(shareMode({ clipboard: { writeText } }, true, payload)).toBe('menu')
    expect(shareMode(undefined, true, payload)).toBe('menu')
    expect(canCopy({ clipboard: { writeText } })).toBe(true)
    expect(canCopy({})).toBe(false)
  })

  it('copies text and link together', async () => {
    let copied = ''
    const nav: ShareNavigator = { clipboard: { writeText: async (t) => void (copied = t) } }
    expect(await copyShare(nav, payload)).toBe(true)
    expect(copied).toBe(clipboardText(payload))
  })

  it('reports a dismissed sheet as cancelled and any other failure as failed (the menu opens then), never throwing', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const rejecting = (e: unknown) => async () => Promise.reject(e)
    expect(await nativeShare({ share }, payload)).toBe('shared')
    expect(await nativeShare({ share: rejecting(abort) }, payload)).toBe('cancelled')
    expect(await nativeShare({ share: rejecting(new Error('denied')) }, payload)).toBe('failed')
    expect(await nativeShare({ share: rejecting('weird') }, payload)).toBe('failed')
    expect(await nativeShare({}, payload)).toBe('failed')
    expect(await copyShare({ clipboard: { writeText: rejecting('no focus') } }, payload)).toBe(false)
    expect(await copyShare({}, payload)).toBe(false)
  })
})

describe('exclusive', () => {
  it('drops a second call while the first is in flight, and frees the flag when it ends, even on a throw', async () => {
    const busy = { current: false }
    let release = () => {}
    let calls = 0
    const slow = () => new Promise<string>((resolve) => {
      calls++
      release = () => resolve('shared')
    })
    const first = exclusive(busy, slow)
    expect(busy.current).toBe(true)
    expect(await exclusive(busy, slow)).toBeNull()
    release()
    expect(await first).toBe('shared')
    expect(calls).toBe(1)
    expect(busy.current).toBe(false)
    await expect(exclusive(busy, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(busy.current).toBe(false)
    expect(await exclusive(busy, async () => 'again')).toBe('again')
  })
})

describe('sharing the score card image', () => {
  const share = async () => {}

  it('offers the image to the share sheet only where canShare takes a PNG', () => {
    let asked: ShareData | undefined
    expect(canShareImage({ share, canShare: (d) => ((asked = d), true) })).toBe(true)
    expect(asked?.files?.[0]).toMatchObject({ name: 'card.png', type: 'image/png' })
    expect(canShareImage({ share, canShare: () => false })).toBe(false)
    expect(canShareImage({ share })).toBe(false)
    expect(canShareImage({ canShare: () => true })).toBe(false)
    const throwing = () => {
      throw new TypeError('files')
    }
    expect(canShareImage({ share, canShare: throwing })).toBe(false)
    expect(canShareImage(undefined)).toBe(false)
  })

  it('offers Copy image only with ClipboardItem and clipboard.write', () => {
    const write = async () => {}
    expect(canCopyImage({ clipboard: { write } }, true)).toBe(true)
    expect(canCopyImage({ clipboard: { write } }, false)).toBe(false)
    expect(canCopyImage({ clipboard: {} }, true)).toBe(false)
  })

  it('writes the PNG as one clipboard item, never throwing', async () => {
    class FakeItem {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal('ClipboardItem', FakeItem)
    try {
      let written: unknown[] = []
      const png = Promise.resolve(new Blob(['x'], { type: 'image/png' }))
      expect(await copyImage({ clipboard: { write: async (items) => void (written = items) } }, png)).toBe(true)
      expect(written).toHaveLength(1)
      expect((written[0] as FakeItem).items['image/png']).toBe(png)
      expect(await copyImage({ clipboard: { write: () => Promise.reject(new Error('denied')) } }, png)).toBe(false)
      expect(await copyImage({}, png)).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('tags each image share with its own campaign', () => {
    expect(sharePayloadForRun('level1', 1240, 'image_native')!.url).toBe(buildShareUrl('share_image_native'))
  })
})
