import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { getPointerState } from '@/input/pointerInput'
import MuzzleFlash, { type MuzzleAnchor } from './MuzzleFlash'
import { isFeedbackHeld, lastShot } from './hitFeedback'
import {
  SHOT_AIM_HOLD_MS, TRACER_MS, TRACER_RANGE, WEAPON_RECOIL_BACK, WEAPON_RECOIL_MS,
  WEAPON_MIN_LEAD, WEAPON_RECOIL_PITCH, recoilEnvelope, weaponDepth, weaponLayout,
} from './weaponLayout'

/**
 * First-person weapon view-model (issue #65): a small low-poly, code-generated
 * blaster parented to the gameplay camera, anchored bottom-right and angled at
 * the aim point. Fire recoil kicks the gun (never the camera); every shot shows
 * a small muzzle flash at the barrel tip and a short tracer streak from the
 * barrel to the aim point, so the shot reads as coming from the gun.
 *
 * Cost: the gun is ONE merged mesh (one draw call, ~200 triangles); the tracer
 * and flash are one quad each and hidden (zero draw calls) when idle.
 *
 * The gun's depth is compressed into the front 2% of the depth range in its
 * vertex shader, so it never clips into terrain / track / enemies close to the
 * camera, while still depth-testing against itself (correct self-occlusion).
 */

// Model space: barrel along -Z, receiver centre at the origin, units ≈ 1.4 long.
const TIP = new THREE.Vector3(0, 0, -0.93)
const FLASH_SIZE = 0.42 // model units
const TRACER_WIDTH = 0.045 // model units, at the barrel end
const TRACER_FAR_WIDTH_RATIO = 10 // far end width / near end width (perspective taper)
const AIM_FOLLOW = 18 // 1/s, gun slerps toward the aim
/** Rest aim (NDC) and how far the gun turns from it toward the real aim. */
const AIM_REST_X = -0.05
const AIM_REST_Y = 0.05
const AIM_WEIGHT = 0.65
/** Slight clockwise cant (radians) so the gun's side + top read on screen. */
const WEAPON_CANT = -0.12

const COLORS = {
  body: new THREE.Color('#566072'),
  dark: new THREE.Color('#1f232b'),
  accent: new THREE.Color('#ff8a1f'),
  sight: new THREE.Color('#ff3b3b'),
}

interface Part {
  geo: THREE.BufferGeometry
  color: THREE.Color
  pos: [number, number, number]
  rotX?: number
}

