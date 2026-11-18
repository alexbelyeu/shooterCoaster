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

const frame = (body: string) => `useFrame((state, dt) => {\n${body}\n})`
const hot = at('src/combat/thing.hot.ts')
const alloc = { messageId: 'alloc' }

tester.run('sc/no-hot-path-alloc', plugin.rules['no-hot-path-alloc'], {
  valid: [
    { code: frame('v.set(1, 2, 3)\nmesh.position.copy(v).addScaledVector(dir, dt)\nconst s = `ready`') },
    { code: 'const v = new Vector3()\nconst list = [1, 2].map((x) => x * 2)\nconst o = { ...a }\nuseFrame(() => { v.set(0, 0, 0) })' },
    { code: 'const scratch = useMemo(() => new Vector3(), [])\nconst ref = useRef({ age: 0 })\nuseFrame(() => { ref.current.age += 1 })' },
    { code: frame('if (!ok) throw new Error(`bad ${id}`)') },
    { code: 'function step(dt) { return [dt] }\nonFrame(() => ({ a: [...xs] }))' },
    { code: 'export function step(p, dt) { p.x += dt }', filename: hot },
    { code: 'const v = new Vector3()\nconst TABLE = [1, 2, 3].map((x) => x * 2)\nexport const step = (p) => { p.x = TABLE[0] }', filename: hot },
    { code: 'export function step() { return [1] }', filename: at('src/combat/thing.test.ts') },
  ],
  invalid: [
    { code: frame('const b = [...a]'), errors: [alloc] },
    { code: frame('const v = new Vector3()'), errors: [alloc] },
    { code: frame('move({ dt })\nconst xs = [dt]'), errors: [alloc, alloc] },
    { code: frame('const o = { ...a }\nfn(...args)'), errors: [alloc, alloc] },
    { code: frame('items.forEach((x) => x.step(dt))'), errors: [alloc] },
    { code: frame('function inner() {}\nconst f = function () {}'), errors: [alloc, alloc] },
    { code: frame('label.text = `${score}`'), errors: [alloc] },
    { code: frame('a.map(f); a.filter(f); a.slice(1); a.concat(b); a.flat(); v.clone(); Array.from(set)'), errors: Array(7).fill(alloc) },
    { code: 'useFrame(function tick() { if (on) { const c = v.clone() } })', errors: [alloc] },
    { code: 'export function step(p) { return { x: p.x } }', filename: hot, errors: [alloc] },
    { code: 'export const step = (xs) => xs.some((x) => x > 0)', filename: hot, errors: [alloc] },
    { code: 'export function step(a) { const v = new Vector3(); return `${a}` }', filename: hot, errors: [alloc, alloc] },
  ],
})

const slowMoWrite = { messageId: 'setState' }

tester.run('sc/one-slow-mo-writer', plugin.rules['one-slow-mo-writer'], {
  valid: [
    { code: "useGameStore.setState({ phase: 'playing', score: 0 })" },
    { code: 'useGameStore.setState(initial, true)' },
    { code: 'useGameStore.setState((s) => ({ score: s.score + 1, nested: { timeScale: 2 } }))' },
    { code: 'useGameStore.setState((s) => { const f = () => ({ timeScale: 2 }); return { score: f() } })' },
    { code: "requestSlowMo('frenzy')\nsetTimeScaleOverride(0)\nconst o = { timeScale: 1 }" },
  ],
  invalid: [
    { code: "useGameStore.setState({ phase: 'playing', timeScale: 1 })", errors: [slowMoWrite] },
    { code: "useGameStore.setState((s) => ({ timeScale: 0.5, frenzy: 'hold' }))", errors: [slowMoWrite, slowMoWrite] },
    { code: "store.setState(function () { if (x) return { frenzy: 'off' }; return {} })", errors: [slowMoWrite] },
    { code: "useGameStore.setState({ boss: { name: 'x', hp: 1 }, timeScale: 1 })", errors: [slowMoWrite] },
    { code: "useGameStore.setState({ ['timeScale']: 1 })", errors: [slowMoWrite] },
    { code: "const { setSlowMo } = useGameStore.getState()\nsetSlowMo(0.5, 'hold')", errors: [{ messageId: 'setSlowMo' }] },
    { code: "useGameStore.getState().setSlowMo(1, 'off')", errors: [{ messageId: 'setSlowMo' }] },
  ],
})
