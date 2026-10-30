import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import { isFeedbackHeld } from '@/combat/hitFeedback'
import { createRng } from '@/utils/rng'
import { e2eFireworks, isE2E } from '@/testing/e2eHook'
import {
  BURST_AHEAD,
  BURST_COLORS,
  BURST_TRAUMA,
  BURST_TRAUMA_MS,
  BURST_UP,
  FALLBACK_RISE,
  FIREWORK_BURST_EVENT,
  FIREWORK_LAUNCH_EVENT,
  type FireworkLaunch,
  FLIGHT_S,
  GHOST_LAG_S,
  HOLD_BURST_AGE_S,
  MAX_ROCKETS,
  PAIR_DELAY_S,
  PAIR_SIDE,
  PATTERNS,
  PATTERN_ORDER,
  POINTS_PER_SLOT,
  SPARKS_PER_BURST,
  SPARK_GHOSTS,
  TRAIL_LAG_S,
  TRAIL_POINTS,
  WILLOW_COLORS,
  burstVelocities,
  pickPad,
  rocketsForStreak,
  slotLifetime,
  type BurstPattern,
  type Vec3,
} from './fireworks'

/** Age of a free slot: before any launch, so every point is hidden. */
const IDLE_AGE = -1e4
const TRAIL_COLOR = new THREE.Color(1, 0.8, 0.55)

const vertexShader = /* glsl */ `
  #define SLOTS ${MAX_ROCKETS}
  uniform vec3 uOrigin[SLOTS];
  uniform vec3 uBurst[SLOTS];
  uniform vec4 uState[SLOTS]; // age, drag, gravity, life
  uniform vec2 uLook[SLOTS];  // spark size, twinkle
  uniform vec3 uColorA[SLOTS];
  uniform vec3 uColorB[SLOTS];
  uniform vec3 uTrailColor;
  uniform float uFlight;
  uniform float uTrailS;
  uniform float uHalfHeightPx;
  uniform float uTime;

  attribute vec4 aMeta; // slot, trail?, time lag, rand

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    int slot = int(aMeta.x + 0.5);
    vec4 st = uState[slot];
    float t = st.x - aMeta.z;
    vec3 p;
    float size;
    float alpha;
    if (aMeta.y > 0.5) {
      // Rocket: head at lag 0, the trail behind it along the same ease-out path
      float u = t / uFlight;
      float head = 1.0 - aMeta.z / uTrailS;
      alpha = (u < 0.0 || u > 1.0) ? 0.0 : head * head;
      float e = 1.0 - (1.0 - clamp(u, 0.0, 1.0)) * (1.0 - clamp(u, 0.0, 1.0));
      p = mix(uOrigin[slot], uBurst[slot], e);
      size = 3.0 + 2.0 * head;
      vColor = uTrailColor * 2.0;
    } else {
      // Spark (or a ghost of one, aMeta.z behind it): drag + gravity, mirrors sparkOffset()
      float tb = t - uFlight;
      float life = tb / st.w;
      float k = st.y;
      p = uBurst[slot] + position * ((1.0 - exp(-k * max(tb, 0.0))) / k);
      p.y -= 0.5 * st.z * tb * tb;
      float fade = 1.0 - smoothstep(0.45, 1.0, life);
      float ghost = 1.0 - aMeta.z / ${(GHOST_LAG_S * (SPARK_GHOSTS + 1)).toFixed(3)};
      float crackle = mix(1.0, step(0.45, fract(uTime * 13.0 + aMeta.w * 17.0)), uLook[slot].y * smoothstep(0.4, 0.65, life));
      alpha = (tb < 0.0 || life > 1.0) ? 0.0 : fade * ghost * crackle;
      float flash = 1.0 + 1.5 * (1.0 - smoothstep(0.0, 0.15, tb));
      vec3 base = aMeta.w < 0.7 ? uColorA[slot] : uColorB[slot];
      vColor = mix(base, uColorB[slot], 0.5 * clamp(life, 0.0, 1.0)) * 1.6 * flash;
      size = uLook[slot].x * mix(1.0, 0.6, clamp(life, 0.0, 1.0)) * (0.55 + 0.45 * ghost);
    }

    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = size * projectionMatrix[1][1] * uHalfHeightPx / max(-mv.z, 0.1);
    gl_PointSize = alpha > 0.0 ? clamp(px, 1.5, 16.0) : 0.0;
    vAlpha = alpha * min(px, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c) * 4.0;
    if (r2 > 1.0 || vAlpha <= 0.0) discard;
    gl_FragColor = vec4(vColor, vAlpha * (1.0 - r2));
  }
`

