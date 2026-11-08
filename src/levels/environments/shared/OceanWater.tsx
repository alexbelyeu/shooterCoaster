import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AtmosphereConfig } from '../atmosphere'
import { TERRAIN_MESH_SEGMENTS, type HeightFunction } from '@/utils/terrainNoise'
import { WATER_WAVE_GLSL } from './waterWaves'
import { valueNoiseGlsl } from './noiseGlsl'
import { SEABED_MAX_Y, SEABED_MIN_Y, seabedHeightTexels, waterGridCoords } from './waterSurface'

/** 75-unit cells over the terrain, where the swell shows, then out past the camera's far plane (11000) to the horizon. */
const WATER_GRID = waterGridCoords(3000, 80, 12000, 10)
/** The far sea keeps some of its own colour under the fog, so a darker line divides it from the sky. */
const WATER_FOG_MAX = 0.6

const vertexHead = /* glsl */ `
uniform float uTime;
varying vec3 vWaterPos;
${WATER_WAVE_GLSL}
`

// The plane is rotated -PI/2 about X: local (x, y, z) is world (x, z, -y).
const vertexDisplace = /* glsl */ `
transformed.z += waterWave(vec2(transformed.x, -transformed.y), uTime);
`

const vertexWorld = /* glsl */ `
vWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const fragmentHead = /* glsl */ `
uniform float uTime;
uniform sampler2D uSeabed;
uniform vec3 uSeabedGrid; // half size, cell size, texels per side
uniform vec3 uShallowColor;
uniform vec3 uMidColor;
uniform vec3 uDeepColor;
uniform vec3 uFoamColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vWaterPos;
${valueNoiseGlsl}

vec2 swellSlope(vec2 p, vec2 dir, float k, float w, float a) {
  return dir * (cos(dot(dir, p) * k + uTime * w) * k * a);
}

vec2 noiseSlope(vec2 q) {
  float c = vnoise(q);
  return vec2(vnoise(q + vec2(0.3, 0.0)) - c, vnoise(q + vec2(0.0, 0.3)) - c) / 0.3;
}
`

// Body colour by the depth of the seabed under this point: turquoise shallows, deep blue far out.
const fragmentColour = /* glsl */ `
vec2 waterXZ = vWaterPos.xz;
float waterDist = length(cameraPosition - vWaterPos);
vec2 seabedCell = (waterXZ + uSeabedGrid.x) / uSeabedGrid.y;
float onSeabed = step(0.0, min(seabedCell.x, seabedCell.y)) * step(max(seabedCell.x, seabedCell.y), uSeabedGrid.z - 1.0);
float seabedY = mix(${SEABED_MIN_Y.toFixed(1)}, ${SEABED_MAX_Y.toFixed(1)}, texture2D(uSeabed, (seabedCell + 0.5) / uSeabedGrid.z).r);
float waterDepth = mix(${(-SEABED_MIN_Y).toFixed(1)}, -seabedY, onSeabed);

vec3 waterColour = mix(uShallowColor, uMidColor, smoothstep(1.0, 24.0, waterDepth));
waterColour = mix(waterColour, uDeepColor, smoothstep(42.0, 60.0, waterDepth));
float farWater = smoothstep(400.0, 3000.0, waterDist);
waterColour = mix(waterColour, uDeepColor, farWater);
float waterAlpha = mix(0.35, 0.72, smoothstep(1.0, 40.0, waterDepth));
waterAlpha = mix(waterAlpha, 1.0, farWater);

// Lacy foam on the water's edge against the shore.
float shoreline = (1.0 - smoothstep(0.2, 2.2, waterDepth)) * onSeabed;
float lace = vnoise(waterXZ * 0.12 + vec2(uTime * 0.25, -uTime * 0.18));
float foam = shoreline * smoothstep(0.25, 0.65, lace);
diffuseColor.rgb = mix(waterColour, uFoamColor, foam);
diffuseColor.a = max(waterAlpha, foam);
`

// Swell ripples + two scrolling noise layers, each faded once its wavelength nears a pixel (no shimmer without MSAA).
const fragmentNormal = /* glsl */ `
vec3 waterView = (cameraPosition - vWaterPos) / waterDist;
float waterPx = length(fwidth(waterXZ));
vec2 slope = (swellSlope(waterXZ, vec2(0.8, 0.6), 0.09, 1.7, 0.9)
            + swellSlope(waterXZ, vec2(-0.5, 0.866), 0.13, 2.3, 0.6)
            + swellSlope(waterXZ, vec2(0.96, -0.28), 0.21, 3.1, 0.35)
            + swellSlope(waterXZ, vec2(-0.894, -0.447), 0.33, 3.9, 0.2))
           * (1.0 - smoothstep(6.0, 24.0, waterPx) * 0.85);
