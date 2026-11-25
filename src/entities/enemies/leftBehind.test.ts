import { describe, expect, it } from 'vitest'
import { LEFT_BEHIND, backInFront, flyBackStep, leftBehind } from './leftBehind.hot'

const eye = { x: 0, y: 10, z: 0 }
const forward = { x: 0, y: 0, z: -1 }
const far = LEFT_BEHIND.distance + 100

describe('leftBehind', () => {
  it('is a flier behind the look and past the distance', () => {
    expect(leftBehind({ x: 0, y: 10, z: far }, eye, forward)).toBe(true)
  })

  it('is never one ahead of the look, however far', () => {
    expect(leftBehind({ x: 0, y: 10, z: -10 * far }, eye, forward)).toBe(false)
  })

  it('is never one just behind: it is still passing overhead', () => {
    expect(leftBehind({ x: 0, y: 10, z: LEFT_BEHIND.distance - 50 }, eye, forward)).toBe(false)
  })

  it('counts square to the look as not behind', () => {
    expect(leftBehind({ x: far, y: 10, z: 0 }, eye, forward)).toBe(false)
  })
})

describe('flyBackStep', () => {
  it('flies a left-behind bird round to its spot in front of the rider', () => {
    const p = { x: 300, y: 10, z: far }
    let steps = 0
    while (leftBehind(p, eye, forward) && steps < 1000) {
      flyBackStep(p, eye, forward, LEFT_BEHIND.speed)
      steps++
    }
    expect(steps).toBeLessThan(1000)
    for (let i = 0; i < 2000; i++) flyBackStep(p, eye, forward, LEFT_BEHIND.speed)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(eye.y + LEFT_BEHIND.up)
    expect(p.z).toBeCloseTo(-LEFT_BEHIND.ahead)
  })

  it('heads the way it moves', () => {
    const p = { x: 0, y: eye.y + LEFT_BEHIND.up, z: far }
    expect(flyBackStep(p, eye, forward, 1)).toBeCloseTo(-Math.PI / 2)
    expect(p.z).toBeCloseTo(far - 1)
  })
})

describe('backInFront', () => {
  it('is a bird out ahead in the middle of the look', () => {
    expect(backInFront({ x: 0, y: 10, z: -LEFT_BEHIND.ahead }, eye, forward)).toBe(true)
  })

  it('is not one only off to the side of the look, or still close by', () => {
    expect(backInFront({ x: LEFT_BEHIND.ahead, y: 10, z: -50 }, eye, forward)).toBe(false)
    expect(backInFront({ x: 0, y: 10, z: -LEFT_BEHIND.ahead / 4 }, eye, forward)).toBe(false)
  })
})
