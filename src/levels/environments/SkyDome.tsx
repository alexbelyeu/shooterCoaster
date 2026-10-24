import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AtmosphereConfig } from './atmosphere'

/**
 * Procedural per-biome sky dome, centred on the camera and drawn first with depth off
 * so the scene paints over it. The scene fog colour is the same `sky.horizon`, so
 * fogged terrain blends into the bottom of the dome without a seam.
 */

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // Dome is unrotated and centred on the camera, so the local position is the view ray
    vDir = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform float uHorizonFalloff;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunSize;
  uniform float uSunGlow;
  uniform float uCloudiness;
  uniform vec3 uCloudColor;
  uniform float uCloudStretch;
  uniform vec2 uCloudOffset;

  varying vec3 vDir;

  float hash(vec2 p) {
    // Sin-free hash (stable on mobile mediump)
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(17.1, 9.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;

    // Base gradient
    vec3 col;
    if (y >= 0.0) {
      float t = pow(clamp(y, 0.0, 1.0), uHorizonFalloff);
      col = mix(uHorizon, uZenith, t);
    } else {
      // Stay on the horizon colour just below the line (fogged terrain edge), then fade to ground
      col = mix(uHorizon, uGround, smoothstep(0.0, 0.35, -y));
    }

    // Clouds / ash: fbm on a plane at infinity, faded out near the horizon so the
    // fog line stays seamless.
    if (uCloudiness > 0.0 && y > 0.0) {
      vec2 p = dir.xz / (y + 0.12);
      p.x /= uCloudStretch;
      p = p * 1.6 + uCloudOffset;
      float n = fbm(p);
      float threshold = 1.0 - uCloudiness;
      float c = smoothstep(threshold * 0.75, threshold * 0.75 + 0.35, n);
      c *= smoothstep(0.02, 0.25, y);
      col = mix(col, uCloudColor, c * 0.85);
    }

    // Sun disc + glow (additive, may exceed 1.0 so bloom picks up the disc)
    if (uSunSize > 0.0 || uSunGlow > 0.0) {
      float d = max(dot(dir, normalize(uSunDir)), 0.0);
      float ang = acos(clamp(d, -1.0, 1.0));
      // smoothstep is undefined when edge0 >= edge1, so skip the disc when it has no size (env bake)
      float disc = uSunSize > 0.0 ? 1.0 - smoothstep(uSunSize * 0.85, uSunSize, ang) : 0.0;
      float glow = pow(d, 64.0) * 0.6 + pow(d, 8.0) * 0.25;
      col += uSunColor * (disc * 1.5 + glow * uSunGlow);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** CoasterCamera's far plane is 11000; keep the dome just inside it. */
const DOME_RADIUS = 11000 * 0.9

export function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uHorizonFalloff: { value: 0.5 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uSunSize: { value: 0 },
      uSunGlow: { value: 0 },
      uCloudiness: { value: 0 },
      uCloudColor: { value: new THREE.Color() },
      uCloudStretch: { value: 1 },
      uCloudOffset: { value: new THREE.Vector2() },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  })
}

/** `sunDisc: false` keeps the glow but drops the disc, whose >1 values would sparkle in a baked env map. */
export function setSkyUniforms(
  material: THREE.ShaderMaterial,
  { sky, sunDirection }: AtmosphereConfig,
  sunDisc = true,
) {
  const u = material.uniforms
  ;(u.uZenith.value as THREE.Color).setHex(sky.zenith)
  ;(u.uHorizon.value as THREE.Color).setHex(sky.horizon)
  ;(u.uGround.value as THREE.Color).setHex(sky.ground)
  u.uHorizonFalloff.value = sky.horizonFalloff
  ;(u.uSunDir.value as THREE.Vector3).set(sunDirection[0], sunDirection[1], sunDirection[2]).normalize()
  ;(u.uSunColor.value as THREE.Color).setHex(sky.sunColor)
  u.uSunSize.value = sunDisc ? sky.sunSize : 0
  u.uSunGlow.value = sky.sunGlow
  u.uCloudiness.value = sky.cloudiness
  ;(u.uCloudColor.value as THREE.Color).setHex(sky.cloudColor)
  u.uCloudStretch.value = sky.cloudStretch
}

export default function SkyDome({ atmosphere }: { atmosphere: AtmosphereConfig }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(DOME_RADIUS, 32, 16), [])
  const material = useMemo(createSkyMaterial, [])

  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geometry, material)
    m.renderOrder = -1000 // drawn before everything else
    m.frustumCulled = false
    m.name = 'SkyDome'
    return m
  }, [geometry, material])

  useEffect(() => setSkyUniforms(material, atmosphere), [material, atmosphere])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  const speed = atmosphere.sky.cloudSpeed * 0.01
  useFrame(({ camera, clock }) => {
    // Keep the dome centred on the camera so it never clips the far plane
    mesh.position.copy(camera.position)
    const t = clock.elapsedTime * speed
    ;(material.uniforms.uCloudOffset.value as THREE.Vector2).set(t, t * 0.35)
  })

  return <primitive object={mesh} />
}
