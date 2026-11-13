import { describe, expect, it } from 'vitest'
import fold from './decisionsFold.cjs'

const { missingFoldedHeadings } = fold
const entry = (title: string) => `## ${title}\n**Context:** c\n**Decision:** d\n`

describe('missingFoldedHeadings', () => {
  it('passes when every deleted entry was appended', () => {
    expect(missingFoldedHeadings([entry('2026-11-13 — A (Builder, #1)')], `# Decisions\n\n${entry('2026-11-13 — A (Builder, #1)')}`)).toEqual([])
  })

  it('names each deleted entry DECISIONS.md lacks (#528: the fold only deleted the inbox)', () => {
    expect(missingFoldedHeadings([entry('2026-11-13 — A (Builder, #1)'), entry('2026-11-13 — B (Director)')], `# Decisions\n\n${entry('2026-11-13 — A (Builder, #1)')}`))
      .toEqual(['## 2026-11-13 — B (Director)'])
  })
})
