import path from 'node:path'

/**
 * `sc/no-src-in-api`: Vercel builds `api/` on its own (`api/tsconfig.json`: no `@/` alias, no
 * bundling of the game), so a function that imports `src/` at runtime breaks in production only.
 * Type-only imports are erased and allowed; shared code is generated into `api/_lib/`
 * (`scripts/gen-level-limits.mjs`).
 */
function intoSrc(context, source) {
  if (typeof source !== 'string') return false
  if (source === '@' || source.startsWith('@/')) return true
  if (!source.startsWith('.')) return false
  const rel = path.relative(context.cwd, path.resolve(path.dirname(context.filename), source))
  return rel === 'src' || rel.startsWith(`src${path.sep}`)
}

const typeOnly = (node) =>
  node.importKind === 'type' || node.exportKind === 'type' ||
  (node.specifiers?.length > 0 &&
    node.specifiers.every((s) => s.importKind === 'type' || s.exportKind === 'type'))

export default {
  meta: {
    type: 'problem',
    docs: { description: 'api/ imports nothing from src/ at runtime' },
    schema: [],
    messages: {
      banned:
        "api/ can't import '{{source}}' at runtime: Vercel builds api/ without src/. Use `import type`, " +
        'or generate the shared code into api/_lib/ (as scripts/gen-level-limits.mjs does).',
    },
  },
  create(context) {
    const check = (node, sourceNode) => {
      if (sourceNode && intoSrc(context, sourceNode.value)) {
        context.report({ node, messageId: 'banned', data: { source: sourceNode.value } })
      }
    }
    return {
      ImportDeclaration(node) { if (!typeOnly(node)) check(node, node.source) },
      ExportNamedDeclaration(node) { if (node.source && !typeOnly(node)) check(node, node.source) },
      ExportAllDeclaration(node) { if (node.exportKind !== 'type') check(node, node.source) },
      ImportExpression(node) { if (node.source.type === 'Literal') check(node, node.source) },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments[0]?.type === 'Literal') {
          check(node, node.arguments[0])
        }
      },
    }
  },
}
