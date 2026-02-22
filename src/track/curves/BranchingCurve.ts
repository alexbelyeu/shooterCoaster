import * as THREE from 'three'
import type { TrackCurve } from './TrackCurve'

interface BranchPoint {
  t: number // Position on main track where branch starts [0, 1]
  curve: TrackCurve // The branch curve
  duration: number // How long the branch lasts (as fraction of main track)
}

/**
 * Phase 8 stretch: Hub-and-spoke branching track.
 * At specified t values, the player can choose to take a detour
 * that rejoins the main track at t + duration.
 */
export function createBranchingCurve(
  mainCurve: TrackCurve,
  branches: BranchPoint[],
): {
  mainCurve: TrackCurve
  branches: BranchPoint[]
  getActiveCurve: (progress: number, branchIndex: number | null) => TrackCurve
} {
  return {
    mainCurve,
    branches,
    getActiveCurve(progress: number, branchIndex: number | null): TrackCurve {
      if (branchIndex !== null && branchIndex < branches.length) {
        const branch = branches[branchIndex]
        if (progress >= branch.t && progress < branch.t + branch.duration) {
          return branch.curve
        }
      }
      return mainCurve
    },
  }
}
