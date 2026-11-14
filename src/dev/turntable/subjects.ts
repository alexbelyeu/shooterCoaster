import type { BiomeType, BossType, EnemyType } from '@/types/level'
import { CLIMB } from '@/entities/enemies/climbMotion'
import { RAT_CYCLE } from '@/entities/enemies/ratMotion'
import { DUST_BUNNY_BOUNCE } from '@/entities/enemies/dustBunnyMotion'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'

/**
 * What the enemy turntable (`turntable.html`, `npm run turntable`) shows and how. Pure, so its test runs in Node; the
 * specs are keyed by `EnemyType` and `BossType`, so an enemy or boss with no subject fails `tsc -b`.
 */
export type SubjectId = EnemyType | 'goldenBalloon' | BossType

export interface Subject {
  id: SubjectId
  kind: 'enemy' | 'boss'
  /** Turntable yaw (radians) that shows its face to the camera. */
  front: number
  /**
   * Its heading is cleared every frame, so it keeps facing `front`: 'model' is the first group inside the enemy
   * (a random or orbiting heading), 'root' the boss's root (turned towards the rider).
   */
  holdHeading?: 'model' | 'root'
  /** The motion strip: four frames from `from`, `span` game seconds apart in all (one cycle of its main motion). */
  motion: { from: number; span: number }
  /** False when nothing in it moves once its travel is cancelled (the strip's frames are then identical). */
  animated: boolean
  /** Drawn on a patch of climbing wall. */
  stage?: 'wall'
}

/** Game seconds of the rest pose on the sheet and the angle strips: every boss has risen, no golden balloon has expired (5 s). */
export const REST_TIME = 2

const cycle = (hz: number) => (2 * Math.PI) / hz
const at = (span: number, from = REST_TIME) => ({ from, span })

type Spec = Omit<Subject, 'id' | 'kind'>

/** Every enemy the spawner can mount, and the golden balloon. A `Record`, so a missing one fails `tsc -b`. */
const ENEMY_SUBJECTS: Record<EnemyType | 'goldenBalloon', Spec> = {
  balloon: { front: 0, motion: at(cycle(1.6)), animated: false },
  goldenBalloon: { front: 0, motion: at(cycle(3)), animated: false },
  crow: { front: 0, holdHeading: 'model', motion: at(cycle(5)), animated: true },
  scorpion: { front: 0, holdHeading: 'model', motion: at(cycle(2.5)), animated: true },
  shark: { front: 0, motion: at(cycle(4)), animated: true },
  jellyfish: { front: 0, motion: at(cycle(1.2)), animated: true },
  flyingFish: { front: 0, holdHeading: 'model', motion: at(1.5), animated: true },
  snowman: { front: 0, motion: at(cycle(3)), animated: true },
  snowmanScout: { front: 0, motion: at(cycle(3.5)), animated: true },
  snowmanBrute: { front: 0, motion: at(cycle(3)), animated: true },
  emberWisp: { front: 0, motion: at(cycle(2)), animated: true },
  lavaGolem: { front: 0, motion: at(cycle(2)), animated: true },
  fireImp: { front: 0, motion: at(cycle(4)), animated: true },
  infernalDrake: { front: 0, holdHeading: 'model', motion: at(cycle(3)), animated: true },
  // Its face is to the wall: `front` shows what the rider sees, its back. The strip is two moves, left hand then right.
  climber: { front: 0, motion: at(2 * (CLIMB.reach + CLIMB.pull + CLIMB.rest)), animated: true, stage: 'wall' },
  // One dash and the stop after it: dart, stop dead, nose twitching.
  rat: { front: 0, holdHeading: 'model', motion: at(RAT_CYCLE), animated: true },
  dustBunny: { front: 0, holdHeading: 'model', motion: at(DUST_BUNNY_BOUNCE), animated: true },
}

/** Every boss. A `Record`, so a missing one fails `tsc -b`. */
const BOSS_SUBJECTS: Record<BossType, Spec> = {
  // Its nose points along +x.
  goldenBlimp: { front: Math.PI / 2, motion: at(cycle(1.7)), animated: true },
  // From just before the first tentacle's slam (2.4 s) through its strike and hold.
  kraken: { front: 0, motion: at(1.6, 2.3), animated: true },
  // Through its first lunge (2.2 s): wound up, struck, recovering.
  giantScorpion: { front: 0, holdHeading: 'root', motion: at(2, 2.3), animated: true },
  // Roaring at rest (its arrival roar, 0.6–2.8 s); the strip is its first throw: wound up, released, following through.
  yeti: { front: 0, holdHeading: 'root', motion: at(1.2, 2.8), animated: true },
  // Its first beat (2.4 s): the two pounds on its chest, then the plates parted on the heart.
  magmaTitan: { front: 0, holdHeading: 'root', motion: at(1.2, 2.4), animated: true },
  // Risen with her first four snakes out; the strip is one strike cycle of theirs, taking turns.
  medusa: { front: 0, holdHeading: 'root', motion: at(3), animated: true },
}

