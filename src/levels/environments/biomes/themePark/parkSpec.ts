// Theme Park pieces shared by the layout planner and the components that draw them.

interface Ride {
  kind: 'ferrisWheel' | 'carousel'
  x: number
  z: number
  radius: number
}

/** Placed where no pass of the level 1 track (or its towers) crosses them. */
export const RIDES: Ride[] = [
  { kind: 'ferrisWheel', x: 510, z: -90, radius: 80 },
  { kind: 'ferrisWheel', x: -500, z: 130, radius: 60 },
  { kind: 'carousel', x: -450, z: -220, radius: 25 },
  { kind: 'carousel', x: 220, z: 380, radius: 20 },
  { kind: 'carousel', x: 360, z: 320, radius: 20 },
]

export const PALETTE = ['#ff4444', '#ffaa00', '#4488ff', '#44cc44', '#ff44ff', '#ff7a2e']

/** Stall footprint: x across the front (which faces the track), z front-to-back. */
export const STALL_WIDTH = 26
export const STALL_DEPTH = 16
export const ARCH_HALF_SPAN = 46
export const ARCH_BOARD_HEIGHT = 26
export const ARCH_BOARD_WIDTH = ARCH_HALF_SPAN * 2 + 6
export const ARCH_BOARD_DEPTH = 3
/** Sign board of the sign stall: centre height, centre z. */
export const SIGN_WIDTH = STALL_WIDTH - 4
export const SIGN_HEIGHT = 9
export const SIGN_Y = 23
export const SIGN_Z = STALL_DEPTH / 2 - 3
export const FLAG_DROP = 6
export const FLAG_SPACING = 4.5
export const PATH_HALF_WIDTH = 7

export interface Placement {
  x: number
  y: number
  z: number
  yaw: number
}

export interface Stall extends Placement {
  variant: number
  color: number
}

export interface Pole {
  x: number
  y: number
  z: number
  height: number
}

/** Parabolic sag `sag` at the middle. */
export interface Wire {
  a: [number, number, number]
  b: [number, number, number]
  sag: number
}

export interface PathRow {
  x: number
  y: number
  z: number
  nx: number
  nz: number
  /** False under low track: the path stops short there. */
  open: boolean
}

export interface Arch extends Placement {
  boardY: number
  /** From the lower post's ground to the board top. */
  postHeight: number
  groundY: number
}

export interface ThemeParkLayout {
  arch: Arch | null
  path: PathRow[]
  stalls: Stall[]
  lightPoles: Pole[]
  lightWires: Wire[]
  bulbs: number[]
  buntingPoles: Pole[]
  buntingWires: Wire[]
  flags: Placement[]
  tents: (Placement & { color: number })[]
  hedges: Placement[]
  flagPoles: (Placement & { color: number })[]
}

export function wirePoint(w: Wire, u: number): [number, number, number] {
  const sag = 4 * w.sag * u * (1 - u)
  return [
    w.a[0] + (w.b[0] - w.a[0]) * u,
    w.a[1] + (w.b[1] - w.a[1]) * u - sag,
    w.a[2] + (w.b[2] - w.a[2]) * u,
  ]
}
