import type { DarkSectionSpec } from '@/types/level'

/**
 * Dark sections (#752): how dark the ride is at track parameter `t`, 0 in the light to 1 once a section's `ramp` past its
 * start, easing back to 0 at its end (smoothstep). Read each frame by `DarkSections`, which dims the level's light and fog by it.
 */
export function darkSectionDepth(sections: readonly DarkSectionSpec[] | undefined, t: number): number {
  if (!sections) return 0
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    if (t < s.from || t > s.to) continue
    const k = Math.min(Math.max(Math.min(t - s.from, s.to - t) / Math.max(s.ramp, 1e-6), 0), 1)
    return k * k * (3 - 2 * k)
  }
  return 0
}

/** The ride's darkness this frame, 0..1: a shader uniform `DarkSections` sets and lit surfaces read (the gym's blacklight holds). */
export const DARKNESS = { value: 0 }
