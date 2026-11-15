/** The repo's own ESLint rules (`sc/*`), wired up in `eslint.config.js`. */
import noHotPathAlloc from './no-hot-path-alloc.mjs'
import noMathRandom from './no-math-random.mjs'
import noSrcInApi from './no-src-in-api.mjs'

export default {
  meta: { name: 'eslint-plugin-sc' },
  rules: {
    'no-hot-path-alloc': noHotPathAlloc,
    'no-math-random': noMathRandom,
    'no-src-in-api': noSrcInApi,
  },
}
