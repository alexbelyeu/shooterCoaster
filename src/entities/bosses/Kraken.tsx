import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import { placeSound, sfx } from '@/audio/sfx'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { KRAKEN_SPLASH_DEATH_STYLE } from '@/effects/deathStyles'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { createFoamMaterial, createFoamRingGeometry } from '@/levels/environments/biomes/ocean/seaMaterials'
import { oceanLayout, seaObstacles } from '@/levels/environments/biomes/ocean/seaPlacement'
import { createRng, hashString } from '@/utils/rng'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import type { WeakPointSpec } from './bossModel'
import { KRAKEN } from './bossSpecs'
import {
  KRAKEN_EYE_GEO, KRAKEN_EYE_MAT, KRAKEN_HEAD_GEO, KRAKEN_PAD_GEO, KRAKEN_PAD_MAT, KRAKEN_SEGMENT_GEO, KRAKEN_SKIN_MAT,
} from './bossAssets'
import {
  KRAKEN_HEAD, KRAKEN_TENTACLE, behind, createChain, headFrame, layChain, pickSpot, segmentRadius, slamImpactBetween,
  tentacleFrame, type HeadFrame, type Spot, type TentacleFrame,
} from './krakenMotion'

const T = KRAKEN_TENTACLE
const H = KRAKEN_HEAD
const SEGMENT_COUNT = T.count * T.segments
const HEAD_FOAM = T.count
const EYE_INDEX = KRAKEN.weakPoints.findIndex((w) => w.id === 'eye')
/** Segments wholly this far under the surface are not drawn. */
const HIDDEN_BELOW = -20
/** A weak point not out of the water parks here, where nothing can aim at it. */
const PARKED_Y = -9999
/** Past this distance a surfaced tentacle or head has been left behind and goes down. */
const LEFT_BEHIND = 2200
const RISE_TRAUMA = [0.15, 300] as const
const SLAM_TRAUMA = [0.4, 450] as const
const DEFEAT_TRAUMA = [0.8, 900] as const
const EXIT_SECONDS = H.defeatSinkS + 0.8

type Mode = 'waiting' | 'up' | 'gone'

interface Run {
  mode: Mode
  tau: number
  sinkAt: number
  sinkS: number
  wait: number
  spot: Spot
}

const newRun = (wait: number, sinkS: number): Run => ({
  mode: 'waiting', tau: 0, sinkAt: Infinity, sinkS, wait, spot: { x: 0, z: 0, outX: 1, outZ: 0 },
})

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const _m = new THREE.Matrix4()
const _cam = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _p = new THREE.Vector3()
const _camXZ = { x: 0, y: 0, z: 0 }

function renderWeakPoint(w: WeakPointSpec) {
  return w.id === 'eye'
    ? <mesh geometry={KRAKEN_EYE_GEO} material={KRAKEN_EYE_MAT} />
    : <mesh geometry={KRAKEN_PAD_GEO} material={KRAKEN_PAD_MAT} />
}

function splash(x: number, z: number, trauma: readonly [number, number], sound: boolean) {
  _p.set(x, 0, z)
  getExplosionPool()?.explode(_p, KRAKEN_SPLASH_DEATH_STYLE)
  eventBus.emit(CAMERA_TRAUMA_EVENT, trauma[0], trauma[1])
  if (sound) sfx().kill(1, 'splash', placeSound(_p))
}

