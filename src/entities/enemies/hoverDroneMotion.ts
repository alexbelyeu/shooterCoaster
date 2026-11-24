/**
 * A hover drone's drift round its spot (`HoverDrone.tsx`, #323): a figure-eight `SWING.x` either way along x and
 * `SWING.z` across z, narrow so a drone placed on a street's centre line stays inside the street; `BOB` up and down.
 */
export const DRONE_SWING = { x: 40, z: 12 } as const
export const DRONE_BOB = 4
/** Half the puck's width at the drone's scale: its body clears a facade by this past the swing. */
const PUCK_HALF = 20

/** How far a drone's spot must stay from a tower's faces and above its roof (`cityLayout.ts` `clearOfTowers`). */
export const DRONE_CLEARANCE = { x: DRONE_SWING.x + PUCK_HALF, y: DRONE_BOB + PUCK_HALF, z: DRONE_SWING.z + PUCK_HALF } as const
