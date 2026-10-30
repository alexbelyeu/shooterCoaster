import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { isFeedbackHeld } from '@/combat/hitFeedback'
import { e2eDeaths, isE2E } from '@/testing/e2eHook'
import { setExplosionPool } from './explosionPoolHandle'
import {
  CHUNKS_PER_SLOT,
  DEATH_SLOTS,
  BOSS_PART_DEATH_STYLE,
  DEATH_STYLES,
  GLOW_PER_SLOT,
  SHAPE_STRETCH,
  isChunk,
  nextAge,
  particleOffset,
  sizeAt,
  type DeathStyle,
} from './deathStyles'

const GLOW_GEO = new THREE.BoxGeometry(1, 1, 1)
const CHUNK_GEO = new THREE.DodecahedronGeometry(0.6, 0)

/** Slot s owns instances [s * perSlot, s * perSlot + count). */
interface ParticleSet {
  perSlot: number
  mesh: THREE.InstancedMesh
  vel: Float32Array
  axis: Float32Array
  phase: Float32Array
  spin: Float32Array
  size: Float32Array
  layer: Uint8Array
}

interface Slot {
  active: boolean
  needsZero: boolean
  age: number
  /** Activation order: a full pool steals the oldest. */
  serial: number
  style: DeathStyle
  origin: THREE.Vector3
  glowCount: number
  chunkCount: number
}

function createSet(perSlot: number, geometry: THREE.BufferGeometry, material: THREE.Material): ParticleSet {
  const cap = perSlot * DEATH_SLOTS
  const mesh = new THREE.InstancedMesh(geometry, material, cap)
  // Created up front: an instanceColor added later would compile a second program mid-run.
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < cap; i++) mesh.setMatrixAt(i, zero)
  return {
    perSlot,
    mesh,
    vel: new Float32Array(cap * 3),
    axis: new Float32Array(cap * 3),
    phase: new Float32Array(cap),
    spin: new Float32Array(cap),
    size: new Float32Array(cap),
    layer: new Uint8Array(cap),
  }
}

const colorCache = new Map<string, THREE.Color>()
function colorOf(hex: string): THREE.Color {
  let c = colorCache.get(hex)
  if (!c) {
    c = new THREE.Color(hex)
    colorCache.set(hex, c)
  }
  return c
}

const _color = new THREE.Color()

function launch(set: ParticleSet, s: number, style: DeathStyle, chunks: boolean): number {
  const base = s * set.perSlot
  let n = 0
  for (let li = 0; li < style.layers.length; li++) {
    const l = style.layers[li]
    if (isChunk(l) !== chunks) continue
    for (let p = 0; p < l.count && n < set.perSlot; p++, n++) {
      const i = base + n
      const z = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      const speed = (l.speed[0] + Math.random() * (l.speed[1] - l.speed[0])) * style.scale
      set.vel[i * 3] = r * Math.cos(a) * speed
      set.vel[i * 3 + 1] = r * Math.sin(a) * speed + l.up * style.scale
      set.vel[i * 3 + 2] = z * speed
      const az = Math.random() * 2 - 1
      const aa = Math.random() * Math.PI * 2
      const ar = Math.sqrt(1 - az * az)
      set.axis[i * 3] = ar * Math.cos(aa)
      set.axis[i * 3 + 1] = ar * Math.sin(aa)
      set.axis[i * 3 + 2] = az
      set.phase[i] = Math.random() * Math.PI * 2
      set.spin[i] = (Math.random() * 2 - 1) * l.spin
      set.size[i] = l.size * style.scale * (0.7 + Math.random() * 0.6)
      set.layer[i] = li
      _color.copy(colorOf(l.colors[Math.floor(Math.random() * l.colors.length)]))
      if (!chunks) _color.multiplyScalar(l.glow)
      set.mesh.setColorAt(i, _color)
    }
  }
  if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true
  return n
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _axis = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _scale = new THREE.Vector3()
const _off = { x: 0, y: 0, z: 0 }
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0)

function place(set: ParticleSet, s: number, count: number, slot: Slot, life: number): void {
  const base = s * set.perSlot
  const { style, age, origin } = slot
  for (let n = 0; n < count; n++) {
    const i = base + n
    const l = style.layers[set.layer[i]]
    _axis.set(set.vel[i * 3], set.vel[i * 3 + 1], set.vel[i * 3 + 2])
    particleOffset(_off, _axis, l.drag, l.gravity * style.scale, age)
    _pos.set(origin.x + _off.x, origin.y + _off.y, origin.z + _off.z)
    _axis.set(set.axis[i * 3], set.axis[i * 3 + 1], set.axis[i * 3 + 2])
    _q.setFromAxisAngle(_axis, set.phase[i] + set.spin[i] * age)
    const k = set.size[i] * sizeAt(life, l.hold)
    const st = SHAPE_STRETCH[l.shape]
    _scale.set(st[0] * k, st[1] * k, st[2] * k)
    _m.compose(_pos, _q, _scale)
    set.mesh.setMatrixAt(i, _m)
  }
}

