import { describe, expect, it } from 'vitest'
import alert from '../scripts/prod-alert.cjs'
import { buildFingerprint, INCONCLUSIVE_EXIT, redeployVerdict } from './buildFingerprint.mjs'

const page = (entry: string, preloads: string[] = []) => `<!doctype html><html><head>
    <script type="application/ld+json">{"@type":"VideoGame"}</script>
    <script type="module" crossorigin src="${entry}"></script>
    ${preloads.map((p) => `<link rel="modulepreload" crossorigin href="${p}">`).join('\n    ')}
  </head><body><div id="root"></div></body></html>`

describe('buildFingerprint (#822)', () => {
  it('takes the entry script and the sorted modulepreloads', () => {
    expect(buildFingerprint(page('/assets/index-AAA.js', ['/assets/three-B.js', '/assets/react-A.js']))).toEqual({
      entry: '/assets/index-AAA.js',
      preloads: ['/assets/react-A.js', '/assets/three-B.js'],
    })
  })

  it('is null for a page without an entry script (an error page)', () => {
    expect(buildFingerprint('<html><body>404</body></html>')).toBeNull()
  })
})

describe('redeployVerdict', () => {
  const before = buildFingerprint(page('/assets/index-AAA.js', ['/assets/engine--LMLsimo.js']))

  it('says nothing about an unchanged build, so its failure stays red', () => {
    expect(redeployVerdict(before, buildFingerprint(page('/assets/index-AAA.js', ['/assets/engine--LMLsimo.js'])))).toBeNull()
  })

  it('names the entry change in plain words', () => {
    expect(redeployVerdict(before, buildFingerprint(page('/assets/index-BBB.js', ['/assets/engine-x1.js']))))
      .toBe('production redeployed mid-run (index-AAA.js → index-BBB.js): no single build tested')
  })

  it('catches a deploy that changed only a preloaded chunk', () => {
    expect(redeployVerdict(before, buildFingerprint(page('/assets/index-AAA.js', ['/assets/engine-x1.js']))))
      .toBe('production redeployed mid-run (same entry, other preloaded chunks): no single build tested')
  })

  it('never calls an unknown fingerprint a redeploy', () => {
    expect(redeployVerdict(null, before)).toBeNull()
    expect(redeployVerdict(before, null)).toBeNull()
  })

  it('exits with the code prod-alert reads as inconclusive', () => {
    expect(INCONCLUSIVE_EXIT).toBe(alert.INCONCLUSIVE)
  })
})
