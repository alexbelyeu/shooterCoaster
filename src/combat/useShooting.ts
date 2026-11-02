import { useEffect, useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getBulletPool } from './projectiles/bulletPoolHandle'
import { useGameStore } from '@/store/useGameStore'
import { sfx } from '@/audio/sfx'
import { eventBus } from '@/core/EventBus'
import { getPointerState, subscribePointer } from '@/input/pointerInput'
import { recordShot } from './hitFeedback'
import { findAssistTargetNDC } from './AimSystem'
import { assistRadiusPx, hitScaleFor } from './aimAssist'
import { activeWeapon, fanAngles } from './weapons/weaponTypes'
import { gameTime } from '@/core/gameClock'

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _direction = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _assistNDC = new THREE.Vector2()
const _up = new THREE.Vector3()
const _pellet = new THREE.Vector3()
const _fan: number[] = []
/** A timer tick can land a few ms early; a pull that close to the interval still fires. */
const FIRE_INTERVAL_SLACK_MS = 5
let lastFireAt = -Infinity

/**
 * Pull the trigger once from the camera through a point in normalized device
 * coordinates (-1..1, y up): one bullet, or the active pickup's fan.
 * Shared by pointer input and the e2e autofire hook.
 * Returns true if a bullet actually left the pool (false when not playing,
 * inside the weapon's fire interval, or the pool is missing/exhausted).
 * `hitScale` widens the bullet's hit radius on targets (touch shots); `auto`
 * marks held-trigger auto-fire (quieter fire sound).
 */
export function fireAtNDC(x: number, y: number, camera: THREE.Camera, hitScale = 1, auto = false): boolean {
  const store = useGameStore.getState()
  if (store.phase !== 'playing') return false

  const pool = getBulletPool()
  if (!pool) return false

  const weapon = activeWeapon(store.weapon, gameTime())
  const now = performance.now()
  if (now - lastFireAt < weapon.fireIntervalMs - FIRE_INTERVAL_SLACK_MS) return false

  _ndc.set(x, y)
  _raycaster.setFromCamera(_ndc, camera)
  _direction.copy(_raycaster.ray.direction)
  _origin.copy(camera.position)
  _up.setFromMatrixColumn(camera.matrixWorld, 1)

  let fired = 0
  for (const angle of fanAngles(weapon, _fan)) {
    _pellet.copy(_direction).applyAxisAngle(_up, angle)
    if (pool.fire(_origin, _pellet, hitScale, weapon.pierce)) fired++
  }
  if (fired === 0) return false
  lastFireAt = now
  store.registerShot(fired)
  sfx().fire(auto, weapon.id)
  // Weapon view-model (recoil, muzzle flash, tracer) aims at this shot. Touch
  // aim assist passes the assisted NDC in here, so the tracer follows the bullet.
  recordShot(x, y, weapon.id)
  // Listeners read lastShot instead of a payload (no allocation).
  eventBus.emit('weapon:fire')
  return true
}

/**
 * Hook that turns pointer input (mouse, touch, pen) into bullets.
 * Press fires one shot at the pointer; holding auto-fires at the weapon's fire interval while the
 * aim follows the pointer (on touch, the finger is the aim point). A press outside
 * `playing` (e.g. during the countdown) neither fires nor holds the trigger. See
 * `src/input/pointerInput.ts` for the multi-touch / UI-target rules.
 * Touch shots get aim assist: they snap to an enemy within ~44 CSS px of the
 * finger and have a slightly larger hit radius (`aimAssist.ts`).
 */
export function useShooting() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const sizeRef = useRef(size)
  const aimNDC = useRef({ x: 0, y: 0 })
  const isDown = useRef(false)

  useEffect(() => {
    sizeRef.current = size
    const p = getPointerState()
    toNDC(p.x, p.y, size, aimNDC.current)
  }, [size])

  const fireShot = useCallback((auto: boolean) => {
    const p = getPointerState()
    const radius = assistRadiusPx(p.kind)
    const scale = hitScaleFor(p.kind)
    if (radius > 0 && findAssistTargetNDC(p.x, p.y, camera, sizeRef.current, radius, _assistNDC)) {
      fireAtNDC(_assistNDC.x, _assistNDC.y, camera, scale, auto)
    } else {
      fireAtNDC(aimNDC.current.x, aimNDC.current.y, camera, scale, auto)
    }
  }, [camera])

  useEffect(() => {
    // Start from wherever the pointer already is (e.g. resting mouse).
    const p = getPointerState()
    toNDC(p.x, p.y, sizeRef.current, aimNDC.current)
    return subscribePointer((p, type) => {
      toNDC(p.x, p.y, sizeRef.current, aimNDC.current)
      if (type === 'down') {
        // A trigger held through the countdown must not start auto-firing on GO.
        isDown.current = useGameStore.getState().phase === 'playing'
        if (isDown.current) fireShot(false)
      } else if (type === 'up') {
        isDown.current = false
      }
    })
  }, [fireShot])

  // Re-timed every pull, so a pickup changes the cadence.
  useEffect(() => {
    let timer = 0
    const tick = () => {
      if (isDown.current) fireShot(true)
      const { weapon } = useGameStore.getState()
      timer = window.setTimeout(tick, activeWeapon(weapon, gameTime()).fireIntervalMs)
    }
    tick()
    return () => clearTimeout(timer)
  }, [fireShot])
}

function toNDC(
  clientX: number,
  clientY: number,
  size: { left: number; top: number; width: number; height: number },
  out: { x: number; y: number },
) {
  out.x = ((clientX - size.left) / size.width) * 2 - 1
  out.y = -((clientY - size.top) / size.height) * 2 + 1
}