slope += noiseSlope(waterXZ * 0.05 + uTime * vec2(0.12, 0.05)) * 0.2 * (1.0 - smoothstep(2.5, 9.0, waterPx));
slope += noiseSlope(mat2(0.8, 0.6, -0.6, 0.8) * waterXZ * 0.13 - uTime * vec2(0.07, 0.17)) * 0.12
       * (1.0 - smoothstep(1.0, 3.5, waterPx));
vec3 waterNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
normal = normalize((viewMatrix * vec4(waterNormal, 0.0)).xyz);
// Schlick, water's F0: grazing angles turn to mirrored sky, steep ones show the water body.
float waterFresnel = 0.02 + 0.98 * pow(1.0 - max(dot(waterNormal, waterView), 0.0), 5.0);
diffuseColor.a = mix(diffuseColor.a, 1.0, waterFresnel);
`

const fragmentGlitter = /* glsl */ `
float sunNH = max(dot(waterNormal, normalize(uSunDir + waterView)), 0.0);
// Bright enough for bloom, not so bright the sun path out-shines a target in front of it.
float glint = pow(sunNH, 1500.0) * 3.5 + pow(sunNH, 140.0) * 0.15;
outgoingLight += uSunColor * glint;
diffuseColor.a = min(1.0, diffuseColor.a + glint);
`

const fragmentFog = /* glsl */ `
#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * ${WATER_FOG_MAX.toFixed(2)});
#endif
`

const after = (source: string, chunk: string, extra: string) => source.replace(chunk, `${chunk}\n${extra}`)

function createWaterMaterial(atmosphere: AtmosphereConfig, seabed: THREE.Texture, terrainSize: number) {
  const uTime = { value: 0 }
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime,
      uSeabed: { value: seabed },
      uSeabedGrid: { value: new THREE.Vector3(terrainSize / 2, terrainSize / TERRAIN_MESH_SEGMENTS, TERRAIN_MESH_SEGMENTS + 1) },
      uShallowColor: { value: new THREE.Color(0x1fc4b4) },
      uMidColor: { value: new THREE.Color(0x0b86a0) },
      uDeepColor: { value: new THREE.Color(0x07306c) },
      uFoamColor: { value: new THREE.Color(0xe6fbff) },
      uSunDir: { value: new THREE.Vector3(...atmosphere.sunDirection).normalize() },
      uSunColor: { value: new THREE.Color(atmosphere.sunLightColor) },
    })
    shader.vertexShader = after(shader.vertexShader, '#include <common>', vertexHead)
    shader.vertexShader = after(shader.vertexShader, '#include <begin_vertex>', vertexDisplace)
    shader.vertexShader = after(shader.vertexShader, '#include <project_vertex>', vertexWorld)
    shader.fragmentShader = after(shader.fragmentShader, '#include <common>', fragmentHead)
    shader.fragmentShader = after(shader.fragmentShader, '#include <color_fragment>', fragmentColour)
    shader.fragmentShader = after(shader.fragmentShader, '#include <normal_fragment_maps>', fragmentNormal)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <opaque_fragment>', `${fragmentGlitter}\n#include <opaque_fragment>`)
      .replace('#include <fog_fragment>', fragmentFog)
  }
  material.customProgramCacheKey = () => 'ocean-water'
  return { material, uTime }
}

/**
 * The sea at y = 0 (levels with `environment.hasWater`): one transparent Standard-material plane that reflects
 * the baked sky, coloured by the depth of the drawn seabed under it, rippled on the foam rings' clock.
 */
export default function OceanWater({
  atmosphere,
  groundFn,
  terrainSize,
}: {
  atmosphere: AtmosphereConfig
  groundFn: HeightFunction
  terrainSize: number
}) {
  const geometry = useMemo(() => {
    const cells = WATER_GRID.length - 1
    const geo = new THREE.PlaneGeometry(1, 1, cells, cells)
    const position = geo.attributes.position
    for (let iy = 0; iy <= cells; iy++) {
      for (let ix = 0; ix <= cells; ix++) position.setXY(iy * (cells + 1) + ix, WATER_GRID[ix], -WATER_GRID[iy])
    }
    geo.computeBoundingSphere()
    return geo
  }, [])
  const seabed = useMemo(() => {
    const n = TERRAIN_MESH_SEGMENTS + 1
    const texture = new THREE.DataTexture(
      seabedHeightTexels(groundFn, terrainSize, TERRAIN_MESH_SEGMENTS),
      n,
      n,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    )
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearFilter
    texture.needsUpdate = true
    return texture
  }, [groundFn, terrainSize])
  const { material, uTime } = useMemo(
    () => createWaterMaterial(atmosphere, seabed, terrainSize),
    [atmosphere, seabed, terrainSize],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => seabed.dispose(), [seabed])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime
  })

  return <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
}
