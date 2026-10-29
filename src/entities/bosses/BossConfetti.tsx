import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import type { BossDefeatedEvent } from './BossBase'
import { CONFETTI_COLORS, CONFETTI_COUNT, CONFETTI_GEO, CONFETTI_MAT } from './bossAssets'

const LIFE_S = 3.2
const GRAVITY = 160
/** Velocity kept per second. */
const DRAG = 0.35
const SPREAD = { x: 200, y: 60, z: 60 }

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _color = new THREE.Color()

export default function BossConfetti({ bossId }: { bossId: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const sim = useRef({
    age: -1,
    pos: new Float32Array(CONFETTI_COUNT * 3),
    vel: new Float32Array(CONFETTI_COUNT * 3),
    axis: new Float32Array(CONFETTI_COUNT * 3),
    spin: new Float32Array(CONFETTI_COUNT),
  }).current

  // Colours before the first render, so the warm-up compiles the instance-colour program.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < CONFETTI_COUNT; i++) mesh.setColorAt(i, _color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useEffect(() => {
    const onDefeated = (e: unknown) => {
      const { id, position } = e as BossDefeatedEvent
      const mesh = meshRef.current
      if (id !== bossId || !mesh) return
      for (let i = 0; i < CONFETTI_COUNT; i++) {
        const j = i * 3
        const ox = (Math.random() * 2 - 1) * SPREAD.x
        const oy = (Math.random() * 2 - 1) * SPREAD.y
        const oz = (Math.random() * 2 - 1) * SPREAD.z
        sim.pos[j] = position.x + ox
        sim.pos[j + 1] = position.y + oy
        sim.pos[j + 2] = position.z + oz
        const speed = 120 + Math.random() * 260
        const len = Math.hypot(ox, oy, oz) || 1
        sim.vel[j] = (ox / len) * speed
        sim.vel[j + 1] = (oy / len) * speed + 160
        sim.vel[j + 2] = (oz / len) * speed
        _axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        _axis.toArray(sim.axis, j)
        sim.spin[i] = 4 + Math.random() * 10
      }
      sim.age = 0
      mesh.visible = true
    }
    eventBus.on('boss:defeated', onDefeated)
    return () => eventBus.off('boss:defeated', onDefeated)
  }, [bossId, sim])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    const { phase, timeScale } = useGameStore.getState()
    if (!mesh || sim.age < 0 || phase !== 'playing' || timeScale === 0) return
    const dt = delta * timeScale
    sim.age += dt
    if (sim.age >= LIFE_S) {
      sim.age = -1
      mesh.visible = false
      return
    }
    const drag = Math.pow(DRAG, dt)
    const scale = Math.min(1, (LIFE_S - sim.age) / 0.6)
    _s.setScalar(scale)
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const j = i * 3
      sim.vel[j] *= drag
      sim.vel[j + 1] = sim.vel[j + 1] * drag - GRAVITY * dt
      sim.vel[j + 2] *= drag
      sim.pos[j] += sim.vel[j] * dt
      sim.pos[j + 1] += sim.vel[j + 1] * dt
      sim.pos[j + 2] += sim.vel[j + 2] * dt
      _p.fromArray(sim.pos, j)
      _q.setFromAxisAngle(_axis.fromArray(sim.axis, j), sim.age * sim.spin[i])
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[CONFETTI_GEO, CONFETTI_MAT, CONFETTI_COUNT]}
      visible={false}
      frustumCulled={false}
    />
  )
}
