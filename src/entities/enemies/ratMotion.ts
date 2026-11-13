/**
 * A New York rat's scurry (#515): it darts in short dashes, stopping dead between them, each dash turned off its
 * heading alternately left and right, so it zig-zags along it. Pure, on game time: a pose is a function of the
 * seconds since it started, so a pause freezes it and the turntable can show any instant.
 */

export const RAT = {
  /** Seconds of one dash. */
  run: 0.32,
  /** Seconds stood still between dashes. */
  stop: 0.48,
  /** World units covered in one dash. */
  dash: 42,
  /** Radians each dash turns off the heading, left then right. */
  zig: 0.5,
  /** Seconds to swing round onto a new dash's heading. */
  turn: 0.08,
  /** Nose twitches per second. */
  twitchHz: 11,
  /** Tail swishes per second. */
  tailHz: 2.4,
  /** Strides per second while dashing (the body's hop). */
  strideHz: 9,
} as const

export const RAT_CYCLE = RAT.run + RAT.stop

export interface RatPose {
  /** Offset from where it started, world units. */
  x: number
  z: number
  /** Yaw of its +z (nose) direction: 0 faces +z. */
  heading: number
  running: boolean
  /** 0..1 stride hop, 0 when stopped. */
  hop: number
  /** -1..1: the nose twitch, small while dashing. */
  nose: number
  /** -1..1: the tail swish. */
  tail: number
}

export const newRatPose = (): RatPose => ({ x: 0, z: 0, heading: 0, running: false, hop: 0, nose: 0, tail: 0 })

/** Heading of dash `k`: even dashes turn left of `base`, odd ones right. */
export const dashHeading = (base: number, k: number) => base + (k % 2 === 0 ? RAT.zig : -RAT.zig)

/** 0..1 over a dash, starting and stopping at rest: a quick dart. */
const dashEase = (u: number) => u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)

/** The pose `t` seconds after it started scurrying along `base` (radians, 0 = +z), into `out`. */
export function ratPose(base: number, t: number, out: RatPose): RatPose {
  const time = Math.max(0, t)
  const k = Math.floor(time / RAT_CYCLE)
  const inCycle = time - k * RAT_CYCLE
  const running = inCycle < RAT.run
  const u = running ? inCycle / RAT.run : 1

  // Dashes done: ceil(k/2) to the left of base, floor(k/2) to the right.
  const left = Math.ceil(k / 2)
  const right = Math.floor(k / 2)
  const hL = dashHeading(base, 0)
  const hR = dashHeading(base, 1)
  const h = dashHeading(base, k)
  const d = RAT.dash * dashEase(u)
  out.x = RAT.dash * (left * Math.sin(hL) + right * Math.sin(hR)) + d * Math.sin(h)
  out.z = RAT.dash * (left * Math.cos(hL) + right * Math.cos(hR)) + d * Math.cos(h)

  const prev = k === 0 ? h : dashHeading(base, k - 1)
  out.heading = prev + (h - prev) * Math.min(1, inCycle / RAT.turn)
  out.running = running
  out.hop = running ? Math.abs(Math.sin(Math.PI * RAT.strideHz * time)) : 0
  out.nose = Math.sin(2 * Math.PI * RAT.twitchHz * time) * (running ? 0.3 : 1)
  out.tail = Math.sin(2 * Math.PI * RAT.tailHz * time)
  return out
}
