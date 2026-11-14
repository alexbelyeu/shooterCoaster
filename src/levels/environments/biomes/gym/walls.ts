/**
 * The gym's sport walls as climbable `WallSurface`s (#518, pure): Alaska, the Lagoon, the Shield and the Starr, where its
 * climbers (bystanders) go up. A surface is flat, so an overhanging profile gets the plane from its foot to its top,
 * stood off the foot far enough that no panel of the real profile comes through it.
 */
import type { WallSurface } from '@/types/level'
import { GYM_SCALE, PIECES, STAR, pieceAxes, pieceToBlockout, toWorld, type BlockoutPiece, type Panel } from './blockout'

type SportWall = Extract<BlockoutPiece, { kind: 'sport' | 'boulder' }>

const DEG = Math.PI / 180

/** The sport walls that get climbers; the Lagoon's south side and its auto belays stay clear. */
const CLIMBED = ['w-alaska-n', 'w-alaska-s', 'w-lagoon-n', 'w-lagoon-s', 'w-shield', 'w-starr'] as const

/** Metres either side of the Starr's centre kept clear: nobody climbs across the star. */
const STAR_CLEAR = STAR.radius + 1

/** The profile's top: its height and how far forward of the foot it ends; and how far it ever reaches past the chord to it. */
export function chordOf(profile: readonly Panel[]): { height: number; forward: number; standoff: number } {
  const joints = [{ y: 0, f: 0 }]
  for (const p of profile) {
    const last = joints[joints.length - 1]
    joints.push({ y: last.y + p.len * Math.cos(p.angle * DEG), f: last.f + p.len * Math.sin(p.angle * DEG) })
  }
  const top = joints[joints.length - 1]
  // Piecewise linear against a line: the furthest a panel gets in front of the chord is at a joint.
  const standoff = Math.max(0, ...joints.map((j) => j.f - (top.f * j.y) / top.y))
  return { height: top.y, forward: top.f, standoff }
}

/** One wall's surface over `from..to` metres along it (its centre at 0). */
function surface(p: SportWall, from: number, to: number, suffix = ''): WallSurface {
  const { height, forward, standoff } = chordOf(p.profile)
  const { along, facing } = pieceAxes(p.rot)
  const slant = Math.hypot(height, forward)
  const foot = pieceToBlockout(p, from, standoff)
  return {
    id: p.id + suffix,
    origin: toWorld({ x: foot.x, y: p.base, z: foot.z }),
    right: { x: along.x, y: 0, z: along.z },
    up: { x: (facing.x * forward) / slant, y: height / slant, z: (facing.z * forward) / slant },
    width: (to - from) * GYM_SCALE,
    height: slant * GYM_SCALE,
  }
}

function sportWall(id: string): SportWall {
  const p = PIECES.find((q) => q.id === id)
  if (p?.kind !== 'sport') throw new Error(`blockout has no sport wall "${id}"`)
  return p
}

/** Along the Starr wall, where the star's centre is. */
function starAlong(p: SportWall): number {
  const { along } = pieceAxes(p.rot)
  return (STAR.centre.x - p.x) * along.x + (STAR.centre.z - p.z) * along.z
}

export const GYM_WALLS: readonly WallSurface[] = CLIMBED.flatMap((id) => {
  const p = sportWall(id)
  const half = p.length / 2
  if (id !== 'w-starr') return [surface(p, -half, half)]
  const star = starAlong(p)
  return [surface(p, -half, star - STAR_CLEAR, '-left'), surface(p, star + STAR_CLEAR, half, '-right')]
})
