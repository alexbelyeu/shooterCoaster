import { describe, expect, it } from 'vitest'
import deployedRef from './deployedRef.cjs'

const d = (sha: string) => ({ sha })
const s = (...states: string[]) => states.map((state) => ({ state }))

describe('servingSha', () => {
  it('is the newest deployment whose newest status is success', () => {
    expect(deployedRef.servingSha([d('new'), d('old')], [s('success'), s('inactive', 'success')])).toBe('new')
  })

  it('skips a deploy still building or that failed, and one replaced (inactive)', () => {
    expect(deployedRef.servingSha([d('building'), d('live')], [s('in_progress'), s('success')])).toBe('live')
    expect(deployedRef.servingSha([d('failed'), d('live')], [s('error'), s('success')])).toBe('live')
    expect(deployedRef.servingSha([d('rolledBack'), d('live')], [s('inactive', 'success'), s('success')])).toBe('live')
  })

  it('is null when nothing serves', () => {
    expect(deployedRef.servingSha([], [])).toBeNull()
    expect(deployedRef.servingSha([d('a')], [s('inactive', 'success')])).toBeNull()
  })
})
