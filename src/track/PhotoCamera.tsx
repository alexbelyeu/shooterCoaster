import { useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { setCameraOffSeat } from '@/core/introShot'
import { useGameStore } from '@/store/useGameStore'
import type { PlacementBounds } from '@/entities/spawning/spawnPlacement'
import {
  PHOTO_STICK_RAD_PER_S, PHOTO_ZOOM_PER_S, orbitPosition, photoLimits, startOrbit, stepOrbit,
} from './photoCamera'
import { resetPhotoInput, takePhotoCapture, takePhotoInput, type PhotoInput } from './photoInput'

const WORLD_UP = new THREE.Vector3(0, 1, 0)
/** A frame longer than this (a hitch) turns the pad's orbit only this far. */
const MAX_STEP_S = 0.05

interface PhotoCameraProps {
  /** Terrain as drawn: the camera stays over it. */
  groundFn: (x: number, z: number) => number
  /** An interior's walls: the camera stays inside them. */
  bounds?: PlacementBounds
  /** The rider's eye over the rails (`trackDimensions.eyeHeight`): the orbit's unit. */
  eyeHeight: number
}

/** Photo mode's camera, only while it is on (the store's `photo`). */
export default function PhotoCamera(props: PhotoCameraProps) {
  return useGameStore((s) => s.photo) ? <PhotoOrbitCamera {...props} /> : null
}

/**
 * Photo mode's camera (#828): orbits the seat's eye where the pause caught it
 * (`photoCamera.ts`), fed by `photoInput.ts`. CoasterCamera leaves the camera alone meanwhile and puts it back on the
 * seat, exactly where it was, on its next frame after this unmounts. A save request is answered right after the
 * composer's render (priority 1) in the same frame, so the PNG is the composited frame without `preserveDrawingBuffer`.
 */
function PhotoOrbitCamera({ groundFn, bounds, eyeHeight }: PhotoCameraProps) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const [s] = useState(() => {
    const fogFar = scene.fog instanceof THREE.Fog ? scene.fog.far : camera.far
    const limits = photoLimits(eyeHeight, fogFar)
    const look = camera.getWorldDirection(new THREE.Vector3())
    return {
      pivot: camera.position.clone(),
      limits,
      orbit: startOrbit(look, limits, { yaw: 0, pitch: 0, radius: 0 }),
      pos: new THREE.Vector3(),
      input: { dYaw: 0, dPitch: 0, zoom: 1, padX: 0, padY: 0, padZoom: 0 } as PhotoInput,
    }
  })

  useEffect(() => {
    resetPhotoInput()
    return () => {
      takePhotoCapture()?.(null)
      resetPhotoInput()
      const t = window.__SC_TEST__
      if (t) t.photo.on = false
    }
  }, [])

  useFrame((_, delta) => {
    // Left already, not unmounted yet: the seat is CoasterCamera's again.
    if (!useGameStore.getState().photo) return
    const dt = Math.min(delta, MAX_STEP_S)
    const i = takePhotoInput(s.input)
    const turn = PHOTO_STICK_RAD_PER_S * dt
    stepOrbit(s.orbit, i.dYaw + i.padX * turn, i.dPitch + i.padY * turn, i.zoom * Math.exp(i.padZoom * PHOTO_ZOOM_PER_S * dt), s.limits)
    orbitPosition(s.pivot, s.orbit, s.limits, groundFn, bounds, s.pos)
    camera.position.copy(s.pos)
    camera.up.copy(WORLD_UP)
    camera.lookAt(s.pivot)
    // Hides the gun, which rides on the camera.
    setCameraOffSeat(true)
    const t = window.__SC_TEST__
    if (t) {
      const p = t.photo
      p.on = true
      p.yaw = s.orbit.yaw
      p.pitch = s.orbit.pitch
      p.radius = s.orbit.radius
      p.offset = s.pos.distanceTo(s.pivot)
      p.clearance = s.pos.y - groundFn(s.pos.x, s.pos.z)
    }
  })

  useFrame(() => {
    const done = takePhotoCapture()
    if (done) gl.domElement.toBlob(done, 'image/png')
  }, 2)

  return null
}