const subjectsOf = <K extends SubjectId>(kind: Subject['kind'], specs: Record<K, Spec>): Subject[] =>
  (Object.entries(specs) as [K, Spec][]).map(([id, spec]) => ({ id, kind, ...spec }))

export const SUBJECTS: readonly Subject[] = [...subjectsOf('enemy', ENEMY_SUBJECTS), ...subjectsOf('boss', BOSS_SUBJECTS)]

export const subjectById = (id: string): Subject | undefined => SUBJECTS.find((s) => s.id === id)

/** Turned from `front`, in the order the angle strip shows them. */
export const ANGLES: readonly { label: string; yaw: number }[] = [
  { label: 'front', yaw: 0 },
  { label: 'side', yaw: Math.PI / 2 },
  { label: 'back', yaw: Math.PI },
  { label: '3/4', yaw: Math.PI / 4 },
]

const THREE_QUARTER = ANGLES[3].yaw

export type Board =
  | { kind: 'sheet'; yaw: number }
  | { kind: 'angles'; id: SubjectId }
  | { kind: 'motion'; id: SubjectId }

export interface Cell {
  subject: Subject
  /** What the cell is: its angle or game time. */
  caption: string
  /** Turntable yaw, `front` included. */
  yaw: number
  /** Game seconds; a board's cells are in non-decreasing time order. */
  time: number
}

export const MOTION_FRAMES = 4

export function boardCells(board: Board): Cell[] {
  if (board.kind === 'sheet') {
    return SUBJECTS.map((subject) => ({ subject, caption: subject.kind, yaw: subject.front + board.yaw, time: REST_TIME }))
  }
  const subject = subjectById(board.id)
  if (!subject) throw new Error(`unknown turntable subject: ${board.id}`)
  if (board.kind === 'angles') {
    return ANGLES.map((a) => ({ subject, caption: a.label, yaw: subject.front + a.yaw, time: REST_TIME }))
  }
  return Array.from({ length: MOTION_FRAMES }, (_, k) => {
    const time = subject.motion.from + (subject.motion.span * k) / MOTION_FRAMES
    return { subject, caption: `t = ${time.toFixed(2)} s`, yaw: subject.front + THREE_QUARTER, time }
  })
}

export const boardName = (board: Board): string => (board.kind === 'sheet' ? 'sheet' : `${board.id}-${board.kind}`)

/** Page layout in CSS pixels: the script sizes the browser window to `boardSize`. */
export const LAYOUT = { pad: 16, gap: 12, header: 40, label: 26 } as const

/** Cells per row and a cell's square side in CSS pixels. */
export function boardGrid(board: Board): { columns: number; cellPx: number } {
  return board.kind === 'sheet' ? { columns: 6, cellPx: 300 } : { columns: 4, cellPx: 400 }
}

export function boardSize(board: Board): { width: number; height: number } {
  const { columns, cellPx } = boardGrid(board)
  const rows = Math.ceil(boardCells(board).length / columns)
  const { pad, gap, header, label } = LAYOUT
  return {
    width: 2 * pad + columns * cellPx + (columns - 1) * gap,
    height: 2 * pad + header + rows * (label + cellPx) + (rows - 1) * gap,
  }
}

const BIOMES = Object.keys(ATMOSPHERES) as BiomeType[]

export interface TurntableQuery {
  board: Board
  /** Light it with this biome's atmosphere instead of the studio. */
  biome: BiomeType | null
}

/** `?enemy=<id>` (its angle strip; `&animate=1` its motion strip), else the sheet turned `?yaw=` radians from 3/4; `?biome=<id>`. */
export function parseQuery(search: string): TurntableQuery {
  const q = new URLSearchParams(search)
  const id = q.get('enemy')
  const biomeParam = q.get('biome')
  const biome = BIOMES.find((b) => b === biomeParam) ?? null
  const subject = id ? subjectById(id) : undefined
  if (subject) return { board: { kind: q.get('animate') === '1' ? 'motion' : 'angles', id: subject.id }, biome }
  const yaw = Number(q.get('yaw'))
  return { board: { kind: 'sheet', yaw: q.has('yaw') && Number.isFinite(yaw) ? yaw : THREE_QUARTER }, biome }
}
