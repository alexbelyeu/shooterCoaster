import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { isFeedbackHeld } from '@/combat/hitFeedback'
import { useGameStore } from '@/store/useGameStore'
import { DARKNESS, darkSectionAt, darkSectionDepth } from '@/track/darkSection.hot'
import { rideProgress } from '@/track/rideProgress.hot'
import type { DarkLook, DarkSectionSpec } from '@/types/level'
import type { AtmosphereConfig } from '../atmosphere'
import type { FogModifiers } from './sceneFog'

interface Look {
  light: number
  envIntensity: number
  fogFar: number
  fogColor: number
  /** The colour the hemisphere's sky and ground turn to in the dark (none: they keep theirs). */
  glow?: number
}

/**
 * How each look (`DarkSectionSpec.look`) dims: the hemisphere and sun keep `light` of their intensity, the fog closes to
 * `fogFar` of its far in `fogColor`. The ice cave (#866) keeps more light, turned blue, so its white snowmen still read.
 */
const LOOKS: Record<DarkLook, Look> = {
  blacklight: { light: 0.12, envIntensity: 0.15, fogFar: 0.35, fogColor: 0x0b0814 },
  ice: { light: 0.45, envIntensity: 0.25, fogFar: 0.5, fogColor: 0x0a2240, glow: 0x5fb4ff },
}

/** The muzzle flash's light at its peak, and how long it lasts (ms) after each shot. */
const FLASH = { intensity: 2.2, ms: 110 } as const
/**
 * The flash is a spot from the rider's eye, its axis `pitch` radians below the view's forward and its cone `angle` wide
 * either side, so its top edge sits at the view's horizon: it lights the rats and the floor ahead and never a low
 * ceiling, which would strobe at the blaster's rate (#929, the Training Area's cave).
 */
const FLASH_CONE = { pitch: 0.6, angle: 0.6, penumbra: 0.5 } as const
/** The spot's aim in the camera's frame: ahead (-z) and down. */
const FLASH_AIM = new THREE.Vector3(0, -Math.sin(FLASH_CONE.pitch), -Math.cos(FLASH_CONE.pitch))

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * A level's dark sections (#752, `TrackParams.darkSections`): while the rider is in one, the hemisphere, sun, sky
 * reflections and fog dim and close in (`darkSectionDepth`, eased at each end) and `DARKNESS` tells the level's own
 * shaders; each shot's muzzle flash lights what is near the rider and below the view's horizon (`FLASH_CONE`). The fog's far is a modifier (`fog.dark`) that
 * `BiomeEnvironment` combines with the others'; its colour, which nothing else changes, is set here. The flash's spot light is always in the scene,
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
  const flashRef = useRef<THREE.SpotLight>(null)
  const flashAim = useMemo(() => new THREE.Object3D(), [])
  const flashLeft = useRef(0)
  const colours = useMemo(
    () => ({
      fog: new THREE.Color(atmosphere.sky.horizon),
      sky: new THREE.Color(atmosphere.hemiSkyColor),
      ground: new THREE.Color(atmosphere.hemiGroundColor),
      dark: Object.fromEntries(
        Object.entries(LOOKS).map(([k, l]) => [k, { fog: new THREE.Color(l.fogColor), glow: l.glow === undefined ? null : new THREE.Color(l.glow) }]),
      ) as Record<DarkLook, { fog: THREE.Color; glow: THREE.Color | null }>,
    }),
    [atmosphere],
  )
  const reach = Math.max(...sections.map((s) => s.flashReach))

  useEffect(() => {
    const onFire = () => {
      flashLeft.current = FLASH.ms
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
    const t = rideProgress()
    const depth = darkSectionDepth(sections, t)
    const kind = darkSectionAt(sections, t)?.look ?? 'blacklight'
    const look = LOOKS[kind]
    const dark = colours.dark[kind]
    DARKNESS.value = depth
    const light = lerp(1, look.light, depth)
    const hemi = hemiRef.current
    if (hemi) {
      hemi.intensity = atmosphere.hemiIntensity * light
      hemi.color.lerpColors(colours.sky, dark.glow ?? colours.sky, depth)
      hemi.groundColor.lerpColors(colours.ground, dark.glow ?? colours.ground, depth)
    }
    if (sunRef.current) sunRef.current.intensity = atmosphere.sunLightIntensity * light
    // The baked sky lands on the frame after the mount (`SkyEnvironment`); before it there is nothing to dim.
    if (scene.environment) scene.environmentIntensity = lerp(atmosphere.envIntensity, look.envIntensity, depth)
    fogRef.current?.color.lerpColors(colours.fog, dark.fog, depth)
    fog.dark.far = lerp(1, look.fogFar, depth)
    const flash = flashRef.current
    if (!flash) return
    flash.position.copy(camera.position)
    flashAim.position.copy(FLASH_AIM).applyQuaternion(camera.quaternion).add(camera.position)
    flash.intensity = FLASH.intensity * depth * Math.min(Math.max(flashLeft.current, 0) / FLASH.ms, 1)
    const testApi = window.__SC_TEST__
    if (testApi) {
      testApi.darkSection.depth = depth
      testApi.darkSection.flash = flash.intensity
    }
    if (flashLeft.current > 0 && !isFeedbackHeld()) flashLeft.current -= delta * useGameStore.getState().timeScale * 1000
  })

  return (
    <>
      <primitive object={flashAim} />
      <spotLight
        ref={flashRef}
        target={flashAim}
        color="#fff1d6"
        intensity={0}
        distance={reach}
        decay={0}
        angle={FLASH_CONE.angle}
        penumbra={FLASH_CONE.penumbra}
      />
    </>
  )
}
