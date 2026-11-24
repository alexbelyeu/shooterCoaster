/**
 * One smoke step, run so that a throw fails that step alone and the run goes on to the next (#707). The 11-23 nightly's
 * `main` part lost every step after `daily` to one `net::ERR_CONNECTION_RESET` from production, because the throw
 * escaped `run()`. A throw still fails the run, as a check named for the step (`threw: <message>`). Browser contexts the
 * step opened are closed, so a page left mid-level doesn't load the steps after it. `e2e/prod-check.mjs` `check` does
 * the same for the deploy check.
 *
 * `browser` is anything with `contexts()` (Playwright's `Browser`). Returns the step's result, with `seconds` set.
 */
export async function runStep(fn, { id, level, browser }) {
  const started = Date.now()
  const before = new Set(browser.contexts())
  let r
  try {
    r = await fn()
  } catch (e) {
    console.error(`step ${id}${level ? ` (${level})` : ''} threw:`, e)
    await Promise.all(browser.contexts().filter((c) => !before.has(c)).map((c) => c.close().catch(() => {})))
    r = { id, ...(level ? { level } : {}), ok: false, threw: true, problems: [`threw: ${String(e?.message ?? e).split('\n')[0]}`], errors: [] }
  }
  r.seconds ??= (Date.now() - started) / 1000
  return r
}