function buildWeaponGeometry(): THREE.BufferGeometry {
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
  const cyl = (r: number, len: number, seg = 10) =>
    new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2)
  const parts: Part[] = [
    // Receiver + top rail + rear sight
    { geo: box(0.2, 0.22, 0.62), color: COLORS.body, pos: [0, 0, 0.02] },
    { geo: box(0.1, 0.05, 0.52), color: COLORS.dark, pos: [0, 0.135, 0.02] },
    { geo: box(0.09, 0.07, 0.05), color: COLORS.dark, pos: [0, 0.19, 0.24] },
    { geo: box(0.025, 0.025, 0.026), color: COLORS.sight, pos: [0, 0.235, 0.24] },
    // Accent stripe along the receiver sides
    { geo: box(0.21, 0.035, 0.34), color: COLORS.accent, pos: [0, -0.045, 0.05] },
    // Handguard / shroud with accent stripe + front sight
    { geo: box(0.16, 0.16, 0.36), color: COLORS.body, pos: [0, 0, -0.46] },
    { geo: box(0.168, 0.03, 0.28), color: COLORS.accent, pos: [0, 0.035, -0.46] },
    { geo: box(0.03, 0.08, 0.03), color: COLORS.dark, pos: [0, 0.11, -0.6] },
    // Barrel + muzzle brake
    { geo: cyl(0.036, 0.26), color: COLORS.dark, pos: [0, 0, -0.76] },
    { geo: cyl(0.054, 0.08, 8), color: COLORS.dark, pos: [0, 0, -0.88] },
    // Grip, magazine (no stock: it would reach into the bottom-right HUD corner)
    { geo: box(0.12, 0.3, 0.14), color: COLORS.dark, pos: [0, -0.22, 0.2], rotX: -0.3 },
    { geo: box(0.1, 0.26, 0.15), color: COLORS.body, pos: [0, -0.2, -0.13], rotX: 0.15 },
    { geo: box(0.17, 0.18, 0.06), color: COLORS.dark, pos: [0, 0, 0.35] },
  ]
  const geos = parts.map(({ geo, color, pos, rotX }) => {
    if (rotX) geo.rotateX(rotX)
    geo.translate(pos[0], pos[1], pos[2])
    const n = geo.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) color.toArray(col, i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return geo
  })
  const merged = mergeGeometries(geos, false)
  for (const g of geos) g.dispose()
  if (!merged) throw new Error('WeaponViewModel: failed to merge weapon geometry')
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function createWeaponMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.3,
    // Floor so the gun never goes pure black in dark biomes / back-lit turns.
    emissive: new THREE.Color('#1a1e26'),
    fog: false,
  })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      // View-model depth: squeeze into the front 2% of the depth range so the
      // gun draws over the world but still depth-tests against itself.
      gl_Position.z = (gl_Position.z + gl_Position.w) * 0.02 - gl_Position.w;`,
    )
  }
  mat.customProgramCacheKey = () => 'sc-weapon-viewmodel-v1'
  return mat
}

/** Tapered quad along +X (0..1): near end width 1, far end TRACER_FAR_WIDTH_RATIO. */
function buildTracerGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  const w1 = TRACER_FAR_WIDTH_RATIO * 0.5
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, -0.5, 0, 1, -w1, 0, 1, w1, 0, 0, 0.5, 0,
  ]), 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  return g
}

const tracerVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Streak that travels from the barrel to the aim point. uv.x is linear in 3D;
// convert to the fraction of the on-screen path so the head moves evenly.
const tracerFragment = /* glsl */ `
  uniform float uTime;        // 0 → 1 over the tracer's life
  uniform float uDepthRatio;  // start depth / end depth
  varying vec2 vUv;
  void main() {
    float zRel = mix(1.0, 1.0 / uDepthRatio, vUv.x);          // z / zStart
    float s = (1.0 - 1.0 / zRel) / max(1.0 - uDepthRatio, 1e-3); // screen fraction
    float head = uTime * 1.6 + 0.15;
    float tail = head - 0.55;
    float along = smoothstep(tail, head, s) * (1.0 - smoothstep(head, head + 0.04, s));
    float across = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 2.0);
    float a = along * across * (1.0 - uTime * 0.6);
    vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.95, 0.75), along);
    gl_FragColor = vec4(col * a * 1.6, a);
  }
