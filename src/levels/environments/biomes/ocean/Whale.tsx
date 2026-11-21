import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake.hot'
import { placeSound, sfx } from '@/audio/sfx'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { WHALE_SPLASH_DEATH_STYLE } from '@/effects/deathStyles'
import { distanceAtT, type ArcTable } from '@/track/arcLength'
import type { RideSpeeds } from '@/track/ridePhysics'
import { rideProgress } from '@/track/rideProgress.hot'
import { createWhaleGeometry } from './seaProps'
import {
  SPLASH_FALL, WHALE_LENGTH, breachPhase, breachSite, whalePose, type WhalePose,
} from './whaleBreach'

/** Mild: the whale is ~3.7 km off (none with reduced motion, `effectiveShakeScale`). */
const CRASH_TRAUMA = 0.3
const CRASH_TRAUMA_MS = 600
/** A phase step this big is a jump (the smoke's `rideTo`), not the ride: no splash. */
const MAX_PHASE_STEP = 0.2

/** Scenery, not a target: one mesh, hidden but for the breach, and nothing raycasts it (shots only test enemies). */
export default function Whale({ track, speeds }: { track: ArcTable; speeds: RideSpeeds }) {
  const site = useMemo(() => breachSite(track, speeds), [track, speeds])
  const geometry = useMemo(() => createWhaleGeometry(WHALE_LENGTH), [])
  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
    [],
  )
  const meshRef = useRef<THREE.Mesh>(null)
  const state = useMemo(() => ({ phase: -1, pose: {} as WhalePose, at: new THREE.Vector3() }), [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const u = breachPhase(site, distanceAtT(track, rideProgress()))
    const last = state.phase
    state.phase = u
    mesh.visible = u >= 0 && u <= 1
    if (!mesh.visible) return
    const { pose, at } = state
    whalePose(site, u, pose)
    mesh.position.set(pose.x, pose.y, pose.z)
    mesh.rotation.set(-pose.pitch, Math.atan2(site.dirX, site.dirZ), pose.roll)

    if (u - last > MAX_PHASE_STEP) return
    if (last < SPLASH_FALL && u >= SPLASH_FALL) {
      at.set(pose.x, 0, pose.z)
      getExplosionPool()?.explode(at, WHALE_SPLASH_DEATH_STYLE)
      eventBus.emit(CAMERA_TRAUMA_EVENT, CRASH_TRAUMA, CRASH_TRAUMA_MS)
      sfx().kill(1, 'splash', placeSound(at))
    }
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} rotation-order="YXZ" visible={false} />
}
