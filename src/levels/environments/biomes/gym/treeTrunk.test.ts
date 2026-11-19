import { describe, expect, it } from 'vitest'
import { TREE_GAP, pieceToBlockout, piece, treeHeadLean, treeSolidBoxes } from './blockout'
import { EPS, outsideBox, trackDistance, vertices } from './geometryChecks'
import { RAIL_CLEARANCE } from './gymTrack'
import { buildTreeWood, treePanelSpecs } from './treeTrunk'
import { buildWallPanels } from './wallPanels'

const tree = piece('tree')
const wood = buildTreeWood(tree)
const specs = treePanelSpecs(tree)
const caves = vertices(buildWallPanels(specs.caves).positions)
const head = vertices(buildWallPanels(specs.head).positions).map(([a, y, f]): [number, number, number] => [a + specs.headAt[0], y + specs.headAt[1], f + specs.headAt[2]])

describe('the Tree (#519)', () => {
  it('keeps its wood inside its footprint, with finite positions', () => {
    expect(wood.positions.every(Number.isFinite)).toBe(true)
    expect(wood.tone).toHaveLength(wood.positions.length / 9)
    // The roots sink into the pit floor.
    expect(outsideBox(tree, vertices(wood.positions), 2)).toBe(0)
  })

  it('keeps its headwall and caves inside its footprint', () => {
    expect(outsideBox(tree, caves)).toBe(0)
    expect(outsideBox(tree, head)).toBe(0)
    expect(Math.max(...head.map(([, , f]) => f))).toBeLessThanOrEqual(tree.caveDepth + treeHeadLean(tree) + EPS)
  })

  it('keeps its wood, caves and headwall inside the solid boxes the ride is held off (#613)', () => {
    const boxes = treeSolidBoxes(tree)
    const inSome = ([a, y, f]: [number, number, number]) =>
      boxes.some((b) => a >= b.minA - EPS && a <= b.maxA + EPS && f >= b.minF - EPS && f <= b.maxF + EPS && y + tree.base >= b.minY - EPS && y + tree.base <= b.maxY + EPS)
    expect([...vertices(wood.positions), ...caves, ...head].filter((v) => !inSome(v))).toEqual([])
  })

  it('keeps its wood, caves and headwall off the track by its rail clearance (#613)', () => {
    const nearest = Math.min(
      ...[...vertices(wood.positions), ...caves, ...head].map(([a, y, f]) => {
        const { x, z } = pieceToBlockout(tree, a, f)
        return trackDistance({ x, y: y + tree.base, z })
      }),
    )
    expect(nearest).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it('has a gap under the trunk the coaster fits through, cave to cave', () => {
    const inGap = vertices(wood.positions).filter(([a, y, f]) => Math.abs(a) < TREE_GAP.halfAlong && f > TREE_GAP.minF && f < TREE_GAP.maxF && y > 0.7 && y < TREE_GAP.height)
    expect(inGap).toHaveLength(0)
    expect(TREE_GAP.maxF - TREE_GAP.minF).toBeGreaterThanOrEqual(2 * RAIL_CLEARANCE)
    expect(TREE_GAP.height).toBeGreaterThanOrEqual(2 * RAIL_CLEARANCE)
    // The trunk stands on its roots over the gap.
    expect(vertices(wood.positions).some(([a, y]) => Math.abs(a) < 1 && y > TREE_GAP.height && y < TREE_GAP.height + 0.5)).toBe(true)
  })
})