/** Fixed per-point layout: per slot, the sparks and their ghosts, then the rocket trail. */
function createGeometry(): THREE.BufferGeometry {
  const count = MAX_ROCKETS * POINTS_PER_SLOT
  const meta = new Float32Array(count * 4)
  const rand = createRng(0xf1e5)
  for (let s = 0; s < MAX_ROCKETS; s++) {
    for (let k = 0; k < POINTS_PER_SLOT; k++) {
      const j = (s * POINTS_PER_SLOT + k) * 4
      const sparkCopies = SPARKS_PER_BURST * (1 + SPARK_GHOSTS)
      const trail = k >= sparkCopies
      meta[j] = s
      meta[j + 1] = trail ? 1 : 0
      meta[j + 2] = trail ? (k - sparkCopies) * TRAIL_LAG_S : Math.floor(k / SPARKS_PER_BURST) * GHOST_LAG_S
      meta[j + 3] = rand()
    }
  }
  const geo = new THREE.BufferGeometry()
  // Spark launch velocities, rewritten per launch; the trail's stay 0.
  const velocity = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
  velocity.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', velocity)
  geo.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4))
  return geo
}

function createMaterial(): THREE.ShaderMaterial {
  const vec3s = () => Array.from({ length: MAX_ROCKETS }, () => new THREE.Vector3())
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uOrigin: { value: vec3s() },
      uBurst: { value: vec3s() },
      uState: { value: Array.from({ length: MAX_ROCKETS }, () => new THREE.Vector4(IDLE_AGE, 1, 0, 1)) },
      uLook: { value: Array.from({ length: MAX_ROCKETS }, () => new THREE.Vector2()) },
      uColorA: { value: Array.from({ length: MAX_ROCKETS }, () => new THREE.Color()) },
      uColorB: { value: Array.from({ length: MAX_ROCKETS }, () => new THREE.Color()) },
      uTrailColor: { value: TRAIL_COLOR },
      uFlight: { value: FLIGHT_S },
      uTrailS: { value: TRAIL_POINTS * TRAIL_LAG_S },
      uHalfHeightPx: { value: 360 },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

interface Slot {
  active: boolean
  /** Game seconds since launch; negative while a paired rocket waits its turn. */
  age: number
  end: number
  /** Launch order, to steal the oldest slot when all are busy. */
  order: number
}

const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _burst = new THREE.Vector3()
const _scratch = new Float32Array(SPARKS_PER_BURST * 3)
const _launch: FireworkLaunch = { flightS: FLIGHT_S, timeScale: 1 }

/** Combo-streak fireworks (#182) from the given launch pads, bursting ahead of the camera: one `Points` draw call, hidden while none is up. */
export default function Fireworks({ pads }: { pads: readonly Vec3[] }) {
  const pointsRef = useRef<THREE.Points>(null)
  const geometry = useMemo(createGeometry, [])
  const material = useMemo(createMaterial, [])
  const halfHeightPx = useThree((s) => s.size.height * s.viewport.dpr * 0.5)
  const sim = useRef({
    slots: Array.from({ length: MAX_ROCKETS }, (): Slot => ({ active: false, age: IDLE_AGE, end: 0, order: 0 })),
    pending: 0,
    launches: 0,
    rng: createRng(0xb0a7),
  }).current

  useEffect(() => {
    material.uniforms.uHalfHeightPx.value = halfHeightPx
  }, [material, halfHeightPx])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useLayoutEffect(() => {
    if (pointsRef.current) pointsRef.current.visible = false
  }, [])

  // Not the `enemy:killed` payload: kills resolved in one frame all report the final count after their pop.
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.combo.count === prev.combo.count + 1) sim.pending += rocketsForStreak(s.combo.count)
    })
    if (isE2E) Object.assign(e2eFireworks, { mounted: true, launched: 0, bursts: 0, rocketsLive: 0, burstsLive: 0, hasLast: false })
    return () => {
      unsubscribe()
      if (isE2E) e2eFireworks.mounted = false
    }
  }, [sim])

  const launch = (camera: THREE.Camera, count: number) => {
    const u = material.uniforms
    const e = camera.matrixWorld.elements
    _right.set(e[0], e[1], e[2]).normalize()
    _up.set(e[4], e[5], e[6]).normalize()
    _fwd.set(-e[8], -e[9], -e[10]).normalize()
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let r = 0; r < count; r++) {
      const slotIndex = freeSlot(sim.slots)
      const slot = sim.slots[slotIndex]
      const pattern: BurstPattern = PATTERN_ORDER[sim.launches % PATTERN_ORDER.length]
      const delay = r * PAIR_DELAY_S
      slot.active = true
      slot.age = -delay
      slot.end = slotLifetime(pattern)
      slot.order = sim.launches
      sim.launches += 1

      const side = count > 1 ? (r === 0 ? -0.5 : 0.5) * PAIR_SIDE : 0
      _burst.copy(camera.position)
        .addScaledVector(_fwd, BURST_AHEAD)
        .addScaledVector(_up, BURST_UP + sim.rng.range(-15, 15))
        .addScaledVector(_right, side + sim.rng.range(-30, 30))
      u.uBurst.value[slotIndex].copy(_burst)
      const pad = pickPad(pads, _burst, camera.position, _fwd)
      if (pad >= 0) u.uOrigin.value[slotIndex].set(pads[pad].x, pads[pad].y, pads[pad].z)
      else u.uOrigin.value[slotIndex].copy(_burst).y -= FALLBACK_RISE

      const spec = PATTERNS[pattern]
      u.uState.value[slotIndex].set(slot.age, spec.drag, spec.gravity, spec.lifeS)
      u.uLook.value[slotIndex].set(spec.size, spec.twinkle)
      const [a, b] = pattern === 'willow' ? WILLOW_COLORS : BURST_COLORS[slot.order % BURST_COLORS.length]
      u.uColorA.value[slotIndex].set(a)
      u.uColorB.value[slotIndex].set(b)

      burstVelocities(pattern, sim.rng, _fwd, _scratch)
      const base = slotIndex * POINTS_PER_SLOT * 3
      for (let g = 0; g <= SPARK_GHOSTS; g++) pos.array.set(_scratch, base + g * SPARKS_PER_BURST * 3)
      pos.addUpdateRange(base, SPARKS_PER_BURST * (1 + SPARK_GHOSTS) * 3)
      pos.needsUpdate = true
      if (isE2E) e2eFireworks.launched += 1
    }
  }

  useFrame(({ camera, clock }, delta) => {
    const points = pointsRef.current
    if (!points) return
    const { phase, timeScale } = useGameStore.getState()
    const live = phase === 'playing' || phase === 'paused' || phase === 'results'
    if (!live) {
      sim.pending = 0
      if (points.visible) clearSlots(sim.slots, material)
      points.visible = false
      return
    }
    if (phase === 'playing' && sim.pending > 0) {
      launch(camera, Math.min(sim.pending, MAX_ROCKETS))
      sim.pending = 0
    }

    const dt = phase === 'playing' ? delta * timeScale : phase === 'results' ? delta : 0
    const held = isFeedbackHeld()
    const holdAt = FLIGHT_S + HOLD_BURST_AGE_S
    const state = material.uniforms.uState.value as THREE.Vector4[]
    let any = false
    let rockets = 0
    let bursts = 0
    for (let i = 0; i < MAX_ROCKETS; i++) {
      const slot = sim.slots[i]
      if (!slot.active) continue
      const prev = slot.age
      let next = prev + dt
      if (held) next = Math.max(prev, Math.min(next, holdAt))
      if (prev < 0 && next >= 0) {
        _launch.timeScale = timeScale
        eventBus.emit(FIREWORK_LAUNCH_EVENT, _launch)
      }
      if (prev < FLIGHT_S && next >= FLIGHT_S) {
        eventBus.emit(FIREWORK_BURST_EVENT)
        eventBus.emit(CAMERA_TRAUMA_EVENT, BURST_TRAUMA, BURST_TRAUMA_MS)
        if (isE2E) {
          e2eFireworks.bursts += 1
          e2eFireworks.hasLast = true
          e2eFireworks.last.copy(material.uniforms.uBurst.value[i])
        }
      }
      slot.age = next
      if (next > slot.end) {
        slot.active = false
        slot.age = IDLE_AGE
      } else {
        any = true
        if (next < FLIGHT_S) rockets += next >= 0 ? 1 : 0
        else bursts += 1
      }
      state[i].x = slot.age
    }
    material.uniforms.uTime.value = clock.elapsedTime
    points.visible = any
    if (isE2E) {
      e2eFireworks.rocketsLive = rockets
      e2eFireworks.burstsLive = bursts
    }
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}

function freeSlot(slots: Slot[]): number {
  let oldest = 0
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].active) return i
    if (slots[i].order < slots[oldest].order) oldest = i
  }
  return oldest
}

function clearSlots(slots: Slot[], material: THREE.ShaderMaterial): void {
  const state = material.uniforms.uState.value as THREE.Vector4[]
  for (let i = 0; i < slots.length; i++) {
    slots[i].active = false
    slots[i].age = IDLE_AGE
    state[i].x = IDLE_AGE
  }
}
