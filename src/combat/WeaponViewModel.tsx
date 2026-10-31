import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { isInRun } from '@/store/startPhase'
import { getPointerState } from '@/input/pointerInput'
import MuzzleFlash, { type MuzzleAnchor } from './MuzzleFlash'
import { isFeedbackHeld, lastShot, muzzleTip } from './hitFeedback'
import {
  FLASH_SIZE, TIP, TRACER_WIDTH, buildTracerGeometry, buildWeaponGeometry, createTracerMaterial,
  createWeaponMaterial,
} from './weaponModel'
import {
  SHOT_AIM_HOLD_MS, TRACER_MS, TRACER_RANGE, WEAPON_RECOIL_BACK, WEAPON_RECOIL_MS, WEAPON_RECOIL_SCALE,
  WEAPON_MIN_AIM_DIST, WEAPON_RECOIL_PITCH, clampWeaponAim, recoilEnvelope, weaponDepth, weaponLayout,
  type WeaponDepth, type WeaponLayout,
} from './weaponLayout'
import { WEAPONS } from './weapons/weaponTypes'

/**
 * First-person gun (#65), parented to the coaster camera: anchored bottom-right,
 * barrel at the aim point, recoil on the gun (never the camera), muzzle flash at
 * the barrel tip and a tracer from the barrel to the shot's aim point.
 */

const AIM_FOLLOW = 18 // 1/s, gun slerps toward the aim
/** Slight clockwise cant (radians) so the gun's side + top read on screen. */
const WEAPON_CANT = -0.12

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
const _layout: WeaponLayout = { x: 0, y: 0, unitPx: 0 }
const _depth: WeaponDepth = { depth: 0, scale: 0 }
const _aimPx = { x: 0, y: 0 }

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
    recoilScale: 1,
    tracerMs: 0,
    tracerWidth: 1,
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
      muzzleTip.ready = false
    },
    [geometry, material, tracerGeometry, tracerMaterial],
  )

  useEffect(() => {
    const onFire = () => {
      const s = state.current
      const weapon = WEAPONS[lastShot.weapon]
      s.recoilMs = WEAPON_RECOIL_MS
      s.recoilScale = WEAPON_RECOIL_SCALE[weapon.id]
      s.tracerPending = true
      s.tracerX = lastShot.x
      s.tracerY = lastShot.y
      s.tracerWidth = weapon.tracerWidth
      tracerMaterial.uniforms.uColor.value.setRGB(...weapon.tracerColor)
    }
    eventBus.on('weapon:fire', onFire)
    return () => eventBus.off('weapon:fire', onFire)
  }, [tracerMaterial])

  // Priority -1: runs before MuzzleFlash (0) so the flash uses this frame's tip.
  useFrame((frame, delta) => {
    const gun = gunRef.current
    const tracer = tracerRef.current
    const cam = gun?.parent as THREE.PerspectiveCamera | null
    if (!gun || !tracer || !cam?.isPerspectiveCamera) return

    const { phase, timeScale } = useGameStore.getState()
    const visible = isInRun(phase)
    gun.visible = visible
    if (!visible) {
      tracer.visible = false
      return
    }
    const held = isFeedbackHeld()
    const dt = held || phase === 'paused' ? 0 : delta * (timeScale ?? 1)
    const s = state.current

    const { width, height } = frame.size
    const layout = weaponLayout(width, height, _layout)
    const { depth, scale } = weaponDepth(layout.unitPx, height, cam.fov, _depth)
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const ndcX = (layout.x / width) * 2 - 1
    const ndcY = 1 - (layout.y / height) * 2
    _pivot.set(ndcX * tanHalf * cam.aspect * depth, ndcY * tanHalf * depth, -depth)

    // Aim at the last shot for a moment after firing, otherwise the pointer.
    let axPx: number
    let ayPx: number
    if (held || performance.now() - lastShot.at < SHOT_AIM_HOLD_MS) {
      axPx = ((lastShot.x + 1) / 2) * width
      ayPx = ((1 - lastShot.y) / 2) * height
    } else {
      const p = getPointerState()
      axPx = p.x
      ayPx = p.y
    }
    // pivot→aim projects onto the same screen line as pivot→tip, so the tracer leaves along the barrel.
    clampWeaponAim(layout.x, layout.y, axPx, ayPx, WEAPON_MIN_AIM_DIST * Math.min(width, height), _aimPx)
    const ox = (_aimPx.x / Math.max(1, width)) * 2 - 1
    const oy = 1 - (_aimPx.y / Math.max(1, height)) * 2
    aimPoint(cam, ox, oy, TRACER_RANGE, _aim)
    _m.lookAt(_pivot, _aim, UP) // -Z (the barrel) toward the aim point
    _q.setFromRotationMatrix(_m)
    _qRecoil.setFromAxisAngle(_zAxis, WEAPON_CANT)
    _q.multiply(_qRecoil)
    if (!s.initialized || held) {
      gun.quaternion.copy(_q)
      s.initialized = true
    } else {
      gun.quaternion.slerp(_q, 1 - Math.exp(-AIM_FOLLOW * dt))
    }

    // Recoil: kick back along the barrel and pitch the muzzle up.
    const env = recoilEnvelope(s.recoilMs) * s.recoilScale
    s.recoilMs = Math.max(0, s.recoilMs - dt * 1000)
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

    anchor.tip.copy(TIP).applyMatrix4(gun.matrix)
    anchor.size = FLASH_SIZE * scale
    muzzleTip.x = anchor.tip.x
    muzzleTip.y = anchor.tip.y
    muzzleTip.z = anchor.tip.z
    muzzleTip.ready = true

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
      tracer.scale.set(len, TRACER_WIDTH * s.tracerWidth * scale, 1)
      tracerMaterial.uniforms.uDepthRatio.value = Math.min(0.99, -anchor.tip.z / TRACER_RANGE)
    }
    if (s.tracerMs > 0) {
      tracerMaterial.uniforms.uTime.value = held ? 0.35 : 1 - s.tracerMs / TRACER_MS
      tracer.visible = true
      s.tracerMs -= dt * 1000
    } else if (tracer.visible) {
      tracer.visible = false
    }

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
    visible: false, minX: 0, minY: 0, maxX: 0, maxY: 0, tipX: 0, tipY: 0,
    pivotX: 0, pivotY: 0, shotX: 0, shotY: 0, width: 0, height: 0,
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
  _corner.setFromMatrixPosition(gun.matrix).applyMatrix4(cam.projectionMatrix)
  w.pivotX = ((_corner.x + 1) / 2) * width
  w.pivotY = ((1 - _corner.y) / 2) * height
  w.shotX = ((lastShot.x + 1) / 2) * width
  w.shotY = ((1 - lastShot.y) / 2) * height
  w.width = width
  w.height = height
  w.visible = gun.visible
}
