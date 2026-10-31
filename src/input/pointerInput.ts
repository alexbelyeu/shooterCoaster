/**
 * Unified pointer input (mouse, touch, pen) for aiming and firing.
 *
 * One set of window-level Pointer Events listeners, shared by the shooting hook
 * and the crosshair, so they always agree on where the aim is and whether the
 * trigger is held. Only Pointer Events are used: browsers synthesize mouse
 * events after touches, so listening to both would double-fire.
 *
 * Rules:
 * - Exactly one pointer drives the aim at a time. While a pointer is held, other
 *   pointers (a second finger, a palm) are ignored until it lifts.
 * - Pressing on interactive UI (buttons, links, inputs, `[data-no-fire]`) never
 *   pulls the trigger, so tapping Pause / Mute does not shoot.
 * - A mouse (or hovering pen) moves the aim without a button held; a finger only
 *   aims while it touches the screen.
 *
 * Coordinates are CSS pixels in the viewport (clientX / clientY).
 */

export type PointerKind = 'mouse' | 'touch' | 'pen'
export type PointerEventType = 'move' | 'down' | 'up'

export interface AimPointerState {
  /** Client X of the aim point, CSS px. */
  x: number
  /** Client Y of the aim point, CSS px. */
  y: number
  /** Device type of the pointer that last moved the aim. */
  kind: PointerKind
  /** True while the active pointer is pressed (trigger held). */
  down: boolean
}

export type PointerListener = (state: Readonly<AimPointerState>, type: PointerEventType) => void

const state: AimPointerState = {
  x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
  y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  kind: 'mouse',
  down: false,
}

/** pointerId of the pointer currently holding the trigger, or null. */
let activeId: number | null = null
const listeners = new Set<PointerListener>()

const UI_SELECTOR = 'button, a, input, select, textarea, label, [role="button"], [data-no-fire]'

/** A control or other UI element (not the game view) is under the pointer. */
export function isUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(UI_SELECTOR) !== null
}

function toKind(t: string): PointerKind {
  return t === 'touch' || t === 'pen' ? t : 'mouse'
}

function emit(type: PointerEventType) {
  for (const l of listeners) l(state, type)
}

function onPointerDown(e: PointerEvent) {
  // Secondary pointers never take over while one is held.
  if (activeId !== null || !e.isPrimary) return
  const kind = toKind(e.pointerType)
  if (isUiTarget(e.target)) {
    // A mouse over a button still aims; it just doesn't fire.
    if (kind !== 'touch') {
      state.x = e.clientX
      state.y = e.clientY
      state.kind = kind
      emit('move')
    }
    return
  }
  activeId = e.pointerId
  state.x = e.clientX
  state.y = e.clientY
  state.kind = kind
  state.down = true
  emit('down')
}

function onPointerMove(e: PointerEvent) {
  if (activeId !== null) {
    if (e.pointerId !== activeId) return
  } else if (e.pointerType === 'touch' || !e.isPrimary) {
    // A finger that isn't the active one (e.g. it started on a button) never aims.
    return
  }
  state.x = e.clientX
  state.y = e.clientY
  state.kind = toKind(e.pointerType)
  emit('move')
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== activeId) return
  release()
}

/** Drop the trigger (pointer lifted / cancelled, the window lost focus or the tab was hidden). */
function release() {
  if (activeId === null && !state.down) return
  activeId = null
  state.down = false
  emit('up')
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') release()
}

function onContextMenu(e: Event) {
  // Long-press on a touchscreen opens a context menu; never during touch play.
  if (state.kind === 'touch' && !isUiTarget(e.target)) e.preventDefault()
}

function install() {
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('contextmenu', onContextMenu)
}

function uninstall() {
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('blur', release)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('contextmenu', onContextMenu)
  activeId = null
  state.down = false
}

/**
 * Subscribe to aim pointer changes. Window listeners are installed while at
 * least one subscriber exists. Returns the unsubscribe function.
 */
export function subscribePointer(listener: PointerListener): () => void {
  if (listeners.size === 0) install()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) uninstall()
  }
}

/** Current aim pointer state (read-only snapshot reference). */
export function getPointerState(): Readonly<AimPointerState> {
  return state
}
