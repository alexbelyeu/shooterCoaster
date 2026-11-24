/**
 * Gamepad input (#819), standard mapping only. While a pad is connected, one requestAnimationFrame poll a frame
 * reads it and feeds what the mouse and keyboard already drive, so combat, the crosshair, the HUD and the screens
 * need nothing of their own:
 * - right stick: a velocity cursor through `pointerInput`'s aim (`gamepadAim`), fire (RT): its trigger (`gamepadTrigger`);
 * - pause (Start): pause / resume through the store actions the Escape key uses;
 * - confirm (A): clicks the focused control (or sends Enter, the screens' "start" key), back (B): sends Escape, the screens' Back;
 * - fire, pause, confirm and back are the player's to rebind (`bindings.ts`, #998); while Settings waits for a
 *   button (`capturePadButton`) the next press goes to it and does nothing else;
 * - photo mode (#828): the right stick orbits the camera and LT / RT zoom out / in (`track/photoInput.ts`) instead;
 * - d-pad / left stick: sends the arrow keys to the focused control (the pause menu's and level grid's own
 *   handlers), and where nothing handles them, moves focus to the next / previous control as Tab does.
 * The rules are pure in `gamepadMap.hot.ts`. No pad, no poll: the loop starts on `gamepadconnected`.
 */

import { useEffect } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { gamepadAim, gamepadTrigger, getPointerState } from './pointerInput'
import { photoPad } from '@/track/photoInput'
import { BINDABLE_PAD_BUTTONS, bindings } from './bindings'
import {
  PAD,
  TRIGGER_THRESHOLD,
  moveCursor,
  navActive,
  navDirection,
  navTarget,
  padAction,
  stickVelocity,
  type NavKey,
  type PadCommand,
  type Vec2,
} from './gamepadMap.hot'

const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]'
/** Commands read as presses (edge-triggered) on their bound buttons; fire is read as a held value. */
const COMMANDS: readonly PadCommand[] = ['confirm', 'back', 'pause']

const vel: Vec2 = { x: 0, y: 0 }
const cursor: Vec2 = { x: 0, y: 0 }
/** The menu direction held last frame: a direction moves once per press, no auto-repeat. */
let navHeld: NavKey | null = null
/** Which bindable buttons were down last frame, so a rebind takes effect on the next press, not a held one. */
const wasDown: boolean[] = new Array<boolean>(BINDABLE_PAD_BUTTONS).fill(false)
/** Settings' "press a button" prompt: the next press is handed to it instead of doing anything. */
let capture: ((button: number) => void) | null = null
let raf = 0
let lastT = 0

function pressed(pad: Gamepad, i: number): boolean {
  return pad.buttons[i]?.pressed ?? false
}

/** The first connected standard-mapping pad, or null. */
function activePad(): Gamepad | null {
  const pads = navigator.getGamepads()
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i]
    if (pad?.connected && pad.mapping === 'standard') return pad
  }
  return null
}

function topDialog(): Element | null {
  const dialogs = document.querySelectorAll('[aria-modal="true"]')
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null
}

