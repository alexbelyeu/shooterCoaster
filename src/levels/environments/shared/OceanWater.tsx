import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AtmosphereConfig } from '../atmosphere'
import { WATER_WAVE_GLSL } from './waterWaves'

// ── Shader-based ocean water ──────────────────────────────────────────
const waterVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  ${WATER_WAVE_GLSL}

  void main() {
    vec3 pos = position;
    // The plane is rotated -PI/2 about X: local (x, y, z) is world (x, z, -y).
    pos.z += waterWave(vec2(pos.x, -pos.y), uTime);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const waterFragmentShader = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uCameraPosition;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uTime;

  varying vec3 vWorldPosition;

  // Slope of one travelling ripple: direction * d/dphase(a * sin(phase)).
  vec2 ripple(vec2 p, vec2 dir, float k, float w, float a) {
    return dir * (cos(dot(dir, p) * k + uTime * w) * k * a);
  }

  void main() {
    vec3 toCamera = uCameraPosition - vWorldPosition;
    float dist = length(toCamera);
    vec3 viewDir = toCamera / dist;

    // Fresnel against the flat surface: transparent looking down, more opaque at grazing angles
    float fresnel = pow(1.0 - max(viewDir.y, 0.0), 2.0);
    vec3 color = mix(uShallowColor, uDeepColor, fresnel);

    // Subtle shimmer
    float shimmer = sin(vWorldPosition.x * 0.05 + uTime * 2.0) *
                    cos(vWorldPosition.z * 0.04 + uTime * 1.5) * 0.05;
    color += shimmer;

    // Sun glint: ripple normals (faded out with distance, where they would alias)
    // catching the sun's mirror reflection.
    vec2 p = vWorldPosition.xz;
    vec2 slope = ripple(p, vec2(0.8, 0.6), 0.09, 1.7, 0.9)
               + ripple(p, vec2(-0.5, 0.866), 0.13, 2.3, 0.6)
               + ripple(p, vec2(0.96, -0.28), 0.21, 3.1, 0.35)
               + ripple(p, vec2(-0.894, -0.447), 0.33, 3.9, 0.2);
    slope *= 1.0 - smoothstep(500.0, 2500.0, dist) * 0.8;
    vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
    float nDotH = max(dot(n, normalize(uSunDirection + viewDir)), 0.0);
    float glint = pow(nDotH, 900.0) * 2.0 + pow(nDotH, 60.0) * 0.1;
    color += uSunColor * glint;

    float alpha = mix(0.12, 0.5, fresnel) + min(glint, 1.0) * 0.35;

    gl_FragColor = vec4(color, min(alpha, 1.0));
  }
`

/** Animated transparent water plane at y = 0 (levels with `environment.hasWater`). */
export default function OceanWater({ atmosphere }: { atmosphere: AtmosphereConfig }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(6000, 6000, 80, 80), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uDeepColor: { value: new THREE.Color(0x003344) },
          uShallowColor: { value: new THREE.Color(0x00917a) },
          uCameraPosition: { value: new THREE.Vector3() },
          uSunDirection: { value: new THREE.Vector3(...atmosphere.sunDirection).normalize() },
          uSunColor: { value: new THREE.Color(atmosphere.sunLightColor) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [atmosphere],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(({ clock, camera }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uCameraPosition.value.copy(camera.position)
  })

  return <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
}
