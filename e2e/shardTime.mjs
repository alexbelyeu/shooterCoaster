/**
 * The judgement on a --shard run's wall time against its budgets.json `smokeSeconds` (#353, #394).
 *
 * CI runners differ in speed: the same commit's level shard takes 1.0 min on one and 1.9 min on another, and the
 * time tracks how fast the runner renders (SwiftShader, on the CPU). The ride measures that as wall ms per rendered
 * frame; a slow runner's budget is scaled by how much slower than a normal one it rendered, up to
 * MAX_RUNNER_SLOWNESS. A shard with no ride (ui, menus, mobile, level1-steps) keeps its plain budget.
 *
 * Over that allowance is a warning, not a failure (#487: `ui shard took 2.1 min, budget 2.0` and `mobile 4.0 / 4.0`
 * failed runs with every check green): a shard fails only past FAIL_FACTOR times it. A slow creep is the watchdog's
 * `creep:` finding, which reads the trend instead of one run.
 */

/**
 * A normal CI runner's ride, wall ms per rendered frame: the fast cluster of the level shards' rides on ~35 CI runs
 * each, 2026-11-07..09 (263-318 ms; slow runners 440-545). Lowering it or raising MAX_RUNNER_SLOWNESS loosens every
 * level shard's budget, so it changes like a budget: the Director's call.
 */
export const NORMAL_RUNNER_MS_PER_FRAME = 300
/** The most a slow runner scales a budget by: the slowest CI ride seen ran 1.8x a normal one. */
export const MAX_RUNNER_SLOWNESS = 2
/** A shard fails only past this multiple of its allowance (the budget, scaled for a slow runner); up to it, it warns. */
export const FAIL_FACTOR = 1.5
/** CI stops a shard still running at this multiple of its budget, past the latest a slow runner may pass. */
export const WATCHDOG_FACTOR = MAX_RUNNER_SLOWNESS * FAIL_FACTOR * 1.15

/** Wall ms per rendered frame of the run's rides (the slowest, if more than one), or null with no ride. */
export function rideMsPerFrame(results) {
  const ms = results.map((r) => r.rideMsPerFrame).filter((v) => Number.isFinite(v) && v > 0)
  return ms.length ? Math.max(...ms) : null
}

/** How much slower than a normal CI runner this one rendered the ride: 1 (normal or faster) .. MAX_RUNNER_SLOWNESS. */
export function runnerSlowness(msPerFrame) {
  if (msPerFrame === null) return 1
  return Math.min(MAX_RUNNER_SLOWNESS, Math.max(1, msPerFrame / NORMAL_RUNNER_MS_PER_FRAME))
}

const min = (s) => (s / 60).toFixed(1)

/**
 * `ok` is false only when the shard ran past FAIL_FACTOR times its allowance on CI (`enforced`); `level` is its GitHub
 * annotation level. Over the plain budget but within that passes with a warning.
 */
export function judgeShardTime({ shard, seconds, budget, msPerFrame, enforced }) {
  const slowness = runnerSlowness(msPerFrame)
  const allowed = budget * slowness
  const failsAt = allowed * FAIL_FACTOR
  const judged = { slowness, allowed, failsAt }
  const base = `${shard} shard took ${min(seconds)} min, budget ${min(budget)}`
  const runner = slowness > 1 ? `slow runner (ride ${Math.round(msPerFrame)} ms/frame, ${slowness.toFixed(1)}x normal) allows ${min(allowed)}` : ''
  if (seconds <= budget) return { ok: true, level: 'notice', text: base, ...judged }
  if (seconds <= allowed) return { ok: true, level: 'warning', text: `${base}: over, within what a ${runner}`, ...judged }
  const text = runner ? `${base}, and a ${runner}` : base
  if (seconds <= failsAt) return { ok: true, level: 'warning', text: `${text}: over, fails past ${min(failsAt)}`, ...judged }
  if (!enforced) return { ok: true, level: 'warning', text: `${text} (over; enforced on CI only)`, ...judged }
  return { ok: false, level: 'error', text: `${text}, fails past ${min(failsAt)}`, ...judged }
}
