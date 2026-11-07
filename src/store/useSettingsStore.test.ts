import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from './useSettingsStore'

// A bare `window` with an in-memory localStorage, as useGameStore.test.ts does: zustand's persist reads it when the
// store is created (vi.hoisted runs before the import).
const memoryStorage = vi.hoisted(() => {
  const data = new Map<string, string>()
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
  ;(globalThis as { window?: unknown }).window = { localStorage: storage, location: { search: '' } }
  return storage
})

const STORAGE_KEY = useSettingsStore.persist.getOptions().name!
const initial = useSettingsStore.getState()
const settings = () => useSettingsStore.getState()

beforeEach(() => {
  memoryStorage.clear()
  useSettingsStore.setState(initial, true)
})

describe('settings persistence (the smoke settings step reloads the page for the same)', () => {
  it('a quality and a music volume survive a reload', async () => {
    settings().setQuality('low')
    settings().setMusicVolume(0.25)
    const saved = memoryStorage.getItem(STORAGE_KEY)!
    // A reload: the store starts from its defaults (resetting writes them, so put the save back), then rehydrates.
    useSettingsStore.setState(initial, true)
    memoryStorage.setItem(STORAGE_KEY, saved)
    expect(settings().quality).toBe('auto')
    await useSettingsStore.persist.rehydrate()
    expect(settings().quality).toBe('low')
    expect(settings().musicVolume).toBe(0.25)
  })

  it('a fresh browser gets the defaults', async () => {
    await useSettingsStore.persist.rehydrate()
    expect(settings().quality).toBe('auto')
    expect(settings().musicVolume).toBe(initial.musicVolume)
  })
})
