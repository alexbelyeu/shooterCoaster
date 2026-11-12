import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// `playwright install --with-deps` runs apt-get on every job, so one Ubuntu mirror outage failed every browser
// job of a run on main (2026-11-11, #505 / #507). Workflows install the browser through
// scripts/install-chromium.sh, which only reaches apt when a library is actually missing.
const root = join(__dirname, '..')
const dir = join(root, '.github/workflows')
const workflows = readdirSync(dir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))

describe('Chromium install in CI', () => {
  it('no workflow calls Playwright install directly', () => {
    const direct = workflows.filter((w) => /playwright install/.test(w.text)).map((w) => w.file)
    expect(direct).toEqual([])
  })

  it('every browser workflow uses scripts/install-chromium.sh', () => {
    const users = workflows.filter((w) => w.text.includes('bash scripts/install-chromium.sh')).map((w) => w.file)
    expect(users.sort()).toEqual(['ci.yml', 'prod-smoke.yml', 'turntable.yml'])
  })
})
