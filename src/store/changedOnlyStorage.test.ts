import { describe, expect, it } from 'vitest'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { changedOnly } from './changedOnlyStorage'

type State = { scores: Record<string, number>; initials: string }

function fakeStorage() {
  const writes: StorageValue<State>[] = []
  const storage: PersistStorage<State> = {
    getItem: () => null,
    setItem: (_name, value) => void writes.push(value),
    removeItem: () => {},
  }
  return { storage, writes }
}

describe('changedOnly', () => {
  it('skips a write whose fields are the same references as the last one', () => {
    const { storage, writes } = fakeStorage()
    const s = changedOnly(storage)!
    const scores = { level1: 100 }
    s.setItem('k', { state: { scores, initials: 'AAA' }, version: 0 })
    // A shot: zustand's partialize builds a new object round the same fields.
    s.setItem('k', { state: { scores, initials: 'AAA' }, version: 0 })
    expect(writes).toHaveLength(1)
    s.setItem('k', { state: { scores: { ...scores, level2: 5 }, initials: 'AAA' }, version: 0 })
    s.setItem('k', { state: { scores, initials: 'AAA' }, version: 1 })
    expect(writes).toHaveLength(3)
  })

  it('writes again after a remove', () => {
    const { storage, writes } = fakeStorage()
    const s = changedOnly(storage)!
    const value = { state: { scores: {}, initials: 'AAA' }, version: 0 }
    s.setItem('k', value)
    s.removeItem('k')
    s.setItem('k', { ...value })
    expect(writes).toHaveLength(2)
  })

  it('passes no storage through', () => {
    expect(changedOnly<State>(undefined)).toBeUndefined()
  })
})
