/** vite preview of `dist/` + headless SwiftShader Chromium (SC_CHROME), for the render scripts. */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

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

export async function startPreview() {
  // Another worktree's preview on the same port would silently serve the wrong build.
  let port, url
  for (let i = 0; i < 20; i++) {
    port = 4900 + Math.floor(Math.random() * 500)
    url = `http://localhost:${port}`
    if (!(await portInUse(url))) break
  }
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    detached: true, // own process group, for stopPreview()
  })
  let exited = false
  proc.on('exit', () => (exited = true))
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      if ((await fetch(url)).ok && !exited) return { url, proc }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  stopPreview(proc)
  throw new Error('vite preview did not start (did you run `npm run build`?)')
}

export function launchBrowser() {
  return chromium.launch({
    headless: true,
    executablePath: process.env.SC_CHROME || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  })
}