`

function createTracerMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: tracerVertex,
    fragmentShader: tracerFragment,
    uniforms: { uTime: { value: 0 }, uDepthRatio: { value: 0.02 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  })
}

const UP = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _qRecoil = new THREE.Quaternion()
const _pivot = new THREE.Vector3()
const _aim = new THREE.Vector3()
const _v = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _side = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _xAxis = new THREE.Vector3(1, 0, 0)
const _zAxis = new THREE.Vector3(0, 0, 1)
const _corner = new THREE.Vector3()

/** Camera-space point at distance `dist` along the ray through NDC (x, y). */
function aimPoint(cam: THREE.PerspectiveCamera, x: number, y: number, dist: number, out: THREE.Vector3) {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
  return out.set(x * tanHalf * cam.aspect, y * tanHalf, -1).normalize().multiplyScalar(dist)
}

export default function WeaponViewModel() {
  const gunRef = useRef<THREE.Mesh>(null)
  const tracerRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(buildWeaponGeometry, [])
  const material = useMemo(createWeaponMaterial, [])
  const tracerGeometry = useMemo(buildTracerGeometry, [])
  const tracerMaterial = useMemo(createTracerMaterial, [])
  const anchor = useMemo<MuzzleAnchor>(() => ({ tip: new THREE.Vector3(0, -1, -3), size: 0.3 }), [])

  const state = useRef({
    recoilMs: 0,
    tracerMs: 0,
    tracerPending: false,
    tracerX: 0,
    tracerY: 0,
    initialized: false,
  })

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      tracerGeometry.dispose()
      tracerMaterial.dispose()
    },
    [geometry, material, tracerGeometry, tracerMaterial],
  )

  useEffect(() => {
    const onFire = () => {
      const s = state.current
      s.recoilMs = WEAPON_RECOIL_MS
      s.tracerPending = true
      s.tracerX = lastShot.x
      s.tracerY = lastShot.y
    }
    eventBus.on('weapon:fire', onFire)
    return () => eventBus.off('weapon:fire', onFire)
  }, [])

  // Priority -1: runs before MuzzleFlash (0) so the flash uses this frame's tip.
  useFrame((frame, delta) => {
    const gun = gunRef.current
    const tracer = tracerRef.current
    const cam = gun?.parent as THREE.PerspectiveCamera | null
    if (!gun || !tracer || !cam || !(cam as THREE.PerspectiveCamera).isPerspectiveCamera) return

    const { phase, timeScale } = useGameStore.getState()
    const visible = phase === 'playing' || phase === 'paused'
    gun.visible = visible
    if (!visible) {
      tracer.visible = false
      return
    }
    const held = isFeedbackHeld()
    const dt = held ? 0 : delta * (timeScale ?? 1)
    const s = state.current

    // ── Pivot: bottom-right, sized from the viewport, at a depth past the near plane ──
    const { width, height } = frame.size
    const layout = weaponLayout(width, height)
    const { depth, scale } = weaponDepth(layout.unitPx, height, cam.fov)
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const ndcX = (layout.x / width) * 2 - 1
    const ndcY = 1 - (layout.y / height) * 2
    _pivot.set(ndcX * tanHalf * cam.aspect * depth, ndcY * tanHalf * depth, -depth)

    // ── Aim: the last shot for a moment after firing, otherwise the pointer ──
    let ax: number
    let ay: number
    if (held || performance.now() - lastShot.at < SHOT_AIM_HOLD_MS) {
      ax = lastShot.x
      ay = lastShot.y
    } else {
      const p = getPointerState()
      ax = (p.x / Math.max(1, width)) * 2 - 1
      ay = 1 - (p.y / Math.max(1, height)) * 2
    }
    // The gun turns most of the way toward the aim but keeps a leftward angle,
    // so it never points straight up the screen and loses its silhouette. The
    // tracer still runs to the exact aim point.
    const leadNdc = (2 * WEAPON_MIN_LEAD * Math.min(width, height)) / Math.max(1, width)
    const ox = Math.min(AIM_REST_X + (ax - AIM_REST_X) * AIM_WEIGHT, ndcX - leadNdc)
    const oy = AIM_REST_Y + (ay - AIM_REST_Y) * AIM_WEIGHT
    aimPoint(cam, ox, oy, TRACER_RANGE, _aim)
    _m.lookAt(_pivot, _aim, UP) // -Z (the barrel) toward the aim point
    _q.setFromRotationMatrix(_m)
    _qRecoil.setFromAxisAngle(_zAxis, WEAPON_CANT)
    _q.multiply(_qRecoil)
    if (!s.initialized || held) {
      gun.quaternion.copy(_q)
      s.initialized = true
    } else {
      gun.quaternion.slerp(_q, 1 - Math.exp(-AIM_FOLLOW * delta))
    }

    // ── Recoil: kick back along the barrel and pitch the muzzle up ──
    const env = recoilEnvelope(s.recoilMs)
    if (!held) s.recoilMs = Math.max(0, s.recoilMs - dt * 1000)
    gun.position.copy(_pivot)
    gun.scale.setScalar(scale)
    if (env > 0) {
      _v.set(0, 0, WEAPON_RECOIL_BACK * scale * env).applyQuaternion(gun.quaternion)
      gun.position.add(_v)
      _qRecoil.setFromAxisAngle(_xAxis, WEAPON_RECOIL_PITCH * env)
      _q.copy(gun.quaternion).multiply(_qRecoil)
      gun.quaternion.copy(_q)
    }
    gun.updateMatrix()
    // Undo the recoil rotation on the stored aim so the slerp target stays clean.
    if (env > 0) gun.quaternion.multiply(_qRecoil.invert())

    // ── Muzzle anchor (flash reads it this frame) ──
    anchor.tip.copy(TIP).applyMatrix4(gun.matrix)
    anchor.size = FLASH_SIZE * scale

    // ── Tracer: barrel tip → shot aim point ──
    if (s.tracerPending) {
      s.tracerPending = false
      s.tracerMs = TRACER_MS
      aimPoint(cam, s.tracerX, s.tracerY, TRACER_RANGE, _v)
      _dir.copy(_v).sub(anchor.tip)
      const len = _dir.length()
      _dir.divideScalar(len)
      // Face the camera: width axis ⟂ to the streak and to the view ray.
      _side.copy(_dir).cross(_v.copy(anchor.tip).normalize())
      if (_side.lengthSq() < 1e-10) _side.set(0, 1, 0)
      _side.normalize()
      _normal.copy(_dir).cross(_side)
      _m.makeBasis(_dir, _side, _normal)
      tracer.quaternion.setFromRotationMatrix(_m)
      tracer.position.copy(anchor.tip)
      tracer.scale.set(len, TRACER_WIDTH * scale, 1)
      tracerMaterial.uniforms.uDepthRatio.value = Math.min(0.99, -anchor.tip.z / TRACER_RANGE)
    }
    if (s.tracerMs > 0) {
      tracerMaterial.uniforms.uTime.value = held ? 0.35 : 1 - s.tracerMs / TRACER_MS
      tracer.visible = true
      if (!held) s.tracerMs -= dt * 1000
    } else if (tracer.visible) {
      tracer.visible = false
    }

    // ── e2e: the gun's on-screen box and muzzle tip ──
    const api = window.__SC_TEST__
    if (api) reportWeapon(api, gun, cam, geometry, anchor.tip, width, height)
  }, -1)

  return (
    <>
      <mesh
        ref={gunRef}
        name="weapon-viewmodel"
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={10}
        matrixAutoUpdate={false}
      />
      <mesh
        ref={tracerRef}
        name="weapon-tracer"
        geometry={tracerGeometry}
        material={tracerMaterial}
        visible={false}
        frustumCulled={false}
        renderOrder={998}
      />
      <MuzzleFlash anchor={anchor} />
    </>
  )
}

function reportWeapon(
  api: NonNullable<Window['__SC_TEST__']>,
  gun: THREE.Mesh,
  cam: THREE.PerspectiveCamera,
  geometry: THREE.BufferGeometry,
  tip: THREE.Vector3,
  width: number,
  height: number,
) {
  const box = geometry.boundingBox
  if (!box) return
  const w = (api.weapon ??= {
    visible: false, minX: 0, minY: 0, maxX: 0, maxY: 0, tipX: 0, tipY: 0, width: 0, height: 0,
  })
  w.minX = Infinity
  w.minY = Infinity
  w.maxX = -Infinity
  w.maxY = -Infinity
  for (let i = 0; i < 8; i++) {
    _corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    ).applyMatrix4(gun.matrix).applyMatrix4(cam.projectionMatrix)
    const x = ((_corner.x + 1) / 2) * width
    const y = ((1 - _corner.y) / 2) * height
    if (x < w.minX) w.minX = x
    if (x > w.maxX) w.maxX = x
    if (y < w.minY) w.minY = y
    if (y > w.maxY) w.maxY = y
  }
  _corner.copy(tip).applyMatrix4(cam.projectionMatrix)
  w.tipX = ((_corner.x + 1) / 2) * width
  w.tipY = ((1 - _corner.y) / 2) * height
  w.width = width
  w.height = height
  w.visible = gun.visible
}
