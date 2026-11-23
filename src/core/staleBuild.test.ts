import { afterEach, describe, expect, it } from 'vitest'
import type { GamePhase } from '@/types/game'
import { claimReload, entryScriptSrc, isReloadSafe, lazyChunk, onChunkFailure, RELOAD_GUARD_KEY } from './staleBuild'

const missing = () => new TypeError('Failed to fetch dynamically imported module: https://scoaster.com/assets/engine-abc.js')

describe('lazyChunk', () => {
  afterEach(() => onChunkFailure(null))

  it('shares one load while it is pending and after it arrived', async () => {
    let calls = 0
    const load = lazyChunk(async () => ++calls)
    expect(load()).toBe(load())
    expect(await load()).toBe(1)
    expect(await load()).toBe(1)
    expect(calls).toBe(1)
  })

  it('forgets a failed load: the next call imports again', async () => {
    let calls = 0
    const load = lazyChunk(async () => {
      if (++calls === 1) throw missing()
      return 'engine'
    })
    await expect(load()).rejects.toThrow('dynamically imported module')
    expect(await load()).toBe('engine')
    expect(calls).toBe(2)
  })

  it('reports each failure to the page listener', async () => {
    const seen: unknown[] = []
    onChunkFailure((err) => seen.push(err))
    const load = lazyChunk(() => Promise.reject(missing()))
    await expect(load()).rejects.toThrow()
    await expect(load()).rejects.toThrow()
    expect(seen).toHaveLength(2)
  })
})

describe('the served page', () => {
  it("reads the entry script from a built page, skipping JSON-LD and the dev page's own", () => {
    const built = `<head><script type="application/ld+json">{}</script>
      <script type="module" crossorigin src="/assets/index-B1x9.js"></script></head>`
    expect(entryScriptSrc(built)).toBe('/assets/index-B1x9.js')
    expect(entryScriptSrc(`<script src='./assets/x.js' type='module'></script>`)).toBe('./assets/x.js')
    expect(entryScriptSrc('<p>404</p><script>inline()</script>')).toBeNull()
  })
})

describe('when to reload', () => {
  it('only between runs, on the title or level select', () => {
    const phases: GamePhase[] = ['title', 'levelSelect', 'loading', 'intro', 'countdown', 'playing', 'paused', 'results']
    expect(phases.filter(isReloadSafe)).toEqual(['title', 'levelSelect'])
  })

  it('once per session', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(claimReload(storage)).toBe(true)
    expect(store.has(RELOAD_GUARD_KEY)).toBe(true)
    expect(claimReload(storage)).toBe(false)
  })

  it('never without a working guard', () => {
    expect(claimReload(null)).toBe(false)
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
    }
    expect(claimReload(throwing)).toBe(false)
    const readOnly = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(claimReload(readOnly)).toBe(false)
  })
})
