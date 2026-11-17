/**
 * A level score's sections (docs/audio/SCORE-FORMAT.md "Boss section"): `main` (the intro, then the loop), `boss` (the
 * `boss` line, looped from the boss's arrival) and `sting` (the `sting` line once on its defeat, then the loop again).
 * Pure: the player plays each as its own song on the same voices and moves between them on a bar line.
 */
import type { CompiledSong, Timeline } from './score'

export type ScoreSection = 'main' | 'boss' | 'sting'

const EMPTY: Timeline = { events: [], sections: [], dur: 0 }

/** Whether the score has a boss section to move to (a theme option may not have one yet). */
export function hasBossSection(song: CompiledSong): boolean {
  return song.boss.dur > 0
}

/**
 * The song a section plays, from its top: `main` back to the loop (the intro was the run's fanfare), `boss` its own
 * loop, `sting` once then the loop. Null for a score without a boss section.
 */
export function sectionSong(song: CompiledSong, section: ScoreSection): CompiledSong | null {
  if (!hasBossSection(song)) return null
  if (section === 'boss') return { ...song, intro: EMPTY, loop: song.boss }
  return { ...song, intro: section === 'sting' ? song.sting : EMPTY, loop: song.loop }
}

/** Song time of the first bar line at or after `t` in `song` (intro bars, then the loop's, pass after pass). */
export function barLineAtOrAfter(song: CompiledSong, t: number): number {
  const { intro, loop } = song
  const inIntro = t < intro.dur || !loop.dur
  const base = inIntro ? 0 : intro.dur + Math.floor((t - intro.dur) / loop.dur) * loop.dur
  const tl = inIntro ? intro : loop
  const local = t - base
  for (const s of tl.sections) {
    if (local < s.start + s.dur) return base + s.start + Math.ceil((local - s.start) / s.barDur - 1e-9) * s.barDur
  }
  return base + tl.dur
}