/** Send a key the way the keyboard does: to the focused element, bubbling to the window's listeners. */
function sendKey(key: string): boolean {
  const target = document.activeElement ?? document.body
  return target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

/** Click the focused control (a synthetic Enter doesn't activate a button); with nothing focused, Enter. */
function confirm() {
  const el = document.activeElement
  if (el instanceof HTMLElement && el !== document.body) el.click()
  else sendKey('Enter')
}

/**
 * Arrow key first; unhandled (not default-prevented), focus moves through the open dialog's (or page's) controls.
 * On the title with nothing focused the arrow would start a run, so focus moves without it (`navTarget`).
 */
function moveFocus(key: NavKey) {
  const el = document.activeElement
  const focused = el instanceof HTMLElement && el !== document.body
  if (navTarget(useGameStore.getState().phase, focused) === 'key' && !sendKey(key)) return
  const scope = topDialog() ?? document
  const controls = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
  if (controls.length === 0) return
  const i = document.activeElement instanceof HTMLElement ? controls.indexOf(document.activeElement) : -1
  const step = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1
  const next = i < 0 ? (step > 0 ? 0 : controls.length - 1) : (i + step + controls.length) % controls.length
  controls[next].focus()
}

function act(command: PadCommand) {
  const store = useGameStore.getState()
  switch (padAction(command, store.phase, topDialog() !== null)) {
    case 'pause':
      store.setPhase('paused')
      return
    case 'resume':
      store.resume()
      return
    case 'confirm':
      confirm()
      return
    case 'back':
      sendKey('Escape')
  }
}

function poll(t: number) {
  raf = requestAnimationFrame(poll)
  const dt = lastT === 0 ? 0 : (t - lastT) / 1000
  lastT = t
  const pad = activePad()
  if (!pad) return
  const binds = bindings().pad

  if (capture) {
    for (let i = 0; i < BINDABLE_PAD_BUTTONS; i++) {
      const down = pressed(pad, i)
      if (down && !wasDown[i] && capture) {
        capture(i)
        capture = null
      }
      wasDown[i] = down
    }
    gamepadTrigger(false)
    return
  }

  stickVelocity(pad.axes[2] ?? 0, pad.axes[3] ?? 0, vel)
  if (useGameStore.getState().photo) {
    photoPad(vel.x, vel.y, (pad.buttons[PAD.LT]?.value ?? 0) - (pad.buttons[PAD.RT]?.value ?? 0))
  } else if (vel.x !== 0 || vel.y !== 0) {
    // From wherever the aim is now, so the mouse and the stick hand over without a jump.
    const aim = getPointerState()
    cursor.x = aim.x
    cursor.y = aim.y
    moveCursor(cursor, vel, dt, window.innerWidth, window.innerHeight)
    gamepadAim(cursor.x, cursor.y)
  }
  gamepadTrigger(!useGameStore.getState().photo && (pad.buttons[binds.fire]?.value ?? 0) >= TRIGGER_THRESHOLD)

  for (let i = 0; i < COMMANDS.length; i++) {
    const button = binds[COMMANDS[i]]
    if (pressed(pad, button) && !wasDown[button]) act(COMMANDS[i])
  }
  for (let i = 0; i < BINDABLE_PAD_BUTTONS; i++) wasDown[i] = pressed(pad, i)

  const dir = navActive(useGameStore.getState().phase)
    ? navDirection(pressed(pad, PAD.UP), pressed(pad, PAD.DOWN), pressed(pad, PAD.LEFT), pressed(pad, PAD.RIGHT), pad.axes[0] ?? 0, pad.axes[1] ?? 0)
    : null
  if (dir && dir !== navHeld) moveFocus(dir)
  navHeld = dir
}

function start() {
  if (raf !== 0 || !activePad()) return
  lastT = 0
  // Buttons already held when the pad appears (the press that woke it) don't count as presses.
  wasDown.fill(true)
  navHeld = null
  raf = requestAnimationFrame(poll)
}

function stop() {
  if (raf === 0) return
  cancelAnimationFrame(raf)
  raf = 0
  gamepadTrigger(false)
}

function onDisconnected() {
  if (!activePad()) stop()
}

/** Whether a standard-mapping pad is connected (Settings shows the Controls list on a phone only then). */
export function padConnected(): boolean {
  return typeof navigator.getGamepads === 'function' && activePad() !== null
}

/**
 * Hand the pad's next button press to `onButton` instead of acting on it (Settings' rebind prompt); null cancels.
 * Only one prompt waits at a time: a new one replaces the last.
 */
export function capturePadButton(onButton: ((button: number) => void) | null) {
  capture = onButton
}

/** Polls the gamepad while one is connected; mounted once by the App. */
export function useGamepad() {
  useEffect(() => {
    if (typeof navigator.getGamepads !== 'function') return
    window.addEventListener('gamepadconnected', start)
    window.addEventListener('gamepaddisconnected', onDisconnected)
    start()
    return () => {
      window.removeEventListener('gamepadconnected', start)
      window.removeEventListener('gamepaddisconnected', onDisconnected)
      stop()
    }
  }, [])
}