/** Ocean finale: shoot the sucker pad on each of five tentacles, then the eye of the head that surfaces after them. */
export default function Kraken(props: BossProps) {
  const { track, groundFn } = props
  const runSeed = useGameStore((s) => s.runSeed)
  const segmentsRef = useRef<THREE.InstancedMesh>(null)
  const foamRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.Group>(null)

  const foamGeo = useMemo(() => createFoamRingGeometry(), [])
  const foam = useMemo(() => createFoamMaterial(ATMOSPHERES.ocean.fogFar * 0.4, ATMOSPHERES.ocean.fogFar), [])
  useEffect(() => () => foamGeo.dispose(), [foamGeo])
  useEffect(() => () => foam.material.dispose(), [foam])

  const world = useMemo(
    () => ({ index: buildTrackIndex(track), avoid: seaObstacles(oceanLayout(groundFn, track)) }),
    [track, groundFn],
  )

  const sim = useMemo(() => {
    const tentacles = Array.from({ length: T.count }, (_, i) => newRun(i * T.stagger, T.sinkS))
    return {
      rng: createRng(runSeed ^ hashString('kraken')),
      tentacles,
      head: newRun(0, H.sinkS),
      headStarted: false,
      defeatSplashed: false,
      taken: tentacles.map((r) => r.spot),
      noTaken: [] as Spot[],
      chain: createChain(),
      tentacle: { emerge: 0, bend: 0, yaw: 0 } as TentacleFrame,
      headPose: { emerge: 0, y: 0 } as HeadFrame,
    }
  }, [runSeed])

  useFrame(({ clock }) => {
    foam.uTime.value = clock.elapsedTime
  })

  const surface = useCallback(
    (run: Run, kind: 'tentacle' | 'head'): boolean => {
      const ok = pickSpot(run.spot, {
        index: world.index,
        groundFn,
        camera: _camXZ,
        forwardX: _fwd.x,
        forwardZ: _fwd.z,
        rng: sim.rng,
        kind,
        // A tentacle's own old spot is in the list too: it surfaces somewhere new.
        taken: kind === 'tentacle' ? sim.taken : sim.noTaken,
        avoid: world.avoid,
      })
      if (!ok) return false
      run.mode = 'up'
      run.tau = 0
      run.sinkAt = (kind === 'head' ? H.riseS + H.upS : T.riseS + T.upS)
      return true
    },
    [groundFn, world, sim],
  )

  /** False once it has finished sinking. */
  const advance = useCallback((run: Run, dt: number, alive: boolean, upMin: number) => {
    run.tau += dt
    if (run.tau < run.sinkAt && run.tau > upMin) {
      const { x, z } = run.spot
      if (behind(x, z, _camXZ, _fwd.x, _fwd.z) || Math.hypot(x - _cam.x, z - _cam.z) > LEFT_BEHIND) run.sinkAt = run.tau
    }
    if (!alive) run.sinkAt = Math.min(run.sinkAt, run.tau)
    return run.tau < run.sinkAt + run.sinkS
  }, [])

  const move = useCallback(
    ({ root, parts, camera, state, dt, age, sinceDefeat }: BossFrame) => {
      const segments = segmentsRef.current
      const foamRings = foamRef.current
      const head = headRef.current
      if (!segments || !foamRings || !head) return
      camera.getWorldPosition(_cam)
      camera.getWorldDirection(_fwd)
      _fwd.y = 0
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1)
      _fwd.normalize()
      _camXZ.x = _cam.x
      _camXZ.y = _cam.y
      _camXZ.z = _cam.z
      const ox = root.position.x
      const oz = root.position.z

      let padsLeft = 0
      for (let i = 0; i < T.count; i++) {
        const run = sim.tentacles[i]
        const alive = state.hp[i] > 0
        if (alive) padsLeft++
        const pad = parts.get(KRAKEN.weakPoints[i].id)

        if (run.mode === 'waiting') {
          run.wait -= dt
          if (run.wait <= 0) {
            if (!alive) run.mode = 'gone'
            else if (surface(run, 'tentacle')) splash(run.spot.x, run.spot.z, RISE_TRAUMA, false)
            else run.wait = 0.4
          }
        }
        let impact = false
        if (run.mode === 'up') {
          const prev = run.tau
          if (!advance(run, dt, alive, T.riseS)) {
            run.mode = alive ? 'waiting' : 'gone'
            run.wait = T.gapS
          } else impact = slamImpactBetween(prev, run.tau, run.sinkAt, i)
        }

        const base = i * T.segments
        if (run.mode !== 'up') {
          for (let k = 0; k < T.segments; k++) segments.setMatrixAt(base + k, ZERO)
          foamRings.setMatrixAt(i, ZERO)
          if (pad) pad.position.set(0, PARKED_Y, 0)
          continue
        }

        const f = tentacleFrame(sim.tentacle, run.tau, run.sinkAt, i)
        const chain = layChain(sim.chain, f.emerge, f.bend)
        const cy = Math.cos(f.yaw)
        const sy = Math.sin(f.yaw)
        const dx = run.spot.outX * cy - run.spot.outZ * sy
        const dz = run.spot.outX * sy + run.spot.outZ * cy
        const px = run.spot.x - ox
        const pz = run.spot.z - oz
        let foamR = 0
        for (let k = 0; k < T.segments; k++) {
          const y0 = chain.y[k]
          const y1 = chain.y[k + 1]
          if (y0 <= 0 && y1 > 0) foamR = segmentRadius(k + -y0 / (y1 - y0))
          if (Math.max(y0, y1) < HIDDEN_BELOW) {
            segments.setMatrixAt(base + k, ZERO)
            continue
          }
          const c = Math.cos(chain.theta[k])
          const s = Math.sin(chain.theta[k])
          const r = segmentRadius(k)
          const len = T.segLen * 1.06
          // Columns: x' = cosθ·d − sinθ·up (the pale side is −x'), y' = along the segment, z' = d × up.
          _m.set(
            c * dx * r, s * dx * len, -dz * r, px + dx * chain.u[k],
            -s * r, c * len, 0, y0,
            c * dz * r, s * dz * len, dx * r, pz + dz * chain.u[k],
            0, 0, 0, 1,
          )
          segments.setMatrixAt(base + k, _m)
        }
        if (pad) {
          const k = T.padSegment
          const c = Math.cos(chain.theta[k])
          const s = Math.sin(chain.theta[k])
          const along = T.segLen * 0.55
          const inset = segmentRadius(k + 0.55) * 0.92
          pad.position.set(
            px + dx * chain.u[k] + s * dx * along - c * dx * inset,
            chain.y[k] + c * along + s * inset,
            pz + dz * chain.u[k] + s * dz * along - c * dz * inset,
          )
          _m.set(c * dx, s * dx, -dz, 0, -s, c, 0, 0, c * dz, s * dz, dx, 0, 0, 0, 0, 1)
          pad.quaternion.setFromRotationMatrix(_m)
          if (alive) {
            const out = pad.position.y > 0 && f.emerge > 0.25
            pad.visible = out
            if (!out) pad.position.y = PARKED_Y
          }
        }
        if (impact) {
          const reach = chain.u[T.segments]
          splash(run.spot.x + dx * reach, run.spot.z + dz * reach, SLAM_TRAUMA, true)
        }
        const wash = run.tau < T.riseS ? (1 - run.tau / T.riseS) * 60 : 0
        foamRings.setMatrixAt(i, foamR > 0 ? _m.makeScale(foamR * 1.1 + wash, 1, foamR * 1.1 + wash).setPosition(px, 0, pz) : ZERO)
      }

      const run = sim.head
      const eye = parts.get('eye')
      const eyeAlive = state.hp[EYE_INDEX] > 0
      if (padsLeft === 0 && !sim.headStarted) {
        sim.headStarted = true
        run.wait = 0.6
      }
      if (!eyeAlive) run.sinkS = H.defeatSinkS
      if (sinceDefeat >= 0 && !sim.defeatSplashed) {
        sim.defeatSplashed = true
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2
          splash(run.spot.x + Math.cos(a) * H.rx * 0.7, run.spot.z + Math.sin(a) * H.rz * 0.7, DEFEAT_TRAUMA, k === 0)
        }
      }
      if (sim.headStarted && run.mode === 'waiting' && eyeAlive) {
        run.wait -= dt
        if (run.wait <= 0) {
          if (surface(run, 'head')) {
            root.position.set(run.spot.x, 0, run.spot.z)
            splash(run.spot.x, run.spot.z, RISE_TRAUMA, true)
          } else run.wait = 0.25
        }
      } else if (run.mode === 'up' && !advance(run, dt, eyeAlive, H.riseS)) {
        run.mode = eyeAlive ? 'waiting' : 'gone'
        run.wait = H.gapS
      }

      const hx = run.spot.x - root.position.x
      const hz = run.spot.z - root.position.z
      const pose = headFrame(sim.headPose, run.mode === 'up' ? run.tau : -1, run.sinkAt, run.sinkS)
      const yaw = Math.atan2(_cam.x - run.spot.x, _cam.z - run.spot.z)
      head.visible = run.mode === 'up'
      head.position.set(hx, pose.y, hz)
      head.rotation.y = yaw
      foamRings.setMatrixAt(HEAD_FOAM, run.mode === 'up' ? _m.makeScale(H.rx * 0.92, 1, H.rx * 0.92).setPosition(hx, 0, hz) : ZERO)
      if (eye) {
        if (eyeAlive) eye.visible = run.mode === 'up'
        if (run.mode === 'up' && pose.emerge > 0.3) {
          eye.position.set(hx + Math.sin(yaw) * H.eyeOut, pose.y + H.eyeUp, hz + Math.cos(yaw) * H.eyeOut)
          eye.rotation.set(0, yaw, 0)
        } else eye.position.set(0, PARKED_Y, 0)
        if (eyeAlive) KRAKEN_EYE_MAT.emissiveIntensity = 0.9 + 0.5 * Math.sin(run.tau * 6)
      }
      KRAKEN_PAD_MAT.emissiveIntensity = 1.3 + 0.4 * Math.sin(age * 5)

      segments.instanceMatrix.needsUpdate = true
      // Its bounds change every frame; recomputed only when something asks (the e2e box).
      segments.boundingBox = null
      foamRings.instanceMatrix.needsUpdate = true
    },
    [sim, surface, advance],
  )

  const body = (
    <>
      <instancedMesh ref={segmentsRef} args={[KRAKEN_SEGMENT_GEO, KRAKEN_SKIN_MAT, SEGMENT_COUNT]} frustumCulled={false} />
      <group ref={headRef}>
        <mesh geometry={KRAKEN_HEAD_GEO} material={KRAKEN_SKIN_MAT} />
      </group>
    </>
  )
  // After the water (renderOrder 0), which writes no depth.
  const rigging = (
    <instancedMesh ref={foamRef} args={[foamGeo, foam.material, T.count + 1]} frustumCulled={false} renderOrder={1} />
  )

  return (
    <BossBase
      {...props}
      spec={KRAKEN}
      move={move}
      body={body}
      rigging={rigging}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={EXIT_SECONDS}
      deathStyle={KRAKEN_SPLASH_DEATH_STYLE}
    />
  )
}
