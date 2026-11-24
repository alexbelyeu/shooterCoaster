import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  DEFAULT_BINDINGS,
  bindKey,
  bindPadButton,
  bindings,
  isDefault,
  keyLabel,
  padLabel,
  setBindings,
  subscribeBindings,
  type KeyAction,
  type PadBindAction,
} from '@/input/bindings'
import { capturePadButton } from '@/input/gamepadInput'

const LABELS: Record<KeyAction | PadBindAction, string> = {
  fire: 'Fire',
  pause: 'Pause',
  mute: 'Mute',
  replay: 'Ride again',
  worlds: 'Worlds (title)',
  confirm: 'Confirm',
  back: 'Back',
}

/** A row's keyboard and pad cells: an action to rebind, or the fixed key / button that does it. */
interface ControlRow {
  label: string
  key: KeyAction | { fixed: string }
  pad: PadBindAction | { fixed: string }
}

const NONE = { fixed: '' }

const ROWS: readonly ControlRow[] = [
  { label: LABELS.fire, key: { fixed: 'Click' }, pad: 'fire' },
  { label: LABELS.pause, key: 'pause', pad: 'pause' },
  { label: LABELS.confirm, key: { fixed: 'Enter' }, pad: 'confirm' },
  { label: LABELS.back, key: { fixed: 'Esc' }, pad: 'back' },
  { label: LABELS.mute, key: 'mute', pad: NONE },
  { label: LABELS.replay, key: 'replay', pad: NONE },
  { label: LABELS.worlds, key: 'worlds', pad: NONE },
]

type Waiting = { kind: 'key'; action: KeyAction } | { kind: 'pad'; action: PadBindAction } | null

const IDLE_NOTE = 'Pick a plate, then press the new key or button. Esc backs out.'

/** Settings' Controls (#998): each action's key and pad button, rebound by pressing the new one, and a Reset. */
export default function ControlsSettings() {
  const b = useSyncExternalStore(subscribeBindings, bindings)
  const [waiting, setWaiting] = useState<Waiting>(null)
  const [note, setNote] = useState(IDLE_NOTE)

  function done(next = bindings()) {
    setBindings(next)
    setWaiting(null)
    setNote(IDLE_NOTE)
  }

  // While a plate waits, every key goes to it first (capture phase on window: no screen, Settings' own Esc or the
  // mute key sees it). Esc backs out; a key the menus keep, or a swap that would hand Esc to another action, is refused.
  useEffect(() => {
    if (!waiting) return
    const onKey = (e: KeyboardEvent) => {
      // Shift, Control… on their own: wait for the key they modify.
      if (e.getModifierState(e.key)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.repeat) return
      if (e.key === 'Escape') return done()
      if (waiting.kind === 'pad') return
      const now = bindings()
      const next = bindKey(now, waiting.action, e.key)
      if (next === now) setNote(`${e.key.length === 1 ? keyLabel(e.key) : e.key} can't be ${LABELS[waiting.action]}. Try another key.`)
      else done(next)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [waiting])

  useEffect(() => {
    if (waiting?.kind !== 'pad') return
    capturePadButton((button) => done(bindPadButton(bindings(), waiting.action, button)))
    return () => capturePadButton(null)
  }, [waiting])

  function wait(next: NonNullable<Waiting>) {
    if (waiting?.kind === next.kind && waiting.action === next.action) return done()
    setWaiting(next)
    setNote(`Press a ${next.kind === 'key' ? 'key' : 'pad button'} for ${LABELS[next.action]}. Esc keeps it.`)
  }

  function cell(row: ControlRow, kind: 'key' | 'pad') {
    const target = row[kind]
    if (typeof target === 'object') return <span className="settings-bind-fixed">{target.fixed}</span>
    const isWaiting = waiting?.kind === kind && waiting.action === target
    const current = kind === 'key' ? keyLabel(b.keys[target as KeyAction]) : padLabel(b.pad[target as PadBindAction])
    return (
      <button
        type="button"
        className="fair-plate settings-bind"
        aria-pressed={isWaiting}
        aria-label={`${row.label} ${kind === 'key' ? 'key' : 'pad button'}: ${current}`}
        onClick={() => wait({ kind, action: target } as NonNullable<Waiting>)}
      >
        {isWaiting ? 'Press…' : current}
      </button>
    )
  }

  return (
    <section className="settings-group settings-group--controls">
      <h3>Controls</h3>
      <div className="settings-binds" role="group" aria-label="Key and pad bindings">
        <span aria-hidden="true" />
        <span className="settings-bind-head">Key</span>
        <span className="settings-bind-head">Pad</span>
        {ROWS.map((row) => (
          <div key={row.label} className="settings-bind-row">
            <span>{row.label}</span>
            {cell(row, 'key')}
            {cell(row, 'pad')}
          </div>
        ))}
      </div>
      <div className="settings-binds-foot">
        <small className="settings-note" role="status">
          {note}
        </small>
        <button type="button" className="fair-plate settings-bind-reset" disabled={isDefault(b)} onClick={() => done(DEFAULT_BINDINGS)}>
          Reset
        </button>
      </div>
    </section>
  )
}
