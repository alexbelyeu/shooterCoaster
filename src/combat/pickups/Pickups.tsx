import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import { WEAPONS, type PickupWeaponId } from '@/combat/weapons/weaponTypes'
import { useGameStore } from '@/store/useGameStore'
import { sfx } from '@/audio/sfx'
import { e2ePickups, isE2E } from '@/testing/e2eHook'
import { placePickups } from './pickupPlacement'

/** Gem radius and the ring around it, world units (an enemy is ~60 across). */
const GEM_RADIUS = 10
const RING_RADIUS = 15
const HIT_RADIUS = 18
const SPIN_PER_S = 1.2
const BOB_UNITS = 3
const BOB_PER_S = 2.2
const POP_S = 0.3
/** Above the bloom threshold, so the pickup glows. */
const GLOW = 1.8
const PARKED_Y = -9999

interface PickupsProps {
  levelId: string
  ids?: readonly PickupWeaponId[]
  pointAt: (t: number) => THREE.Vector3
  trackScale: number
}

export interface LivePickup {
  id: PickupWeaponId
  /** Track parameter it floats over. */
  t: number
  /** Where it floats before the bob. */
  home: THREE.Vector3
  position: THREE.Vector3
  targetId: string
  /** Seconds since it was shot; -1 while it floats. */
  popAge: number
}

function buildPickupGeometry(): THREE.BufferGeometry {
  const gem = new THREE.OctahedronGeometry(GEM_RADIUS)
  gem.scale(0.8, 1.25, 0.8)
  const ring = new THREE.TorusGeometry(RING_RADIUS, 1.1, 6, 28).toNonIndexed()
  // Facets alternate bright and dim, so the gem reads as a cut stone without lighting; the ring burns brightest.
  const shade = (g: THREE.BufferGeometry, perFace: (face: number) => number) => {
    const n = g.getAttribute('position').count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.fill(perFace(Math.floor(i / 3)), i * 3, i * 3 + 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  }
  shade(gem, (f) => (f % 2 ? 0.55 : 1))
  shade(ring, () => 1.25)
  for (const g of [gem, ring]) g.deleteAttribute('uv')
  const merged = mergeGeometries([gem, ring])
  gem.dispose()
  ring.dispose()
  if (!merged) throw new Error('pickup geometry merge failed')
  return merged
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const _white = new THREE.Color(1, 1, 1)
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Weapon pickups (#185) floating over the rails: one instanced draw call for all of them.
 * Shooting one (`processHit` on its collision target) swaps the gun for 10 s; it pops and is
 * gone for the rest of the run. Every run of the level starts with all of them back.
 */
export default function Pickups({ levelId, ids, pointAt, trackScale }: PickupsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const runId = useGameStore((s) => s.runId)
  const geometry = useMemo(buildPickupGeometry, [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), [])
  const pickups = useMemo<LivePickup[]>(
    () =>
      placePickups(levelId, ids, pointAt, trackScale).map(({ id, t, position }, i) => ({
        id,
        t,
        home: new THREE.Vector3(position.x, position.y, position.z),
        position: new THREE.Vector3(position.x, position.y, position.z),
        targetId: `pickup:${i}`,
        popAge: -1,
      })),
    [levelId, ids, pointAt, trackScale],
  )
  const clock = useRef(0)

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useEffect(() => {
    const mesh = meshRef.current
    pickups.forEach((p, i) => {
      p.popAge = -1
      p.position.copy(p.home)
      if (mesh) mesh.setColorAt(i, _c.set(WEAPONS[p.id].uiColor).multiplyScalar(GLOW))
      registerCollisionTarget({
        id: p.targetId,
        kind: 'pickup',
        getPosition: () => p.position,
        radiusSq: HIT_RADIUS * HIT_RADIUS,
        onHit: () => {
          if (p.popAge >= 0) return
          p.popAge = 0
          unregisterCollisionTarget(p.targetId)
          useGameStore.getState().pickUpWeapon(p.id)
          sfx().pickup()
        },
      })
    })
    if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
    if (isE2E) e2ePickups.list = pickups
    return () => {
      for (const p of pickups) unregisterCollisionTarget(p.targetId)
      if (isE2E) e2ePickups.list = []
    }
  }, [pickups, runId])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const { phase, timeScale } = useGameStore.getState()
    const dt = phase === 'playing' ? delta * timeScale : 0
    clock.current += dt
    const t = clock.current
    let colorsChanged = false
    pickups.forEach((p, i) => {
      let scale = 1
      if (p.popAge >= 0) {
        p.popAge += dt
        const u = p.popAge / POP_S
        if (u >= 1) {
          p.position.y = PARKED_Y
          mesh.setMatrixAt(i, _m.makeScale(0, 0, 0))
          return
        }
        scale = 1 + 1.4 * u
        mesh.setColorAt(i, _c.set(WEAPONS[p.id].uiColor).lerp(_white, u).multiplyScalar(GLOW * (1 - u)))
        colorsChanged = true
      } else {
        p.position.y = p.home.y + Math.sin(t * BOB_PER_S + i * 2.1) * BOB_UNITS
      }
      _q.setFromAxisAngle(UP, t * SPIN_PER_S + i)
      _s.setScalar(scale)
      mesh.setMatrixAt(i, _m.compose(p.position, _q, _s))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (colorsChanged && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      name="weapon-pickups"
      args={[geometry, material, pickups.length]}
      frustumCulled={false}
    />
  )
}
