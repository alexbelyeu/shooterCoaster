import { describe, expect, it } from 'vitest'
import { MOTION_FRAMES, REST_TIME, SUBJECTS, boardCells, parseQuery, type Board } from './subjects'

const ids = SUBJECTS.map((s) => s.id)

describe('turntable subjects', () => {
  // That every enemy and boss has a subject is held by the specs' `Record` types (`tsc -b`).
  it('lists each subject once, the enemies before the bosses', () => {
    expect(new Set(ids).size).toBe(ids.length)
    const kinds = SUBJECTS.map((s) => s.kind)
    expect(kinds.lastIndexOf('enemy')).toBeLessThan(kinds.indexOf('boss'))
  })

  it('puts every subject on the sheet', () => {
    expect(boardCells({ kind: 'sheet', yaw: 0 }).map((c) => c.subject.id)).toEqual(ids)
  })

  it("renders every board's cells in time order, from the rest pose on", () => {
    const boards: Board[] = [{ kind: 'sheet', yaw: 0 }]
    for (const id of ids) boards.push({ kind: 'angles', id }, { kind: 'motion', id })
    for (const board of boards) {
      const times = boardCells(board).map((c) => c.time)
      expect(times[0]).toBeGreaterThanOrEqual(REST_TIME)
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
    }
  })

  it('samples a motion strip within one span, before a golden balloon expires', () => {
    for (const s of SUBJECTS) {
      const cells = boardCells({ kind: 'motion', id: s.id })
      expect(cells).toHaveLength(MOTION_FRAMES)
      expect(cells[MOTION_FRAMES - 1].time).toBeLessThan(s.motion.from + s.motion.span)
    }
    const golden = boardCells({ kind: 'motion', id: 'goldenBalloon' })
    // GoldenBalloon hides itself 5 s after its first frame.
    expect(golden[MOTION_FRAMES - 1].time).toBeLessThan(5)
  })

  it('reads the URL', () => {
    expect(parseQuery('').board).toEqual({ kind: 'sheet', yaw: Math.PI / 4 })
    expect(parseQuery('?yaw=0').board).toEqual({ kind: 'sheet', yaw: 0 })
    expect(parseQuery('?enemy=crow').board).toEqual({ kind: 'angles', id: 'crow' })
    expect(parseQuery('?enemy=kraken&animate=1').board).toEqual({ kind: 'motion', id: 'kraken' })
    expect(parseQuery('?enemy=nope').board.kind).toBe('sheet')
    expect(parseQuery('?biome=ocean').biome).toBe('ocean')
    expect(parseQuery('?biome=moon').biome).toBeNull()
  })
})
