import { useEffect, useMemo, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { gameTime } from '@/core/gameClock'
import { isCoarsePointer, useQualityProfile } from '@/canvas/useRenderBudget'
import { useGameStore } from '@/store/useGameStore'
import { createRng, hashString } from '@/utils/rng'
import type { AtmosphereConfig } from '@/levels/environments/atmosphere'
import type { WeatherKind } from '@/types/level'
import { newBoostTrack, resetBoost, stepBoost } from './particlePresets'
import { maxWeatherStreaks, WEATHER_LOOKS, weatherFog, type WeatherLook } from './weatherPulse'

/** Streaks live this deep in the view (world units): close enough to read as driven past the rider, never on the lens. */
const DEPTH = { near: 6, far: 170 } as const

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uHalfExtent; // tan(fov / 2) × aspect, tan(fov / 2): the view's half size at depth 1
  uniform vec2 uDir;
  uniform vec4 uMotion; // speed, length, width, gust
  attribute vec4 aSeed;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    float depth = mix(${DEPTH.near.toFixed(1)}, ${DEPTH.far.toFixed(1)}, aSeed.z * aSeed.z);
    float speed = uMotion.x * (1.0 + uMotion.w * (aSeed.w - 0.5) * 2.0);
    // Across the view in screen units (-1.2..1.2 wraps), so a near streak sweeps past faster than a far one
    vec2 travel = uDir * speed * uTime / (depth * uHalfExtent);
    vec2 screen = mod(aSeed.xy * 2.4 + travel + 1.2, 2.4) - 1.2;
    vec3 centre = vec3(screen * uHalfExtent * depth, -depth);
    vec2 side = vec2(-uDir.y, uDir.x);
    vec3 corner = centre + vec3(uDir * position.x * uMotion.y + side * position.y * uMotion.z, 0.0);
    gl_Position = projectionMatrix * vec4(corner, 1.0);
    vUv = position.xy + 0.5;
    vec2 edge = smoothstep(1.2, 1.0, abs(screen));
    vAlpha = edge.x * edge.y * smoothstep(${DEPTH.near.toFixed(1)}, ${(DEPTH.near * 2.5).toFixed(1)}, depth);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    float along = vUv.x * (1.0 - smoothstep(0.85, 1.0, vUv.x));
    float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
    gl_FragColor = vec4(uColor, uOpacity * vAlpha * along * across);
  }
`

function createStreaks(count: number): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  // Fixed seeds: the same streaks every run, so a screenshot of the pulse is the same on any runner
  const rng = createRng(hashString('weather'))
  const seeds = new Float32Array(count * 4)
  for (let i = 0; i < seeds.length; i++) seeds[i] = rng()
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4))
  geometry.instanceCount = 0
  return geometry
}

function createMaterial(look: WeatherLook): THREE.ShaderMaterial {
  const [dx, dy] = look.dir
  const len = Math.hypot(dx, dy)
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uHalfExtent: { value: new THREE.Vector2(1, 1) },
      uDir: { value: new THREE.Vector2(dx / len, dy / len) },
      uMotion: { value: new THREE.Vector4(look.speed, look.length, look.width, look.gust) },
      uColor: { value: new THREE.Color(look.color) },
      uOpacity: { value: look.opacity },
    },
    transparent: true,
    depthWrite: false,
  })
}

/**
 * A level's weather pulse (#798) from its wave's `weather:start`, on game time, its envelope a particle boost's
 * (`stepBoost`). One draw whose streaks move in the vertex shader; always in the scene (0 instances draws nothing) so
 * `ShaderWarmup` compiles it.
 *
 * The fog has other writers that don't compose with this one: `DarkSections` (every frame) and the volcanic eruption.
 * It holds because no level has weather with either; a level that wants both needs one owner for the fog first.
 */
export default function Weather({ kind, atmosphere, fogRef }: { kind: WeatherKind; atmosphere: AtmosphereConfig; fogRef: RefObject<THREE.Fog | null> }) {
  const look = WEATHER_LOOKS[kind]
  const max = maxWeatherStreaks(look, useQualityProfile().particleScale, isCoarsePointer)
  const geometry = useMemo(() => createStreaks(max), [max])
  const material = useMemo(() => createMaterial(look), [look])
  const [pulse] = useState(() => ({ track: newBoostTrack(), envelope: 0, fog: { near: 0, far: 0 } }))
  const runId = useGameStore((s) => s.runId)

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const onWeather = (which: unknown) => {
      if (which === kind) pulse.track.pending = true
    }
    eventBus.on('weather:start', onWeather)
    return () => {
      eventBus.off('weather:start', onWeather)
    }
  }, [kind, pulse])

  // A restart's pulse waits for its own wave, and the last run's fog is the biome's again
  useEffect(() => {
    resetBoost(pulse.track)
    pulse.envelope = 0
    const fog = fogRef.current
    if (fog) {
      fog.near = atmosphere.fogNear
      fog.far = atmosphere.fogFar
    }
    const testApi = window.__SC_TEST__
    if (testApi) {
      const base = { near: atmosphere.fogNear, far: atmosphere.fogFar }
      testApi.weather = { kind, envelope: 0, streaks: 0, fogNear: base.near, fogFar: base.far, baseFogNear: base.near, baseFogFar: base.far }
    }
    return () => {
      const testApi = window.__SC_TEST__
      if (testApi) testApi.weather = null
    }
  }, [runId, pulse, fogRef, atmosphere, kind])

  useFrame(({ camera }) => {
    const t = gameTime()
    const was = pulse.envelope
    const envelope = stepBoost(pulse.track, look.pulse, t, was)
    pulse.envelope = envelope
    geometry.instanceCount = Math.round(max * envelope)
    const fog = fogRef.current
    if (fog && (envelope > 0 || was > 0)) {
      weatherFog(atmosphere, look, envelope, pulse.fog)
      fog.near = pulse.fog.near
      fog.far = pulse.fog.far
    }
    const u = material.uniforms
    u.uTime.value = t
    const perspective = camera as THREE.PerspectiveCamera
    const halfY = Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2)
    u.uHalfExtent.value.set(halfY * perspective.aspect, halfY)
    const report = window.__SC_TEST__?.weather
    if (report) {
      report.envelope = envelope
      report.streaks = geometry.instanceCount
      report.fogNear = fog?.near ?? 0
      report.fogFar = fog?.far ?? 0
    }
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />
}
