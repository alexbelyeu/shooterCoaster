import { describe, expect, it } from 'vitest'
import status from './studio-status.cjs'

const now = Date.parse('2026-11-05T12:00:00Z')
const milestone = (o: object) => ({
  title: 'M2 — The arcade loop',
  html_url: 'https://github.com/o/r/milestone/1',
  due_on: '2026-11-08T00:00:00Z',
  open_issues: 6,
  closed_issues: 33,
  p1: [],
  ...o,
})
const empty = { issues: [], prs: [], drafts: [], merged: [], building: [], ci: {}, mainVerify: null, prodSmoke: null, steeringPaused: false, ledger: null }

describe('studio-status milestoneSection', () => {
  it('renders nothing when no milestone is open', () => {
    expect(status.milestoneSection([], now)).toBe('')
    expect(status.render({ ...empty, milestones: [] }, now)).not.toContain('Milestones')
  })

  it('shows partial progress, the due date, days left and the open P1s', () => {
    const md = status.milestoneSection([milestone({ p1: [{ number: 176, title: 'Combo tiers' }, { number: 177, title: 'Bosses' }] })], now)
    expect(md).toBe(
      '### 🎯 Milestones\n' +
        '**[M2 — The arcade loop](https://github.com/o/r/milestone/1)** · due Sun, Nov 8 (3 days left)\n' +
        '`████████░░` 33 / 39 closed (84 %) · Open P1: #176 Combo tiers · #177 Bosses\n',
    )
  })

  it('handles 0 %, 100 %, an empty milestone, no due date and overdue', () => {
    const md = status.milestoneSection([
      milestone({ open_issues: 5, closed_issues: 0 }),
      milestone({ open_issues: 0, closed_issues: 12, due_on: '2026-11-05T00:00:00Z' }),
      milestone({ open_issues: 0, closed_issues: 0, due_on: null }),
      milestone({ due_on: '2026-11-03T00:00:00Z' }),
    ], now)
    expect(md).toContain('`░░░░░░░░░░` 0 / 5 closed (0 %) · No open P1.')
    expect(md).toContain('`██████████` 12 / 12 closed (100 %)')
    expect(md).toContain('· no due date\n`░░░░░░░░░░` 0 / 0 closed (0 %)')
    expect(md).toContain('due Tue, Nov 3 (⚠️ 2 days overdue)')
    expect(md).toContain('due Thu, Nov 5 (due today)')
  })

  it('sits right after the header, before the build table', () => {
    const md = status.render({ ...empty, milestones: [milestone({})] }, now)
    expect(md.indexOf('### 🎯 Milestones')).toBeLessThan(md.indexOf('### 🔨 Being built now'))
    expect(md.indexOf('### 🎯 Milestones')).toBeGreaterThan(md.indexOf('<sub>Updated'))
  })
})
