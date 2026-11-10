/** The repo's own ESLint rules (`sc/*`), wired up in `eslint.config.js`. */
import noMathRandom from './no-math-random.mjs'
import noSrcInApi from './no-src-in-api.mjs'

export default {
  meta: { name: 'eslint-plugin-sc' },
  rules: {
    'no-math-random': noMathRandom,
    'no-src-in-api': noSrcInApi,
  },
}
