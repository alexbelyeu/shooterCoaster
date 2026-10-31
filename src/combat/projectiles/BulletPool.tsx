import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { getCollisionTargets, processHit } from '@/combat/CollisionManager'
import { MAX_PIERCE } from '@/combat/weapons/weaponTypes'
import { muzzleTip } from '@/combat/hitFeedback'
import { e2eBullets, isE2E } from '@/testing/e2eHook'
import type { Bullet, BulletPoolHandle } from './bulletPoolHandle'
import { setBulletPool } from './bulletPoolHandle'
import { BULLET_SPEED_PER_SEC, hasHit, recordHit, resetPierce, segmentHitsSphere, stepBullet } from './bulletMotion'
import { BULLET_RADIUS_PER_SIZE, drawnBulletRadius, muzzleOffsetWeight, screenRadiusFraction } from './bulletVisual'

const POOL_SIZE = 350
const BULLET_LIFETIME_MS = 5000

const _forward = new THREE.Vector3()
const _muzzle = new THREE.Vector3()
const _drawn = new THREE.Vector3()
const _toBullet = new THREE.Vector3()

interface BulletPoolProps {
  bulletSize?: number
  bulletColor?: string
}

export default function BulletPool({
  bulletSize = 10,
  bulletColor = '#ff0000',
}: BulletPoolProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const bullets = useMemo<Bullet[]>(() => {
    const arr: Bullet[] = []
    for (let i = 0; i < POOL_SIZE; i++) {
      arr.push({
        alive: false,
        bornAt: 0,
        position: new THREE.Vector3(0, -9999, 0),
        prev: new THREE.Vector3(0, -9999, 0),
        direction: new THREE.Vector3(0, 0, -1),
        speed: BULLET_SPEED_PER_SEC,
        hitScale: 1,
        muzzleOffset: new THREE.Vector3(),
        muzzlePending: false,
        travelled: 0,
        pierce: 1,
        hitCount: 0,
        hitTargets: new Array(MAX_PIERCE).fill(null),
      })
    }
    return arr
  }, [])

  const liveBulletBuffer = useRef<Bullet[]>(new Array(POOL_SIZE))
  const liveBulletCount = useRef(0)
  const nextFreeIndex = useRef(0)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempColor = useMemo(() => new THREE.Color(bulletColor), [bulletColor])
  const scaleVec = useRef(new THREE.Vector3()).current

  const fire = useCallback(
    (origin: THREE.Vector3, direction: THREE.Vector3, hitScale = 1, pierce = 1): boolean => {
      // Scan from last known free index, wrapping around once
      let bullet: Bullet | null = null
      for (let i = 0; i < POOL_SIZE; i++) {
        const idx = (nextFreeIndex.current + i) % POOL_SIZE
        if (!bullets[idx].alive) {
          bullet = bullets[idx]
          nextFreeIndex.current = (idx + 1) % POOL_SIZE
          break
        }
      }
      if (!bullet) return false

      bullet.alive = true
      bullet.bornAt = performance.now()
      bullet.position.copy(origin)
      bullet.prev.copy(origin)
      bullet.direction.copy(direction).normalize()
      bullet.speed = BULLET_SPEED_PER_SEC
      bullet.hitScale = hitScale
      bullet.muzzlePending = true
      bullet.travelled = 0
      resetPierce(bullet, pierce)
      return true
    },
    [bullets],
  )

  const getLiveBullets = useCallback(() => liveBulletBuffer.current, [])
  const getLiveBulletCount = useCallback(() => liveBulletCount.current, [])

  useEffect(() => {
    if (meshRef.current) meshRef.current.count = 0
  }, [])

  useEffect(() => {
    setBulletPool({ fire, getLiveBullets, getLiveBulletCount })
    return () => setBulletPool(null)
  }, [fire, getLiveBullets, getLiveBulletCount])

  useFrame(({ camera }, delta) => {
    if (!meshRef.current || useGameStore.getState().phase !== 'playing') return

    const now = performance.now()
    const mesh = meshRef.current
    const fullRadius = bulletSize * BULLET_RADIUS_PER_SIZE
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 75
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2))
    // From the pose, not matrixWorld: the coaster camera moved this frame and has not rendered yet.
    _forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    // WeaponViewModel (priority -1) has already turned the gun to the shot: the tracer starts from this same tip.
    if (muzzleTip.ready) _muzzle.set(muzzleTip.x, muzzleTip.y, muzzleTip.z).applyQuaternion(camera.quaternion).add(camera.position)
    const testStep = isE2E ? (window.__SC_TEST__?.bulletStep ?? null) : null
    let maxFrac = 0
    let newestBorn = -Infinity
    // Only live bullets are drawn, packed first: the idle pool used to cost ~39k triangles.
    let drawn = 0

    for (let i = 0; i < POOL_SIZE; i++) {
      const bullet = bullets[i]
      if (!bullet.alive) continue

      if (bullet.muzzlePending) {
        bullet.muzzlePending = false
        if (muzzleTip.ready) bullet.muzzleOffset.subVectors(_muzzle, bullet.position)
        else bullet.muzzleOffset.set(0, 0, 0)
      }
      if (testStep === null && now - bullet.bornAt > BULLET_LIFETIME_MS) {
        bullet.alive = false
        bullet.position.set(0, -9999, 0)
        continue
      }
      // Time-based (not per-frame) travel; the hit test below sweeps prev → position.
      bullet.prev.copy(bullet.position)
      stepBullet(bullet.position, bullet.direction, bullet.speed, testStep ?? delta)
      bullet.travelled += bullet.prev.distanceTo(bullet.position)

      _drawn.copy(bullet.muzzleOffset).multiplyScalar(muzzleOffsetWeight(bullet.travelled)).add(bullet.position)
      const depth = _toBullet.subVectors(_drawn, camera.position).dot(_forward)
      const radius = drawnBulletRadius(fullRadius, depth, tanHalf)
      scaleVec.set(radius, radius, radius)
      tempMatrix.makeTranslation(_drawn.x, _drawn.y, _drawn.z)
      tempMatrix.scale(scaleVec)
      mesh.setMatrixAt(drawn, tempMatrix)
      liveBulletBuffer.current[drawn++] = bullet

      if (isE2E && radius > 0) {
        maxFrac = Math.max(maxFrac, screenRadiusFraction(radius, depth, tanHalf))
        if (bullet.bornAt > newestBorn) {
          newestBorn = bullet.bornAt
          e2eBullets.newest.copy(_drawn)
        }
      }
    }

    mesh.count = drawn
    mesh.instanceMatrix.needsUpdate = true
    const count = drawn
    liveBulletCount.current = count
    if (isE2E) {
      e2eBullets.drawn = drawn
      e2eBullets.screenFrac = maxFrac
      e2eBullets.maxScreenFrac = Math.max(e2eBullets.maxScreenFrac, maxFrac)
      e2eBullets.hasNewest = newestBorn > -Infinity
    }

    // Centralized collision pass — flag hits first, process after
    const targets = getCollisionTargets()
    if (targets.size > 0 && count > 0) {
      // Phase 1: pure math — flag hits, no side effects
      for (let b = count - 1; b >= 0; b--) {
        const bullet = liveBulletBuffer.current[b]
        if (!bullet.alive) continue
        for (const target of targets.values()) {
          // One hit per target per frame; a piercing bullet never hits the same target twice.
          if (target.hitThisFrame || hasHit(bullet, target)) continue
          const pos = target.getPosition()
          const a = bullet.prev
          const b = bullet.position
          const rSq = target.radiusSq * bullet.hitScale * bullet.hitScale
          if (segmentHitsSphere(a.x, a.y, a.z, b.x, b.y, b.z, pos.x, pos.y, pos.z, rSq)) {
            target.hitThisFrame = true
            target.firstHitThisFrame = bullet.hitCount === 0
            if (recordHit(bullet, target)) {
              bullet.alive = false
              bullet.position.set(0, -9999, 0)
              break
            }
          }
        }
      }

      // Phase 2: process hits — side effects happen outside the hot loop
      for (const target of targets.values()) {
        if (target.hitThisFrame) {
          target.hitThisFrame = false
          processHit(target, target.firstHitThisFrame)
        }
      }
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL_SIZE]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={tempColor}
        emissive={tempColor}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
