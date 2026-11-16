import { describe, expect, it } from 'vitest'
import { HALL } from './blockout'
import { COLUMN_HALF, MURALS, STRIP_LIGHTS, stripLightXs, wallColumns } from './config'
import { graffitiPiece, tag, type MuralShape } from './murals'

function spanX(m: { x: number; rot: number }, shapes: readonly MuralShape[]): [number, number] {
  const xs = shapes.flatMap((s) => s.points.map((p) => p[0]))
  // rot 180 mirrors the wall frame's x.
  const sign = m.rot === 180 ? -1 : 1
  const a = m.x + sign * Math.min(...xs)
  const b = m.x + sign * Math.max(...xs)
  return [Math.min(a, b), Math.max(a, b)]
}

describe('gym config', () => {
  it('keeps every mural clear of the maroon columns on its wall', () => {
    const columns = wallColumns()
    const murals = [
      ...MURALS.pieces.map((p) => ({ m: p, shapes: graffitiPiece(p.seed, p.w, p.h, p.style) })),
      ...MURALS.tags.map((t) => ({ m: t, shapes: tag(t.seed, t.w, t.h, t.colour) })),
    ]
    const hits = murals.flatMap(({ m, shapes }) => {
      const [x0, x1] = spanX(m, shapes)
      const onWall = m.z === 0 ? columns.east : columns.west
      return onWall.filter((c) => x1 > c - COLUMN_HALF && x0 < c + COLUMN_HALF).map((c) => `${m.seed} crosses the column at x ${c}`)
    })
    expect(hits).toEqual([])
  })

  it('puts every mural on a long wall, inside the hall', () => {
    const bad = [...MURALS.pieces, ...MURALS.tags].filter((m) => (m.z !== 0 || m.rot !== 0) && (m.z !== HALL.d || m.rot !== 180))
    expect(bad).toEqual([])
  })

  it('spaces the strip-light rows and fixtures evenly, as the grime shader assumes when it snaps to the nearest', () => {
    const rowGaps = new Set(STRIP_LIGHTS.rows.slice(1).map((z, i) => z - STRIP_LIGHTS.rows[i]))
    const xGaps = new Set(stripLightXs.slice(1).map((x, i) => x - stripLightXs[i]))
    expect([...rowGaps]).toHaveLength(1)
    expect([...xGaps]).toEqual([STRIP_LIGHTS.spacing])
    expect(stripLightXs[stripLightXs.length - 1]).toBeLessThan(HALL.w)
  })
})
