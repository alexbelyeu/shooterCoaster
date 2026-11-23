import type { Scene } from '@/ui/screens/LevelPostcard'

// Every new world's level-select postcard stub: `npm run new-world` inserts this record's one entry into
// SCENES in src/ui/screens/LevelPostcard.tsx.

export const SCENES: Record<string, Scene> = {
  // __NAME__ (scaffolded): a stand-in until the world's landmark is drawn here
  __BIOME__: (t) => (
    <>
      <circle cx="160" cy="26" r="8" fill={t.accent2} />
      <path d="M118 90 L128 30 L138 90Z" fill="#6f6660" />
      <path d="M0 80 Q50 70 100 78 T200 74 V100 H0Z" fill="#33402c" />
      <path d="M8 74 Q50 30 92 62 T192 50" stroke={t.accent} strokeWidth="3" fill="none" />
    </>
  ),
}
