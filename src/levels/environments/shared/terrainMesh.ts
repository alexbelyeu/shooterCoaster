import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { ColorRamp, ColorStop, TerrainGlow } from './types'

export function sampleColorRamp(stops: ColorStop[], t: number, tmp: THREE.Color): void {
  const clamped = Math.max(0, Math.min(1, t))
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped <= stops[i + 1].height) {
      const range = stops[i + 1].height - stops[i].height
      const localT = range > 0 ? (clamped - stops[i].height) / range : 0
      tmp.copy(stops[i].color).lerp(stops[i + 1].color, localT)
      return
    }
  }
  tmp.copy(stops[stops.length - 1].color)
}

/**
 * Creates a noise-based terrain mesh with vertex coloring.
 * 128x128 segments for chunky low-poly flat-shading aesthetic.
 */
export function createNoiseTerrain(
  ramp: ColorRamp,
  heightFn: HeightFunction,
  size: number,
  segments: number,
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position

  // Get amplitude range for normalizing colors
  // We sample a few heights to estimate max
  let maxH = 1
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = heightFn(x, z)
    pos.setY(i, y)
    maxH = Math.max(maxH, Math.abs(y))
  }

  // Compute vertex normals for slope detection
  geo.computeVertexNormals()
  const normals = geo.attributes.normal

  // Create vertex colors
  const colors = new Float32Array(pos.count * 3)
  const tmp = new THREE.Color()
  const upVec = new THREE.Vector3(0, 1, 0)
  const normalVec = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    // Normalize height to [0, 1] for color ramp
    const normalizedH = Math.max(0, Math.min(1, Math.abs(y) / maxH))

    // Get slope from vertex normal (dot with up)
    normalVec.set(
      normals.getX(i),
      normals.getY(i),
      normals.getZ(i),
    )
    const slopeDot = normalVec.dot(upVec) // 1 = flat, 0 = vertical
    const slopeFactor = 1 - Math.max(0, Math.min(1, (1 - slopeDot) * 3)) // steep = 0

    // Sample color ramp
    sampleColorRamp(ramp.stops, normalizedH, tmp)

    // Blend toward cliff color on steep slopes
    if (slopeFactor < 1) {
      tmp.lerp(ramp.cliffColor, 1 - slopeFactor)
    }

    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  return geo
}

/** Bakes `glow.sample` into the `glow` vertex attribute that createTerrainMaterial reads. */
export function addTerrainGlow(geo: THREE.BufferGeometry, glow: TerrainGlow): void {
  const pos = geo.attributes.position
  const amounts = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) amounts[i] = glow.sample(pos.getX(i), pos.getZ(i))
  geo.setAttribute('glow', new THREE.BufferAttribute(amounts, 1))
}

/**
 * Flat-shaded vertex-coloured terrain (also the volcano's rock); with `glow`, adds
 * `glow.color * glow.intensity` scaled by the `glow` vertex attribute as emissive. Caller disposes.
 */
export function createTerrainMaterial(glow?: Pick<TerrainGlow, 'color' | 'intensity'>): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true })
  if (!glow) return material

  const glowColor = new THREE.Color(glow.color).multiplyScalar(glow.intensity)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowColor = { value: glowColor }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowColor;\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * vGlow;')
  }
  material.customProgramCacheKey = () => 'terrain-glow'
  return material
}
