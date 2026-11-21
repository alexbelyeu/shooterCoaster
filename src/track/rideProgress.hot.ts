/** The coaster's track parameter t on its last frame, from `CoasterCamera`: unlike the nearest track point, unambiguous where the track crosses itself. */
let t = 0
/** The seat's world x, z on the route ridden, for the track radar (#834). */
let seatX = 0
let seatZ = 0

export function rideProgress(): number {
  return t
}

export function setRideProgress(value: number): void {
  t = value
}

export function rideSeatX(): number {
  return seatX
}

export function rideSeatZ(): number {
  return seatZ
}

export function setRideSeat(x: number, z: number): void {
  seatX = x
  seatZ = z
}
