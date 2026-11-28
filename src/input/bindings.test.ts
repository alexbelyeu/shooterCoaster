import { describe, expect, it } from 'vitest'
import {
  BINDABLE_PAD_BUTTONS,
  BINDINGS_STORAGE_KEY,
  DEFAULT_BINDINGS,
  KEY_ACTIONS,
  PAD_ACTIONS,
  keyLabel,
  loadBindings,
  matchesKey,
  type Bindings,
} from './bindings'
import { bindKey, bindPadButton, padLabel, saveBindings } from './bindingsEdit'
import { PAD } from './gamepadMap.hot'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(BINDINGS_STORAGE_KEY, initial)
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

const throwing = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

function allBound(b: Bindings) {
  expect(new Set(KEY_ACTIONS.map((a) => b.keys[a])).size).toBe(KEY_ACTIONS.length)
  expect(new Set(PAD_ACTIONS.map((a) => b.pad[a])).size).toBe(PAD_ACTIONS.length)
}

describe('defaults', () => {
  it('are the keys and buttons the game used before bindings', () => {
    expect(DEFAULT_BINDINGS.keys).toEqual({ pause: 'Escape', mute: 's', replay: 'r', worlds: 'w' })
    expect(DEFAULT_BINDINGS.pad).toEqual({ fire: PAD.RT, pause: PAD.START, confirm: PAD.A, back: PAD.B })
    allBound(DEFAULT_BINDINGS)
  })

  it('match either case of a letter', () => {
    expect(matchesKey(DEFAULT_BINDINGS, 'mute', 's')).toBe(true)
    expect(matchesKey(DEFAULT_BINDINGS, 'mute', 'S')).toBe(true)
    expect(matchesKey(DEFAULT_BINDINGS, 'pause', 'Escape')).toBe(true)
    expect(matchesKey(DEFAULT_BINDINGS, 'pause', 'p')).toBe(false)
  })

  it('label keys and buttons', () => {
    expect(keyLabel('Escape')).toBe('Esc')
    expect(keyLabel('s')).toBe('S')
    expect(padLabel(PAD.START)).toBe('Start')
    expect(padLabel(PAD.RT)).toBe('RT')
    expect(Array.from({ length: BINDABLE_PAD_BUTTONS }, (_, i) => padLabel(i)).every(Boolean)).toBe(true)
  })
})

describe('bindKey', () => {
  it('rebinds an action and frees its old key', () => {
    const b = bindKey(DEFAULT_BINDINGS, 'pause', 'P')
    expect(b.keys.pause).toBe('p')
    expect(matchesKey(b, 'pause', 'Escape')).toBe(false)
  })

  it('swaps with the action that held the key, never leaving one unbound', () => {
    const b = bindKey(DEFAULT_BINDINGS, 'mute', 'r')
    expect(b.keys).toMatchObject({ mute: 'r', replay: 's' })
    allBound(b)
  })

  it('refuses a swap that would hand Escape to another action', () => {
    expect(bindKey(DEFAULT_BINDINGS, 'pause', 's')).toBe(DEFAULT_BINDINGS)
  })

  it('refuses the menus’ and the way out’s keys', () => {
    for (const key of ['Escape', 'Enter', 'Tab', ' ', 'ArrowUp', 'Shift', 'F5', '`']) {
      expect(bindKey(DEFAULT_BINDINGS, 'mute', key)).toBe(DEFAULT_BINDINGS)
    }
  })

  it('keeps every action bound through any sequence of rebinds', () => {
    const keys = ['a', 's', 'r', 'w', 'p', 'Delete', 'Escape', 'Enter']
    let b = DEFAULT_BINDINGS
    for (let i = 0; i < 200; i++) b = bindKey(b, KEY_ACTIONS[(i * 7) % KEY_ACTIONS.length], keys[(i * 5) % keys.length])
    allBound(b)
  })
})

describe('bindPadButton', () => {
  it('rebinds Start to Y and swaps a held button', () => {
    const b = bindPadButton(DEFAULT_BINDINGS, 'pause', 3)
    expect(b.pad.pause).toBe(3)
    const swapped = bindPadButton(b, 'fire', PAD.A)
    expect(swapped.pad).toMatchObject({ fire: PAD.A, confirm: PAD.RT })
    allBound(swapped)
  })

  it('refuses the d-pad, Home and non-buttons', () => {
    for (const button of [PAD.UP, PAD.DOWN, 16, -1, 1.5, NaN]) {
      expect(bindPadButton(DEFAULT_BINDINGS, 'fire', button)).toBe(DEFAULT_BINDINGS)
    }
  })
})

describe('bindPadButton: the back button', () => {
  it('keeps the binding when the bound back button answers the prompt', () => {
    expect(bindPadButton(DEFAULT_BINDINGS, 'fire', PAD.B)).toBe(DEFAULT_BINDINGS)
    const moved = bindPadButton(DEFAULT_BINDINGS, 'back', 3)
    expect(moved.pad.back).toBe(3)
    expect(bindPadButton(moved, 'pause', 3)).toBe(moved)
    expect(bindPadButton(moved, 'pause', PAD.B).pad.pause).toBe(PAD.B)
  })
})

describe('load / save', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    const b = bindPadButton(bindKey(DEFAULT_BINDINGS, 'pause', 'p'), 'pause', 3)
    expect(saveBindings(b, storage)).toBe(true)
    expect(loadBindings(storage)).toEqual(b)
  })

  it('saving the defaults clears the entry', () => {
    const storage = memoryStorage('{}')
    saveBindings(DEFAULT_BINDINGS, storage)
    expect(storage.map.has(BINDINGS_STORAGE_KEY)).toBe(false)
  })

  it('falls back to the defaults on missing, corrupt or invalid storage', () => {
    const bad = [
      undefined,
      'not json',
      'null',
      '{"keys":{}}',
      JSON.stringify({ keys: { ...DEFAULT_BINDINGS.keys, mute: 'r' }, pad: DEFAULT_BINDINGS.pad }),
      JSON.stringify({ keys: { ...DEFAULT_BINDINGS.keys, mute: 'Enter' }, pad: DEFAULT_BINDINGS.pad }),
      JSON.stringify({ keys: DEFAULT_BINDINGS.keys, pad: { ...DEFAULT_BINDINGS.pad, fire: 13 } }),
      JSON.stringify({ keys: DEFAULT_BINDINGS.keys, pad: { ...DEFAULT_BINDINGS.pad, fire: '7' } }),
    ]
    for (const json of bad) expect(loadBindings(memoryStorage(json))).toBe(DEFAULT_BINDINGS)
    expect(loadBindings(null)).toBe(DEFAULT_BINDINGS)
    expect(loadBindings(throwing)).toBe(DEFAULT_BINDINGS)
    expect(saveBindings(DEFAULT_BINDINGS, throwing)).toBe(false)
  })
})
