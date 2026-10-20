import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Shader-based ocean water ──────────────────────────────────────────
const waterVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 pos = position;
    // Gentle wave displacement
    float wave1 = sin(pos.x * 0.008 + uTime * 0.8) * 3.0;
    float wave2 = sin(pos.y * 0.012 + uTime * 0.6) * 2.0;
    float wave3 = cos((pos.x + pos.y) * 0.005 + uTime * 1.1) * 1.5;
    pos.z += wave1 + wave2 + wave3;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const waterFragmentShader = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uCameraPosition;
  uniform float uTime;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    // Fresnel: transparent looking down, more opaque at grazing angles
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    float fresnel = 1.0 - max(dot(viewDir, vWorldNormal), 0.0);
    fresnel = pow(fresnel, 2.0);

    // Mix deep/shallow color based on fresnel
    vec3 color = mix(uShallowColor, uDeepColor, fresnel);

    // Subtle shimmer
    float shimmer = sin(vWorldPosition.x * 0.05 + uTime * 2.0) *
                    cos(vWorldPosition.z * 0.04 + uTime * 1.5) * 0.05;
    color += shimmer;

    // Alpha: transparent when looking down, more opaque at edges
    float alpha = mix(0.12, 0.5, fresnel);

    gl_FragColor = vec4(color, alpha);
  }
`

/** Animated transparent water plane at y = 0 (levels with `environment.hasWater`). */
export default function OceanWater() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x003344) },
    uShallowColor: { value: new THREE.Color(0x007766) },
    uCameraPosition: { value: new THREE.Vector3() },
  }), [])

  useFrame(({ clock, camera }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime
      matRef.current.uniforms.uCameraPosition.value.copy(camera.position)
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[6000, 6000, 128, 128]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
