/** `startPreview()`'s child (headless.mjs): `node scripts/previewServer.mjs <dist> <base>`, answers `{ port }` or `{ error }` over IPC. */
import { preview } from 'vite'

const [dist, base] = process.argv.slice(2)
process.on('disconnect', () => process.exit(0))

try {
  const server = await preview({
    base: `${base}/`,
    build: { outDir: dist },
    logLevel: 'error',
    preview: { host: 'localhost', port: 0, strictPort: true, open: false },
  })
  process.send({ port: server.httpServer.address().port })
} catch (e) {
  process.send({ error: e?.stack || String(e) }, () => process.exit(1))
}
