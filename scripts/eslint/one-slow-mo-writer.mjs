/**
 * `sc/one-slow-mo-writer`: the store's `timeScale` and `frenzy` stage have one writer, `src/combat/slowMo.hot.ts`
 * (allow-listed in `eslint.config.js` with the store that declares them). Everyone else asks it for a slow-mo
 * (`requestSlowMo`, `setTimeScaleOverride`), so the envelopes, the e2e freeze and the pause never fight over the clock.
 * Flags any call to `setSlowMo` and any `setState` whose object (or the object its updater function returns)
 * has a `timeScale` or `frenzy` key.
 */
const OWNED = new Set(['timeScale', 'frenzy'])

const calleeName = (callee) => {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') return callee.property.name
  return null
}

const keyName = (prop) => {
  if (prop.computed) return prop.key.type === 'Literal' ? prop.key.value : null
  return prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? prop.key.value : null
}

/** The object literals a `setState` argument writes: the object itself, or what an updater function returns. */
function writtenObjects(arg) {
  if (!arg) return []
  if (arg.type === 'ObjectExpression') return [arg]
  if (arg.type !== 'ArrowFunctionExpression' && arg.type !== 'FunctionExpression') return []
  if (arg.body.type === 'ObjectExpression') return [arg.body]
  if (arg.body.type !== 'BlockStatement') return []
  const found = []
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return
    // A nested function's returns are its own.
    if (node !== arg.body && /Function/.test(node.type)) return
    if (node.type === 'ReturnStatement' && node.argument?.type === 'ObjectExpression') found.push(node.argument)
    for (const [k, v] of Object.entries(node)) {
      if (k === 'parent') continue
      if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v === 'object') visit(v)
    }
  }
  visit(arg.body)
  return found
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only combat/slowMo.hot.ts writes the store\'s timeScale and frenzy stage' },
    schema: [],
    messages: {
      setSlowMo: 'Only combat/slowMo.hot.ts calls setSlowMo: request a slow-mo there (requestSlowMo, setTimeScaleOverride).',
      setState:
        'Only combat/slowMo.hot.ts writes `{{key}}`: request a slow-mo there (requestSlowMo, setTimeScaleOverride), ' +
        'or allow it on the line: `// eslint-disable-next-line sc/one-slow-mo-writer -- <why>`.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (name === 'setSlowMo') {
          context.report({ node, messageId: 'setSlowMo' })
          return
        }
        if (name !== 'setState') return
        for (const obj of writtenObjects(node.arguments[0])) {
          for (const prop of obj.properties) {
            if (prop.type !== 'Property') continue
            const key = keyName(prop)
            if (OWNED.has(key)) context.report({ node: prop, messageId: 'setState', data: { key } })
          }
        }
      },
    }
  },
}
