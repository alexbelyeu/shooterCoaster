/** vite preview of a build + headless SwiftShader Chromium (SC_CHROME), for the smoke and the render scripts. */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

/** `--name value` on the command line; a bare `--name` (last, or before another flag) is 'true'; `fallback` when absent. */
export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? 'true' : value
}

const portInUse = async (url) => {
  try {
    await fetch(url)
    return true
  } catch {
    return false
  }
}

/** Kill the whole `npx → sh → vite` process group (killing npx alone leaks vite). */
export function stopPreview(proc) {
  try {
    process.kill(-proc.pid, 'SIGTERM')
  } catch {
    proc.kill()
  }
}

/** Serves `dist` under `base` ('' for the site root, '/nested/path' for the portal build); `url` has no trailing slash. */
export async function startPreview({ dist = 'dist', base = '' } = {}) {
  // Another worktree's preview on the same port would silently serve the wrong build.
  let port, origin
  for (let i = 0; i < 20; i++) {
    port = 4173 + Math.floor(Math.random() * 1000)
    origin = `http://localhost:${port}`
    if (!(await portInUse(origin))) break
  }
  const url = `${origin}${base}`
  // Nothing reads vite's output; an unread pipe can fill up and stall the server.
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', dist, '--base', `${base}/`], {
    stdio: 'ignore',
    detached: true, // own process group, for stopPreview()
  })
  let exited = false
  proc.on('exit', () => (exited = true))
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      if ((await fetch(`${url}/`)).ok && !exited) return { url, proc }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  stopPreview(proc)
  throw new Error(`vite preview did not start (did you build ${dist}/?)`)
}

export function launchBrowser(extraArgs = []) {
  return chromium.launch({
    headless: true,
    executablePath: process.env.SC_CHROME || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', ...extraArgs],
  })
}
