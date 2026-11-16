import { describe, expect, it } from 'vitest'
import { MURALS } from './config'
import { graffitiPiece, tag, type MuralShape } from './murals'

function bounds(shapes: readonly MuralShape[]) {
  const xs = shapes.flatMap((s) => s.points.map((p) => p[0]))
  const ys = shapes.flatMap((s) => s.points.map((p) => p[1]))
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

describe('gym murals', () => {
  const all = [
    ...MURALS.pieces.map((p) => ({ w: p.w, h: p.h, shapes: graffitiPiece(p.seed, p.w, p.h, p.style) })),
    ...MURALS.tags.map((t) => ({ w: t.w, h: t.h, shapes: tag(t.seed, t.w, t.h, t.colour) })),
  ]

  it('draws every shape as a finite polygon', () => {
    const bad = all.flatMap((m) => m.shapes).filter((s) => s.points.length < 3 || s.points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1])))
    expect(bad).toEqual([])
  })

  it('keeps each piece within a margin of its rect, so it stays on its wall under the ring beam', () => {
    const out = all.filter(({ w, h, shapes }) => {
      const b = bounds(shapes)
      return b.minX < -w * 0.6 || b.maxX > w * 0.6 || b.minY < -h * 0.1 || b.maxY > h * 1.1
    })
    expect(out.map((m) => m.w)).toEqual([])
  })

  it('is the same every visit', () => {
    const p = MURALS.pieces[0]
    expect(graffitiPiece(p.seed, p.w, p.h, p.style)).toEqual(graffitiPiece(p.seed, p.w, p.h, p.style))
  })

  it('stacks a piece cloud, outlines, fills, then highlights', () => {
    const p = MURALS.pieces[1]
    const layers = new Set(graffitiPiece(p.seed, p.w, p.h, p.style).map((s) => s.layer))
    expect([...layers].sort()).toEqual([0, 1, 2, 3])
  })
})
