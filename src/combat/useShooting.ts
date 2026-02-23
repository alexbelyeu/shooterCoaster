import { useEffect, useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getBulletPool } from './projectiles/BulletPool'
import { useGameStore } from '@/store/useGameStore'
import { playFireSound } from '@/audio/SFXManager'

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _direction = new THREE.Vector3()
const _origin = new THREE.Vector3()

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
    const phase = useGameStore.getState().phase
    if (phase !== 'playing') return

    const pool = getBulletPool()
    if (!pool) return

    _ndc.set(mouseRef.current.x, mouseRef.current.y)
    _raycaster.setFromCamera(_ndc, camera)
    _direction.copy(_raycaster.ray.direction)

    _origin.copy(camera.position)
    pool.fire(_origin, _direction)
    playFireSound()
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
    }, 100)
    return () => clearInterval(interval)
  }, [fireShot])
}
