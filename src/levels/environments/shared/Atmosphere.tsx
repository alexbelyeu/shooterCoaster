import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import SkyDome, { createSkyMaterial, setSkyUniforms } from '../SkyDome'
import type { AtmosphereConfig } from '../atmosphere'
import { markStartup } from '@/core/startupMarks'
import type { DarkSectionSpec } from '@/types/level'
import DarkSections from './DarkSections'

/**
 * Bakes the sky into scene.environment once per mount; Phong materials ignore it, so only Standard/Physical reflect.
 * On the frame after the mount, not in the mount's own long frame (#597); `ShaderWarmup` compiles after it.
 */
function SkyEnvironment({ atmosphere }: { atmosphere: AtmosphereConfig }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const prevEnv = scene.environment
    const prevIntensity = scene.environmentIntensity
    let target: THREE.WebGLRenderTarget | null = null
    const bake = requestAnimationFrame(() => {
      const start = performance.now()
      const material = createSkyMaterial()
      setSkyUniforms(material, atmosphere, false)
      // Unit dome: inside the cube camera's default 0.1–100 clip range
      const geometry = new THREE.SphereGeometry(1, 32, 16)
      const bakeScene = new THREE.Scene()
      bakeScene.add(new THREE.Mesh(geometry, material))
      const pmrem = new THREE.PMREMGenerator(gl)
      target = pmrem.fromScene(bakeScene)
      pmrem.dispose()
      geometry.dispose()
      material.dispose()
      target.texture.name = 'SkyEnvironment'
      target.texture.userData.bakeMs = performance.now() - start
      markStartup('envBaked')
      scene.environment = target.texture
      scene.environmentIntensity = atmosphere.envIntensity
    })
    return () => {
      cancelAnimationFrame(bake)
      scene.environment = prevEnv
      scene.environmentIntensity = prevIntensity
      target?.dispose()
    }
  }, [gl, scene, atmosphere])
  return null
}

/** Sky dome, its baked env map, hemisphere + sun lights and fog for one biome (see atmosphere.ts), dimmed in the track's dark sections. */
export default function Atmosphere({
  atmosphere,
  fogRef,
  darkSections,
}: {
  atmosphere: AtmosphereConfig
  fogRef: RefObject<THREE.Fog | null>
  darkSections?: readonly DarkSectionSpec[]
}) {
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const sunPosition = useMemo<[number, number, number]>(() => {
    const [x, y, z] = atmosphere.sunDirection
    const len = Math.hypot(x, y, z) || 1
    return [(x / len) * 1000, (y / len) * 1000, (z / len) * 1000]
  }, [atmosphere])

  return (
    <>
      {/* Sky + atmosphere (per-biome, see atmosphere.ts) */}
      <SkyDome atmosphere={atmosphere} />
      <SkyEnvironment atmosphere={atmosphere} />

      {/* Lighting: tinted hemisphere ambient + coloured sun */}
      <hemisphereLight
        ref={hemiRef}
        args={[atmosphere.hemiSkyColor, atmosphere.hemiGroundColor, atmosphere.hemiIntensity]}
      />
      <directionalLight
        ref={sunRef}
        position={sunPosition}
        color={atmosphere.sunLightColor}
        intensity={atmosphere.sunLightIntensity}
      />

      {/* Fog — colour is the dome's horizon colour (single source of truth) */}
      <fog
        ref={fogRef}
        attach="fog"
        args={[atmosphere.sky.horizon, atmosphere.fogNear, atmosphere.fogFar]}
      />
      {darkSections?.length ? (
        <DarkSections sections={darkSections} atmosphere={atmosphere} hemiRef={hemiRef} sunRef={sunRef} fogRef={fogRef} />
      ) : null}
    </>
  )
}
