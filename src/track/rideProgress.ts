/** The coaster's track parameter t on its last frame, from `CoasterCamera`: unlike the nearest track point, unambiguous where the track crosses itself. */
let t = 0

export function rideProgress(): number {
  return t
}

export function setRideProgress(value: number): void {
  t = value
}
