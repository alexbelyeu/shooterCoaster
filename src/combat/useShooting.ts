import { useEffect, useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getBulletPool } from './projectiles/bulletPoolHandle'
import { useGameStore } from '@/store/useGameStore'
import { playFireSound } from '@/audio/SFXManager'

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _direction = new THREE.Vector3()
const _origin = new THREE.Vector3()

/**
 * Fire one bullet from the camera through a point in normalized device
 * coordinates (-1..1, y up). Shared by mouse input and the e2e autofire hook.
 * Returns true if a bullet actually left the pool (false when not playing,
 * throttled by the fire delay, or the pool is missing/exhausted).
 */
export function fireAtNDC(x: number, y: number, camera: THREE.Camera): boolean {
  if (useGameStore.getState().phase !== 'playing') return false

  const pool = getBulletPool()
  if (!pool) return false

  _ndc.set(x, y)
  _raycaster.setFromCamera(_ndc, camera)
  _direction.copy(_raycaster.ray.direction)
  _origin.copy(camera.position)

  if (!pool.fire(_origin, _direction)) return false
  useGameStore.getState().registerShot()
  playFireSound()
  return true
}

/**
 * Hook that handles mouse click → fire bullet.
 * Reads camera from R3F, converts mouse to world ray, fires from bullet pool.
 */
export function useShooting() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const mouseRef = useRef({ x: 0, y: 0 })
  const isDown = useRef(false)

  // Track mouse position
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / size.width) * 2 - 1
      mouseRef.current.y = -(e.clientY / size.height) * 2 + 1
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [size])

  const fireShot = useCallback(() => {
    fireAtNDC(mouseRef.current.x, mouseRef.current.y, camera)
  }, [camera])

  useEffect(() => {
    const onDown = () => {
      isDown.current = true
      fireShot()
    }
    const onUp = () => {
      isDown.current = false
    }

    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
    }
  }, [fireShot])

  // Auto-fire while held
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDown.current) fireShot()
    }, 60)
    return () => clearInterval(interval)
  }, [fireShot])
}
