// `npm run lint`. typescript-eslint's recommended rules (not type-aware, no formatting rules) plus the
// repo's own rules in scripts/eslint/ (`sc/*`), each enforcing a rule CLAUDE.md used to only state.
import tseslint from 'typescript-eslint'
import sc from './scripts/eslint/plugin.mjs'

/**
 * Files where every `Math.random` is cosmetic or swaps the global for a seeded render, so the rule
 * is off for the whole file. Anywhere else, a cosmetic use is allowed one line at a time:
 * `// eslint-disable-next-line sc/no-math-random -- cosmetic: <why>`.
 */
const MATH_RANDOM_ALLOWED = [
  'src/effects/ParticleExplosion.tsx', // each death burst's particle spray
  'src/entities/bosses/BossConfetti.tsx', // the boss-defeat confetti
  'src/combat/MuzzleFlash.tsx', // the flash's spin, size and spikes per shot
  'src/audio/scrim/synth.ts', // noise buffers and LFO detune: offline renders seed the global (below)
  'src/audio/arcade/engine.ts', // per-shot pitch jitter
  // These swap `Math.random` for `createRng(seed)` around a render, so it is byte-identical run to run.
  'src/audio/offlineRender.ts',
  'src/audio/arcade/bake.ts',
  'src/testing/audioRender.ts',
  'src/dev/turntable/Stage.tsx',
]

export default tseslint.config(
  { ignores: ['dist*/**', 'node_modules/**', 'e2e-results/**', 'docs/**', 'public/**'] },
  {
    files: ['src/**/*.{ts,tsx}', 'api/**/*.ts'],
    extends: [tseslint.configs.recommended],
    plugins: { sc },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: MATH_RANDOM_ALLOWED,
    rules: { 'sc/no-math-random': 'error' },
  },
  {
    // Placement maths (#546: a loop `const reach` hid the readable-range parameter of the same name and silently
    // switched off the trackside in-view flip). Clean here; the rest of src has older shadows to work through first.
    files: ['src/entities/spawning/**/*.ts', 'src/levels/**/*.ts'],
    rules: { '@typescript-eslint/no-shadow': 'error' },
  },
  {
    files: ['api/**/*.ts'],
    ignores: ['api/**/*.test.ts'],
    rules: { 'sc/no-src-in-api': 'error' },
  },
)
