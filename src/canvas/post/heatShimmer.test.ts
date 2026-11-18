import { Matrix4, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { SHIMMER_MAX_UV, easeShimmer, shimmerAmplitude, shimmerRect } from './heatShimmer.hot'

/** A box 2 wide, 4 tall and 2 deep standing on (x, 0, z). */
function box(x: number, z: number): Float32Array {
  const out: number[] = []
  for (const y of [0, 4]) for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(x + dx, y, z + dz)
  return new Float32Array(out)
}

function viewProjection(): Float32Array {
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 500)
  camera.position.set(0, 2, 0)
  camera.lookAt(0, 2, -10)
  camera.updateMatrixWorld()
  return new Float32Array(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements)
}

describe('shimmerRect', () => {
  const vp = viewProjection()

  it('bounds a box ahead of the camera, centred on screen, smaller further off', () => {
    const near = new Float32Array(5)
    const far = new Float32Array(5)
    expect(shimmerRect(box(0, -10), vp, near)).toBe(true)
    expect(shimmerRect(box(0, -30), vp, far)).toBe(true)
    expect((near[0] + near[2]) / 2).toBeCloseTo(0.5, 5)
    expect(near[1]).toBeLessThan(0.5)
    expect(near[3]).toBeGreaterThan(0.5)
    expect(far[3] - far[1]).toBeLessThan(near[3] - near[1])
    expect(near[4]).toBeCloseTo(9, 4)
    expect(far[4]).toBeCloseTo(29, 4)
  })

  it('clips a box the camera stands beside at the camera, instead of dropping it', () => {
    const out = new Float32Array(5)
    expect(shimmerRect(box(1.2, 0), vp, out)).toBe(true)
    expect(out[4]).toBeCloseTo(0.05, 4)
    expect(out[2]).toBeGreaterThan(1)
    expect(out[0]).toBeGreaterThan(0.5)
    expect(out.every(Number.isFinite)).toBe(true)
  })

  it('gives up on a box behind the camera or off screen, leaving the last rect', () => {
    const out = new Float32Array([0.1, 0.2, 0.3, 0.4, 5])
    expect(shimmerRect(box(0, 10), vp, out)).toBe(false)
    expect(shimmerRect(box(200, -10), vp, out)).toBe(false)
    expect(Array.from(out)).toEqual(Array.from(new Float32Array([0.1, 0.2, 0.3, 0.4, 5])))
  })
})

describe('shimmerAmplitude', () => {
  it('scales with the column on screen, capped, and is 0 when off', () => {
    expect(shimmerAmplitude(0.1, 1)).toBeLessThan(shimmerAmplitude(0.3, 1))
    expect(shimmerAmplitude(5, 1)).toBe(SHIMMER_MAX_UV)
    expect(shimmerAmplitude(0.3, 0)).toBe(0)
    expect(shimmerAmplitude(0, 1)).toBe(0)
  })
})

describe('easeShimmer', () => {
  it('fades in and out within a second, clamped to 0..1', () => {
    let s = 0
    for (let i = 0; i < 60; i++) s = easeShimmer(s, true, 1 / 60)
    expect(s).toBe(1)
    for (let i = 0; i < 60; i++) s = easeShimmer(s, false, 1 / 60)
    expect(s).toBe(0)
    expect(easeShimmer(0.5, true, 0.01)).toBeGreaterThan(0.5)
  })
})
