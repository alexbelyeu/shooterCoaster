/** The track radar's geometry (#834): world XZ seen from above, +z down the page, fitted into the radar's box. */

export interface RadarFit {
  scale: number
  offsetX: number
  offsetY: number
  width: number
  height: number
}

/** The box's short side is at least this share of its long side, so a long thin track keeps room for enemies beside it. */
const MIN_SIDE_SHARE = 0.6

interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function boundsOf(paths: readonly Float32Array[]): Bounds {
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  for (const xz of paths) {
    for (let i = 0; i + 1 < xz.length; i += 2) {
      b.minX = Math.min(b.minX, xz[i])
      b.maxX = Math.max(b.maxX, xz[i])
      b.minZ = Math.min(b.minZ, xz[i + 1])
      b.maxZ = Math.max(b.maxZ, xz[i + 1])
    }
  }
  return b
}

/** The box follows the track's shape. */
export function radarBox(paths: readonly Float32Array[], longSide: number): { width: number; height: number } {
  const b = boundsOf(paths)
  const dx = Math.max(b.maxX - b.minX, 1e-6)
  const dz = Math.max(b.maxZ - b.minZ, 1e-6)
  const short = Math.round(longSide * Math.max(MIN_SIDE_SHARE, Math.min(dx, dz) / Math.max(dx, dz)))
  return dx >= dz ? { width: longSide, height: short } : { width: short, height: longSide }
}

/** One scale for both axes, centred, `padding` px clear on every side. */
export function fitRadar(paths: readonly Float32Array[], width: number, height: number, padding: number): RadarFit {
  const b = boundsOf(paths)
  const dx = Math.max(b.maxX - b.minX, 1e-6)
  const dz = Math.max(b.maxZ - b.minZ, 1e-6)
  const scale = Math.min((width - 2 * padding) / dx, (height - 2 * padding) / dz)
  return {
    scale,
    offsetX: width / 2 - ((b.minX + b.maxX) / 2) * scale,
    offsetY: height / 2 - ((b.minZ + b.maxZ) / 2) * scale,
    width,
    height,
  }
}

export function radarX(fit: RadarFit, x: number): number {
  return x * fit.scale + fit.offsetX
}

export function radarY(fit: RadarFit, z: number): number {
  return z * fit.scale + fit.offsetY
}

/** An enemy far off the track is left off rather than pinned to the edge. */
export function inRadar(fit: RadarFit, px: number, py: number): boolean {
  return px >= 0 && py >= 0 && px <= fit.width && py <= fit.height
}

/** The box's long side in CSS px. */
export function radarLongSide(viewWidth: number, viewHeight: number): number {
  return Math.round(Math.min(150, Math.max(84, Math.min(viewWidth, viewHeight) * 0.24)))
}

/** Landscape only: held upright, a phone has no corner to spare. */
export function radarShown(viewWidth: number, viewHeight: number): boolean {
  return viewWidth > viewHeight
}
