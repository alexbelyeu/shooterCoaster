/** vite preview of a build + headless SwiftShader Chromium (SC_CHROME), for the smoke and the render scripts. */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** `--name value` on the command line; a bare `--name` (last, or before another flag) is 'true'; `fallback` when absent. */
export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? 'true' : value
}

export function stopPreview(proc) {
  proc.kill()
}

/**
 * Serves `dist` under `base` ('' for the site root, '/nested/path' for the portal build); `url` has no trailing slash.
 * The OS picks the port as the server binds and it reports ready over IPC: a random port probed first could be taken in between (#400).
 */
export async function startPreview({ dist = 'dist', base = '', page = '/' } = {}) {
  const proc = spawn(process.execPath, [fileURLToPath(new URL('./previewServer.mjs', import.meta.url)), dist, base], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  let stderr = ''
  proc.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)))
  const fail = (why) => {
    stopPreview(proc)
    return new Error(`vite preview of ${dist}/ did not start: ${why}${stderr.trim() ? `\n${stderr.trim()}` : ''}`)
  }
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(fail('no answer in 30 s')), 30_000)
    proc.on('message', (m) => {
      clearTimeout(timer)
      if (m.error) reject(fail(m.error))
      else resolve(m.port)
    })
    proc.on('exit', (code, signal) => {
      clearTimeout(timer)
      reject(fail(`exited (${signal ?? code})`))
    })
  })
  const url = `http://localhost:${port}${base}`
  const res = await fetch(`${url}${page}`).catch((e) => ({ ok: false, status: e.cause?.code ?? e.message }))
  if (!res.ok) throw fail(`${url}${page} answered ${res.status} (did you build ${dist}/?)`)
  // A script that ends without stopPreview() still exits; the child follows when its IPC channel closes.
  proc.unref()
  proc.channel.unref()
  proc.stderr.unref?.()
  return { url, proc }
}

/**
 * Playwright's own SIGTERM handler closes the browser but leaves the script running: a smoke poll that
 * swallows "browser has been closed" then runs to its own deadline, so `timeout 270` overran by minutes
 * (#475). Ours closes the browser and exits 143; a stuck close gets 5 s.
 */
export async function launchBrowser(extraArgs = []) {
  const browser = await chromium.launch({
    headless: true,
    handleSIGTERM: false,
    executablePath: process.env.SC_CHROME || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', ...extraArgs],
  })
  process.once('SIGTERM', () => {
    setTimeout(() => process.exit(143), 5000).unref()
    browser.close().finally(() => process.exit(143))
  })
  return browser
}
