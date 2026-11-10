import path from 'node:path'
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { afterAll, describe, it } from 'vitest'
import plugin from './plugin.mjs'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' } })
const at = (file: string) => path.join(process.cwd(), file)

tester.run('sc/no-math-random', plugin.rules['no-math-random'], {
  valid: [
    { code: "import { createRng } from '@/utils/rng'\nconst rng = createRng(7)\nconst x = rng() * 2" },
    { code: 'const r = random()\nconst m = Math.floor(Math.PI)' },
    { code: 'const o = { random: 1 }\nconst y = o.random' },
    { code: 'const { floor } = Math' },
  ],
  invalid: [
    { code: 'const x = Math.random()', errors: [{ messageId: 'banned' }] },
    { code: 'const f = Math.random\nconst g = Math["random"]', errors: [{ messageId: 'banned' }, { messageId: 'banned' }] },
    { code: 'const x = globalThis.Math.random() + window.Math.random()', errors: [{ messageId: 'banned' }, { messageId: 'banned' }] },
    { code: 'const { random } = Math', errors: [{ messageId: 'banned' }] },
    { code: 'Math.random = () => 0.5', errors: [{ messageId: 'banned' }] },
  ],
})

tester.run('sc/no-src-in-api', plugin.rules['no-src-in-api'], {
  valid: [
    { filename: at('api/leaderboard.ts'), code: "import { handle } from './_lib/handler'" },
    { filename: at('api/_lib/rules.ts'), code: "import { levelLimits } from './levelLimits'\nimport fs from 'node:fs'" },
    { filename: at('api/_lib/rules.ts'), code: "import type { LevelId } from '@/levels/LevelRegistry'" },
    { filename: at('api/_lib/rules.ts'), code: "import { type Run } from '../../src/store/leaderboard'" },
    { filename: at('api/_lib/rules.ts'), code: "export type { Run } from '../../src/store/leaderboard'" },
    { filename: at('api/_lib/rules.ts'), code: "import { x } from '../srcx/thing'" },
  ],
  invalid: [
    { filename: at('api/_lib/rules.ts'), code: "import { normalizeInitials } from '@/store/leaderboard'", errors: [{ messageId: 'banned' }] },
    { filename: at('api/leaderboard.ts'), code: "import { scoreLimits } from '../src/levels/scoreLimits'", errors: [{ messageId: 'banned' }] },
    { filename: at('api/_lib/rules.ts'), code: "export { GOLDEN_BALLOON } from '../../src/levels/scoring'", errors: [{ messageId: 'banned' }] },
    { filename: at('api/_lib/rules.ts'), code: "export * from '@/levels/scoring'", errors: [{ messageId: 'banned' }] },
    { filename: at('api/_lib/rules.ts'), code: "const m = await import('@/levels/scoring')", errors: [{ messageId: 'banned' }] },
    { filename: at('api/_lib/rules.ts'), code: "const m = require('../../src/levels/scoring')", errors: [{ messageId: 'banned' }] },
    { filename: at('api/_lib/rules.ts'), code: "import { type Run, normalizeInitials } from '@/store/leaderboard'", errors: [{ messageId: 'banned' }] },
  ],
})
