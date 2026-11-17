import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * zustand's `persist` writes the whole persisted slice on every `set`, changed or not: the game store's every
 * shot, kill and timer second was a `JSON.stringify` of every board plus a synchronous `localStorage.setItem`
 * on the main thread mid-ride (#596). This skips a write whose fields are all the same references as the last
 * one's (the store's actions replace what they change, never mutate it). Pure: no storage of its own.
 */
export function changedOnly<S>(storage: PersistStorage<S> | undefined): PersistStorage<S> | undefined {
  if (!storage) return storage
  let last: StorageValue<S> | null = null
  const same = (value: StorageValue<S>) => {
    if (!last || last.version !== value.version) return false
    const before = last.state as Record<string, unknown>
    const now = value.state as Record<string, unknown>
    const keys = Object.keys(now)
    return keys.length === Object.keys(before).length && keys.every((k) => before[k] === now[k])
  }
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => {
      if (same(value)) return
      last = value
      return storage.setItem(name, value)
    },
    removeItem: (name) => {
      last = null
      return storage.removeItem(name)
    },
  }
}
