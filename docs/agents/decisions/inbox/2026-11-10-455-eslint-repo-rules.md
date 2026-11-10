## 2026-11-10 — Conventions move into ESLint; enemies draw from a run-seeded stream (builder, #455)

**Context:** Steering #351: rules that live only in CLAUDE.md are enforced by nothing. Thirteen enemy
components drew their speeds, headings, phases and colours from `Math.random`, so the same run seed
moved enemies differently on every machine.
**Decision:** `npm run lint` (ESLint 9, typescript-eslint recommended, not type-aware) runs in `verify`
and CI's `unit + build`, with the repo's own rules in `scripts/eslint/`: `sc/no-math-random` (allow-list
of whole cosmetic files in `eslint.config.js`, single lines by a `-- cosmetic:` disable comment) and
`sc/no-src-in-api`. Enemies draw once per mount from `useEnemyRandom` (`createRng(runSeed ^ hash(id))`).
Audio keeps the global `Math.random` on purpose: offline renders swap it for a seeded one.
**Consequences:** A new convention that a check can enforce lands as a lint rule or test with its fix.
Seeding the audio or particles per call site would break that swap; extend the allow-list instead.