function zero(set: ParticleSet, s: number): void {
  const base = s * set.perSlot
  for (let n = 0; n < set.perSlot; n++) set.mesh.setMatrixAt(base + n, ZERO_MATRIX)
}

function styleName(style: DeathStyle): string {
  for (const [type, s] of Object.entries(DEATH_STYLES)) if (s === style) return type
  return style === BOSS_PART_DEATH_STYLE ? 'bossPart' : 'custom'
}

/** Every death effect: two InstancedMeshes shared by all slots (unlit glow shapes, lit chunks), ageing on game time. */
export default function ParticleExplosionPool() {
  const pool = useMemo(() => {
    const glowMat = new THREE.MeshBasicMaterial({ toneMapped: false })
    const chunkMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: true })
    const slots: Slot[] = Array.from({ length: DEATH_SLOTS }, () => ({
      active: false, needsZero: false, age: 0, serial: 0,
      style: BOSS_PART_DEATH_STYLE, origin: new THREE.Vector3(), glowCount: 0, chunkCount: 0,
    }))
    return {
      glowMat,
      chunkMat,
      glow: createSet(GLOW_PER_SLOT, GLOW_GEO, glowMat),
      chunks: createSet(CHUNKS_PER_SLOT, CHUNK_GEO, chunkMat),
      slots,
      serial: 0,
    }
  }, [])
  const lightRef = useRef<THREE.PointLight>(null)

  useEffect(() => {
    const { slots } = pool
    const explode = (position: THREE.Vector3, style: DeathStyle) => {
      let s = slots.findIndex((slot) => !slot.active)
      if (s < 0) {
        s = 0
        for (let i = 1; i < DEATH_SLOTS; i++) if (slots[i].serial < slots[s].serial) s = i
        zero(pool.glow, s)
        zero(pool.chunks, s)
      }
      const slot = slots[s]
      slot.active = true
      slot.age = 0
      slot.serial = ++pool.serial
      slot.style = style
      slot.origin.set(position.x, position.y + style.lift, position.z)
      slot.glowCount = launch(pool.glow, s, style, false)
      slot.chunkCount = launch(pool.chunks, s, style, true)
      if (isE2E) {
        e2eDeaths.spawned += 1
        e2eDeaths.lastStyle = styleName(style)
        e2eDeaths.hasLast = true
        e2eDeaths.last.copy(slot.origin)
      }
    }
    setExplosionPool({ explode })
    if (isE2E) Object.assign(e2eDeaths, { mounted: true, spawned: 0, live: 0, lastStyle: '', hasLast: false })
    return () => {
      setExplosionPool(null)
      if (isE2E) e2eDeaths.mounted = false
      pool.glow.mesh.dispose()
      pool.chunks.mesh.dispose()
      pool.glowMat.dispose()
      pool.chunkMat.dispose()
    }
  }, [pool])

  useFrame((_, delta) => {
    const { phase, timeScale } = useGameStore.getState()
    const dt = phase === 'paused' ? 0 : delta * timeScale
    const held = isFeedbackHeld()
    const { slots, glow, chunks } = pool
    let dirty = false
    let live = 0
    let flash: Slot | null = null

    for (let s = 0; s < DEATH_SLOTS; s++) {
      const slot = slots[s]
      if (!slot.active) {
        if (slot.needsZero) {
          zero(glow, s)
          zero(chunks, s)
          slot.needsZero = false
          dirty = true
        }
        continue
      }
      slot.age = nextAge(slot.age, dt, slot.style.lifetime, held)
      if (slot.age >= slot.style.lifetime) {
        slot.active = false
        slot.needsZero = true
        continue
      }
      live++
      const life = slot.age / slot.style.lifetime
      place(glow, s, slot.glowCount, slot, life)
      place(chunks, s, slot.chunkCount, slot, life)
      dirty = true
      if (slot.style.flash > 0 && (!flash || slot.serial > flash.serial)) flash = slot
    }

    if (dirty) {
      glow.mesh.instanceMatrix.needsUpdate = true
      chunks.mesh.instanceMatrix.needsUpdate = true
    }
    if (isE2E) e2eDeaths.live = live

    const light = lightRef.current
    if (light) {
      if (flash) {
        const t = flash.age
        const peak = flash.style.flash
        light.position.copy(flash.origin)
        light.color.copy(colorOf(flash.style.flashColor))
        light.intensity = t < 0.04 ? peak * (t / 0.04) : t < 0.15 ? peak * (1 - (t - 0.04) / 0.11) : 0
      } else {
        light.intensity = 0
      }
    }
  })

  return (
    <group>
      <pointLight ref={lightRef} intensity={0} distance={200} decay={2} />
      <primitive object={pool.glow.mesh} />
      <primitive object={pool.chunks.mesh} />
    </group>
  )
}
