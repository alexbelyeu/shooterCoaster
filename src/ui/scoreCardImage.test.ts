import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, DOWNLOAD_URL_LIFETIME_MS } from './scoreCardImage'

describe('downloadBlob', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the blob URL alive long enough for an iOS download prompt (#374)', () => {
    vi.useFakeTimers()
    const link = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: () => link })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:card')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    downloadBlob(new Blob(['png']), 'card.png')
    expect(link.click).toHaveBeenCalledOnce()
    expect(link).toMatchObject({ href: 'blob:card', download: 'card.png' })
    expect(DOWNLOAD_URL_LIFETIME_MS).toBeGreaterThanOrEqual(30_000)
    vi.advanceTimersByTime(DOWNLOAD_URL_LIFETIME_MS - 1)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revoke).toHaveBeenCalledWith('blob:card')
  })
})
