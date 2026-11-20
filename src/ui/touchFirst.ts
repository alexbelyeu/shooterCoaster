/** A phone or tablet with no mouse: hints say "Tap", not "Press". */
export const touchFirst = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches
