import { useEffect, useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getBulletPool } from './projectiles/bulletPoolHandle'
import { useGameStore } from '@/store/useGameStore'
import { playFireSound } from '@/audio/SFXManager'
import { eventBus } from '@/core/EventBus'
import { getPointerState, subscribePointer } from '@/input/pointerInput'
import { findAssistTargetNDC } from './AimSystem'
import { assistRadiusPx, hitScaleFor } from './aimAssist'

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _direction = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _assistNDC = new THREE.Vector2()

/**
 * Fire one bullet from the camera through a point in normalized device
 * coordinates (-1..1, y up). Shared by pointer input and the e2e autofire hook.
 * Returns true if a bullet actually left the pool (false when not playing,
 * throttled by the fire delay, or the pool is missing/exhausted).
 * `hitScale` widens the bullet's hit radius on targets (touch shots).
 */
export function fireAtNDC(x: number, y: number, camera: THREE.Camera, hitScale = 1): boolean {
  if (useGameStore.getState().phase !== 'playing') return false

  const pool = getBulletPool()
  if (!pool) return false

  _ndc.set(x, y)
  _raycaster.setFromCamera(_ndc, camera)
  _direction.copy(_raycaster.ray.direction)
  _origin.copy(camera.position)

  if (!pool.fire(_origin, _direction, hitScale)) return false
  useGameStore.getState().registerShot()
  playFireSound()
  // Muzzle flash, camera kick, etc. listen for this (no payload, no allocation).
  eventBus.emit('weapon:fire')
  return true
}

/**
 * Hook that turns pointer input (mouse, touch, pen) into bullets.
 * Press fires one shot at the pointer; holding auto-fires every 60 ms while the
 * aim follows the pointer (on touch, the finger is the aim point). See
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

  const fireShot = useCallback(() => {
    const p = getPointerState()
    const radius = assistRadiusPx(p.kind)
    const scale = hitScaleFor(p.kind)
    if (radius > 0 && findAssistTargetNDC(p.x, p.y, camera, sizeRef.current, radius, _assistNDC)) {
      fireAtNDC(_assistNDC.x, _assistNDC.y, camera, scale)
    } else {
      fireAtNDC(aimNDC.current.x, aimNDC.current.y, camera, scale)
    }
  }, [camera])

  useEffect(() => {
    // Start from wherever the pointer already is (e.g. resting mouse).
    const p = getPointerState()
    toNDC(p.x, p.y, sizeRef.current, aimNDC.current)
    return subscribePointer((p, type) => {
      toNDC(p.x, p.y, sizeRef.current, aimNDC.current)
      if (type === 'down') {
        isDown.current = true
        fireShot()
      } else if (type === 'up') {
        isDown.current = false
      }
    })
  }, [fireShot])

  // Auto-fire while held
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDown.current) fireShot()
    }, 60)
    return () => clearInterval(interval)
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
