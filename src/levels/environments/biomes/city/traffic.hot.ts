import { SINK, type Traffic } from './trafficPaths'

/** How deep a car `s` along a run of `length` sits under the road: 0 except within `SINK.length` of either end. */
export function sinkAt(s: number, length: number): number {
  const edge = Math.min(s, length - s)
  return edge >= SINK.length ? 0 : SINK.depth * (1 - Math.max(0, edge) / SINK.length)
}

/** The first `count` cars at time `t` (s) into an instance-matrix array; the car model's nose is +z. */
export function writeTraffic(traffic: Traffic, count: number, t: number, out: Float32Array): void {
  const { start, dir, run } = traffic
  for (let i = 0; i < count; i++) {
    const length = run[i * 3]
    const s = (run[i * 3 + 1] + run[i * 3 + 2] * t) % length
    const dx = dir[i * 2]
    const dz = dir[i * 2 + 1]
    const o = i * 16
    // Yaw atan2(dx, dz) about +y: cos = dz, sin = dx
    out[o] = dz
    out[o + 1] = 0
    out[o + 2] = -dx
    out[o + 3] = 0
    out[o + 4] = 0
    out[o + 5] = 1
    out[o + 6] = 0
    out[o + 7] = 0
    out[o + 8] = dx
    out[o + 9] = 0
    out[o + 10] = dz
    out[o + 11] = 0
    out[o + 12] = start[i * 3] + dx * s
    out[o + 13] = start[i * 3 + 1] - sinkAt(s, length)
    out[o + 14] = start[i * 3 + 2] + dz * s
    out[o + 15] = 1
  }
}
