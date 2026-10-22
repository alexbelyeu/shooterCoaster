import * as THREE from 'three'
import { WATER_WAVE_GLSL } from '../../shared/waterWaves'

/** `uTime` must be advanced with `clock.elapsedTime`, the water's clock, so foam stays on the waves. */
export interface AnimatedMaterial<T extends THREE.Material> {
  material: T
  uTime: { value: number }
}

/** Inner radius 1, so the instance scale is the inner radius in world units. */
export const FOAM_OUTER = 1.8

export function createFoamRingGeometry(): THREE.BufferGeometry {
  const geo = new THREE.RingGeometry(1, FOAM_OUTER, 32, 1)
  geo.rotateX(-Math.PI / 2)
  return geo
}

const foamVertex = /* glsl */ `
  uniform float uTime;
  uniform float uFadeNear;
  uniform float uFadeFar;
  varying float vRing;
  varying float vAngle;
  varying float vSeed;
  varying float vFade;
  ${WATER_WAVE_GLSL}

  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    world.y = waterWave(world.xz, uTime) + 0.8;
    vRing = (length(position.xz) - 1.0) / ${(FOAM_OUTER - 1).toFixed(2)};
    vAngle = atan(position.z, position.x);
    vSeed = fract(instanceMatrix[3].x * 0.0137 + instanceMatrix[3].z * 0.0071);
    vec4 mv = viewMatrix * world;
    vFade = 1.0 - smoothstep(uFadeNear, uFadeFar, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const foamFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying float vRing;
  varying float vAngle;
  varying float vSeed;
  varying float vFade;

  void main() {
    float seed = vSeed * 6.2832;
    float body = pow(1.0 - vRing, 1.8);
    float lace = 0.6 + 0.4 * sin(vAngle * 9.0 + uTime * 0.7 + seed) *
                             sin(vAngle * 5.0 - uTime * 0.45 + seed * 2.0 + vRing * 6.0);
    float wave = fract(uTime * 0.22 + vSeed);
    float wash = (1.0 - smoothstep(0.0, 0.1, abs(vRing - wave))) * (1.0 - wave) * 0.7;
    float a = clamp(body * lace + wash, 0.0, 1.0) * vFade;
    gl_FragColor = vec4(uColor, a);
  }
`

export function createFoamMaterial(fadeNear: number, fadeFar: number): AnimatedMaterial<THREE.ShaderMaterial> {
  const uTime = { value: 0 }
  const material = new THREE.ShaderMaterial({
    vertexShader: foamVertex,
    fragmentShader: foamFragment,
    uniforms: {
      uTime,
      uColor: { value: new THREE.Color(0xeafcff) },
      uFadeNear: { value: fadeNear },
      uFadeFar: { value: fadeFar },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return { material, uTime }
}

/** Glows in its own vertex × instance colour so it stays saturated under the teal water. */
export function createCoralMaterial(glow: number): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    flatShading: true,
    specular: 0x444444,
    shininess: 30,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * ${glow.toFixed(2)};`,
    )
  }
  material.customProgramCacheKey = () => `sc-coral-glow-${glow}`
  return material
}

export function createKelpMaterial(): AnimatedMaterial<THREE.MeshPhongMaterial> {
  const uTime = { value: 0 }
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    emissive: 0x2c3f0c,
    specular: 0x223311,
    shininess: 20,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  {
    float ph = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.03;
    float bend = aSway * aSway * 4.0;
    transformed.x += sin(uTime * 1.1 + ph) * bend;
    transformed.z += cos(uTime * 0.8 + ph * 1.3) * bend * 0.6;
  }`,
      )
  }
  material.customProgramCacheKey = () => 'sc-kelp-sway'
  return { material, uTime }
}

export function createGullMaterial(): AnimatedMaterial<THREE.MeshBasicMaterial> {
  const uTime = { value: 0 }
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aFlap;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  {
    float id = float(gl_InstanceID);
    float burst = 0.35 + 0.65 * smoothstep(-0.2, 0.6, sin(uTime * 0.6 + id * 2.3));
    transformed.y += sin(uTime * 7.0 + id * 1.7) * aFlap * 7.0 * burst;
  }`,
      )
  }
  material.customProgramCacheKey = () => 'sc-gull-flap'
  return { material, uTime }
}
