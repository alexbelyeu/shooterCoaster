import { describe, expect, it } from 'vitest'
import { HALL, PIECES, type PieceOf } from './blockout'
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

function spanY(m: { base: number }, shapes: readonly MuralShape[]): [number, number] {
  const ys = shapes.flatMap((s) => s.points.map((p) => p[1]))
  return [m.base + Math.min(...ys), m.base + Math.max(...ys)]
}

const murals = [
  ...MURALS.pieces.map((p) => ({ m: p, shapes: graffitiPiece(p.seed, p.w, p.h, p.style) })),
  ...MURALS.tags.map((t) => ({ m: t, shapes: tag(t.seed, t.w, t.h, t.colour) })),
]

describe('gym config', () => {
  it('keeps every mural clear of the maroon columns on its wall', () => {
    const columns = wallColumns()
    const hits = murals.flatMap(({ m, shapes }) => {
      const [x0, x1] = spanX(m, shapes)
      const onWall = m.z === 0 ? columns.east : columns.west
      return onWall.filter((c) => x1 > c - COLUMN_HALF && x0 < c + COLUMN_HALF).map((c) => `${m.seed} crosses the column at x ${c}`)
    })
    expect(hits).toEqual([])
  })

  it('keeps every mural clear of the window rows on its wall', () => {
    const windows = PIECES.filter((p): p is PieceOf<'windows'> => p.kind === 'windows')
    expect(windows.length).toBeGreaterThan(0)
    const hits = murals.flatMap(({ m, shapes }) => {
      const [x0, x1] = spanX(m, shapes)
      const [y0, y1] = spanY(m, shapes)
      return windows
        .filter((w) => w.rot === m.rot && Math.abs(w.z - m.z) < 0.5)
        .filter((w) => x1 > w.x - w.length / 2 && x0 < w.x + w.length / 2 && y1 > w.base && y0 < w.base + w.h)
        .map((w) => `${m.seed} covers ${w.id}`)
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
