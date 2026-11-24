import type { DarkSectionSpec } from '@/types/level'
import { smoothstep } from '@/utils/ease'

/**
 * Dark sections (#752): how dark the ride is at track parameter `t`, 0 in the light to 1 once a section's `ramp` past its
 * start, easing back to 0 at its end (smoothstep). Read each frame by `DarkSections`, which dims the level's light and fog by it.
 */
export function darkSectionDepth(sections: readonly DarkSectionSpec[] | undefined, t: number): number {
  const s = darkSectionAt(sections, t)
  if (!s) return 0
  return smoothstep(Math.min(t - s.from, s.to - t) / Math.max(s.ramp, 1e-6))
}

/** The dark section the ride is in at track parameter `t`, if any. */
export function darkSectionAt(sections: readonly DarkSectionSpec[] | undefined, t: number): DarkSectionSpec | undefined {
  if (!sections) return undefined
  for (let i = 0; i < sections.length; i++) if (t >= sections[i].from && t <= sections[i].to) return sections[i]
  return undefined
}

/** The ride's darkness this frame, 0..1: a shader uniform `DarkSections` sets and lit surfaces read (the gym's blacklight holds). */
export const DARKNESS = { value: 0 }
