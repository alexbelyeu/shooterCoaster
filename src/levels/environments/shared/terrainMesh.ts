import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { ColorRamp, ColorStop } from './types'

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
