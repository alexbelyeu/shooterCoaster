/**
 * `sc/no-hot-path-alloc`: hard rule 8. Allocation is an error inside a `useFrame(...)` callback and inside any function
 * of a `*.hot.ts` module (its module scope holds the scratch objects); a `throw` is a crash path and never checked.
 */
const COPYING_METHODS = new Set(['map', 'filter', 'slice', 'concat', 'flat', 'clone'])
const isFunction = (node) =>
  node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'FunctionDeclaration'
const isUseFrameCallback = (fn) =>
  fn.parent?.type === 'CallExpression' && fn.parent.arguments[0] === fn &&
  fn.parent.callee.type === 'Identifier' && fn.parent.callee.name === 'useFrame'
const memberName = (callee) =>
  callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier' ? callee.property.name : null

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No allocations inside useFrame callbacks or *.hot.ts functions (CLAUDE.md hard rule 8)' },
    schema: [],
    messages: {
      alloc:
        '{{what}} allocates every frame. Reuse a module-scope or useMemo scratch object and work in place ' +
        '(docs/HEAP-BOTTLENECKS.md), or allow-list a cold line: `// eslint-disable-next-line sc/no-hot-path-alloc -- <why>`.',
    },
  },
  create(context) {
    const hotFile = /\.hot\.ts$/.test(context.filename)
    const { sourceCode } = context

    const isHot = (node) => {
      const ancestors = sourceCode.getAncestors(node)
      return !ancestors.some((a) => a.type === 'ThrowStatement') &&
        ancestors.some((a) => isFunction(a) && (hotFile || isUseFrameCallback(a)))
    }
    const report = (node, what) => {
      if (isHot(node)) context.report({ node, messageId: 'alloc', data: { what } })
    }

    const closure = (node) => report(node, 'A closure')
    return {
      NewExpression: (node) => report(node, '`new`'),
      ObjectExpression: (node) =>
        report(node, node.properties.some((p) => p.type === 'SpreadElement') ? 'An object spread' : 'An object literal'),
      ArrayExpression: (node) =>
        report(node, node.elements.some((e) => e?.type === 'SpreadElement') ? 'An array spread' : 'An array literal'),
      SpreadElement(node) {
        if (node.parent.type === 'CallExpression' || node.parent.type === 'NewExpression') report(node, 'A spread argument')
      },
      FunctionExpression: closure,
      ArrowFunctionExpression: closure,
      FunctionDeclaration: closure,
      ForOfStatement(node) {
        const left = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left
        if (left.type === 'ArrayPattern') report(node, 'A destructuring `for…of` (an iterator and an entry array per item)')
      },
      TemplateLiteral(node) {
        if (node.expressions.length > 0) report(node, 'A template string')
      },
      CallExpression(node) {
        const name = memberName(node.callee)
        if (!name) return
        if (COPYING_METHODS.has(name)) report(node, `\`.${name}()\``)
        else if (name === 'from' && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Array') {
          report(node, '`Array.from`')
        }
      },
    }
  },
}
