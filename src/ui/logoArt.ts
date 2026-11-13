/**
 * The logo Alex picked in #532 ("loop"), drawn as SVG by `screens/TitleLogo.tsx` and on canvas by `scoreCardImage.tsx`.
 * Units are Lobster at font-size 160, baseline y = 200.
 */

export const LOGO_TEXT = 'ShooterCoaster'

export const NAVY = '#14213d'
export const WHITE = '#fff'
export const GOLD = '#ffc93c'
export const RED = '#ff4757'

/** Bold: Lobster has one weight, and the h1 Alex picked it in synthesised bold. */
export const WORDMARK = { x: 0, y: 200, family: 'Lobster, cursive', size: 160, weight: 700, edge: 12 } as const

export const VIEWBOX = { x: -32, y: 52, width: 1185, height: 202 } as const

export const TRACK = 'M-20 232C300 236 700 232 960 232C1030 232 1105 200 1105 140A55 55 0 1 0 995 140C995 200 1040 238 1120 238'
export const RAIL = { edge: 17, width: 7 } as const

/** Where the car stops: the end of `TRACK`, which leaves the loop level. */
export const CAR_PARK = { x: 1120, y: 238, deg: 0 } as const

/** A coaster car (red, one rider) standing on the rail at the origin, facing +x. */
export const CAR = {
  edge: 5,
  rider: { cx: 4, cy: -33, r: 7 },
  body: { x: -25, y: -28, width: 50, height: 22, rx: 7 },
  wheels: [
    { cx: -13, cy: -5, r: 5 },
    { cx: 13, cy: -5, r: 5 },
  ],
} as const

export const TARGET = {
  x: 1050,
  y: 140,
  rings: [
    { r: 34, fill: RED },
    { r: 22, fill: WHITE },
    { r: 10, fill: RED },
  ],
} as const

export const CROSSHAIR = { inner: 66, outer: 80, edge: 13, width: 5 } as const

export const CROSSHAIR_PATH = (() => {
  const { inner, outer } = CROSSHAIR
  return `M0 ${-outer}V${-inner}M0 ${inner}V${outer}M${-outer} 0H${-inner}M${inner} 0H${outer}`
})()
