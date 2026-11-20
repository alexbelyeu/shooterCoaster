import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { isFeedbackHeld } from '@/combat/hitFeedback'
import { useGameStore } from '@/store/useGameStore'
import { DARKNESS, darkSectionDepth } from '@/track/darkSection.hot'
import { rideProgress } from '@/track/rideProgress.hot'
import type { DarkSectionSpec } from '@/types/level'
import type { AtmosphereConfig } from '../atmosphere'
import type { FogModifiers } from './sceneFog'

/** How a dark section dims: the hemisphere and sun keep `light` of their intensity, the fog closes to `fogFar` of its far in `fogColor`. */
const LOOK = {
  light: 0.12,
  envIntensity: 0.15,
  fogFar: 0.35,
  fogColor: 0x0b0814,
  /** The muzzle flash's light at its peak, and how long it lasts (ms) after each shot. */
  flashIntensity: 2.2,
  flashMs: 110,
} as const

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * A level's dark sections (#752, `TrackParams.darkSections`): while the rider is in one, the hemisphere, sun, sky
 * reflections and fog dim and close in (`darkSectionDepth`, eased at each end) and `DARKNESS` tells the level's own
 * shaders; each shot's muzzle flash lights what is near the rider. The fog's far is a modifier (`fog.dark`) that
 * `BiomeEnvironment` combines with the others'; its colour, which nothing else changes, is set here. The flash's point light is always in the scene,
 * at 0 outside the dark, so no material's program changes on the first shot (`ShaderWarmup` compiles them with it).
 */
export default function DarkSections({
  sections,
  atmosphere,
  hemiRef,
  sunRef,
  fogRef,
  fog,
}: {
  sections: readonly DarkSectionSpec[]
  atmosphere: AtmosphereConfig
  hemiRef: RefObject<THREE.HemisphereLight | null>
  sunRef: RefObject<THREE.DirectionalLight | null>
  fogRef: RefObject<THREE.Fog | null>
  fog: FogModifiers
}) {
  const scene = useThree((s) => s.scene)
  const flashRef = useRef<THREE.PointLight>(null)
  const flashLeft = useRef(0)
  const colours = useMemo(() => ({ fog: new THREE.Color(atmosphere.sky.horizon), dark: new THREE.Color(LOOK.fogColor) }), [atmosphere])
  const reach = Math.max(...sections.map((s) => s.flashReach))

  useEffect(() => {
    const onFire = () => {
      flashLeft.current = LOOK.flashMs
    }
    eventBus.on('weapon:fire', onFire)
    const testApi = window.__SC_TEST__
    if (testApi) testApi.darkSection.spans = sections.map((s) => ({ from: s.from, to: s.to }))
    return () => {
      eventBus.off('weapon:fire', onFire)
      DARKNESS.value = 0
      fog.dark.far = 1
      if (testApi) testApi.darkSection = { spans: [], depth: 0, flash: 0 }
    }
  }, [sections, fog])

  useFrame(({ camera }, delta) => {
    const depth = darkSectionDepth(sections, rideProgress())
    DARKNESS.value = depth
    const light = lerp(1, LOOK.light, depth)
    if (hemiRef.current) hemiRef.current.intensity = atmosphere.hemiIntensity * light
    if (sunRef.current) sunRef.current.intensity = atmosphere.sunLightIntensity * light
    // The baked sky lands on the frame after the mount (`SkyEnvironment`); before it there is nothing to dim.
    if (scene.environment) scene.environmentIntensity = lerp(atmosphere.envIntensity, LOOK.envIntensity, depth)
    fogRef.current?.color.lerpColors(colours.fog, colours.dark, depth)
    fog.dark.far = lerp(1, LOOK.fogFar, depth)
    const flash = flashRef.current
    if (!flash) return
    flash.position.copy(camera.position)
    flash.intensity = LOOK.flashIntensity * depth * Math.min(Math.max(flashLeft.current, 0) / LOOK.flashMs, 1)
    const testApi = window.__SC_TEST__
    if (testApi) {
      testApi.darkSection.depth = depth
      testApi.darkSection.flash = flash.intensity
    }
    if (flashLeft.current > 0 && !isFeedbackHeld()) flashLeft.current -= delta * useGameStore.getState().timeScale * 1000
  })

  return <pointLight ref={flashRef} color="#fff1d6" intensity={0} distance={reach} decay={0} />
}
