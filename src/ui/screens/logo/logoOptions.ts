/**
 * The title logo concepts waiting on Alex's pick (#476, `Look: pick the new logo`). None shows by default:
 * `?logo=<name>` puts one on the title in place of the wordmark, like `?theme=` for the music. Once Alex picks,
 * the winner becomes the default and the others are deleted.
 */
export const LOGO_OPTIONS = ['bullseye', 'coaster', 'loop'] as const

export type LogoOption = (typeof LOGO_OPTIONS)[number]

/** `?logo=coaster` → `'coaster'`; no param or an unknown name → null (today's wordmark). */
export function logoFromQuery(search: string): LogoOption | null {
  const name = new URLSearchParams(search).get('logo')?.trim().toLowerCase()
  return LOGO_OPTIONS.find((option) => option === name) ?? null
}
