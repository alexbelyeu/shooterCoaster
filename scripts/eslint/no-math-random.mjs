/**
 * `sc/no-math-random`: layout, scatter, spawns, enemy motion and scoring draw from `createRng`
 * (`src/utils/rng.ts`) with a fixed or run seed, so a run replays the same on every machine.
 * `Math.random` is left to per-frame cosmetic jitter, allow-listed in `eslint.config.js` or on the
 * line: `// eslint-disable-next-line sc/no-math-random -- cosmetic: <why>`.
 */
const isMath = (node) =>
  (node.type === 'Identifier' && node.name === 'Math') ||
  (node.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier' &&
    ['globalThis', 'window', 'self'].includes(node.object.name) && node.property.name === 'Math')

const isRandomKey = (node, computed) =>
  computed
    ? node.type === 'Literal' && node.value === 'random'
    : node.type === 'Identifier' && node.name === 'random'

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Seeded code uses createRng (src/utils/rng.ts), not Math.random' },
    schema: [],
    messages: {
      banned:
        'Math.random is for cosmetic per-frame jitter only. Use createRng (src/utils/rng.ts) with a fixed or run seed, ' +
        'or allow-list it: `// eslint-disable-next-line sc/no-math-random -- cosmetic: <why>`.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isMath(node.object) && isRandomKey(node.property, node.computed)) context.report({ node, messageId: 'banned' })
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !node.init || !isMath(node.init)) return
        for (const p of node.id.properties) {
          if (p.type === 'Property' && isRandomKey(p.key, p.computed)) context.report({ node: p, messageId: 'banned' })
        }
      },
    }
  },
}
