// node scripts/plot-gym-track.mjs [out.svg]: level 6's track (#514) over the gym blockout, a top and a side view,
// coloured by ride time, the four ride moments marked → e2e-results/gym-track.svg by default.
import { build } from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.resolve(process.argv[2] ?? path.join(root, 'e2e-results/gym-track.svg'))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-gym-'))
const bundle = path.join(tmp, 'gym.mjs')
await build({
  stdin: {
    contents: `export * from '@/levels/environments/biomes/gym/blockout'
export { GYM_TRACK } from '@/levels/environments/biomes/gym/gymTrack'
export { createTrackCurve } from '@/track/curves/createTrackCurve'
export { buildArcTable } from '@/track/arcLength'
export { rideProfile, rideSpeeds } from '@/track/ridePhysics'`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  alias: { '@': path.join(root, 'src') },
  outfile: bundle,
  logLevel: 'error',
})
const g = await import(pathToFileURL(bundle).href)
fs.rmSync(tmp, { recursive: true, force: true })

const curve = g.createTrackCurve(g.GYM_TRACK)
const table = g.buildArcTable(curve)
const profile = g.rideProfile(table, g.rideSpeeds(g.GYM_TRACK), 70)
const N = 300
const track = Array.from({ length: N }, (_, i) => {
  const p = curve.getPointAt(i / N)
  const s = (i / N) * table.length
  return { ...g.toBlockout({ x: p.x, y: p.y, z: p.z }), sec: profile.findIndex((d) => d >= s) / 10 }
})

const PX = 11
const PAD = 30
const W = (g.HALL.w + 4) * PX + 2 * PAD
/** The top view also shows what stands outside the hall's long walls (the training cave, the glass gym room). */
const Z0 = -11
const topH = (g.HALL.d + 12 - Z0) * PX
const sideY0 = -3
const sideH = (g.HALL.h - sideY0) * PX
const H = PAD + topH + 2 * PAD + sideH + PAD + 40
const sideTop = PAD + topH + 2 * PAD
const tx = (x) => PAD + x * PX
const tz = (z) => PAD + (z - Z0) * PX
const sy = (y) => sideTop + (g.HALL.h - y) * PX
const hue = (sec) => (sec > 60 ? '#999' : `hsl(${240 - (sec / 60) * 240} 85% 45%)`)

const parts = []
parts.push(`<rect x="${tx(0)}" y="${tz(0)}" width="${g.HALL.w * PX}" height="${g.HALL.d * PX}" fill="#f6f6f4" stroke="#333"/>`)
parts.push(`<rect x="${tx(g.PIT.minX)}" y="${tz(g.PIT.minZ)}" width="${(g.PIT.maxX - g.PIT.minX) * PX}" height="${(g.PIT.maxZ - g.PIT.minZ) * PX}" fill="#e2e2ee"/>`)
for (const b of g.BLOCKOUT_BOXES) {
  const c = [
    [b.minA, b.minF],
    [b.maxA, b.minF],
    [b.maxA, b.maxF],
    [b.minA, b.maxF],
  ].map(([a, f]) => g.pieceToBlockout(b, a, f))
  parts.push(`<polygon points="${c.map((p) => `${tx(p.x).toFixed(0)},${tz(p.z).toFixed(0)}`).join(' ')}" fill="#8888" stroke="#555" stroke-width="0.5"/>`)
  const xs = c.map((p) => p.x)
  if (b.maxY - b.minY > 1) {
    parts.push(`<rect x="${tx(Math.min(...xs)).toFixed(0)}" y="${sy(b.maxY).toFixed(0)}" width="${((Math.max(...xs) - Math.min(...xs)) * PX).toFixed(0)}" height="${((b.maxY - b.minY) * PX).toFixed(0)}" fill="#8883" stroke="#5556" stroke-width="0.5"/>`)
  }
}
parts.push(`<rect x="${tx(0)}" y="${sy(g.HALL.h)}" width="${g.HALL.w * PX}" height="${(g.HALL.h - sideY0) * PX}" fill="none" stroke="#333"/>`)
parts.push(`<polyline points="${tx(0)},${sy(g.PIT.floorY)} ${tx(g.PIT.maxX)},${sy(g.PIT.floorY)} ${tx(g.PIT.maxX)},${sy(0)} ${tx(g.HALL.w)},${sy(0)}" fill="none" stroke="#333" stroke-width="1.5"/>`)
// One polyline per second of ride, so the file stays small.
for (let start = 0; start < N; ) {
  let end = start + 1
  while (end < N && Math.floor(track[end].sec) === Math.floor(track[start].sec)) end++
  const run = track.slice(start, end + 1).concat(end === N ? [track[0]] : [])
  const colour = hue(track[start].sec)
  parts.push(`<polyline points="${run.map((p) => `${tx(p.x).toFixed(0)},${tz(p.z).toFixed(0)}`).join(' ')}" fill="none" stroke="${colour}" stroke-width="3"/>`)
  parts.push(`<polyline points="${run.map((p) => `${tx(p.x).toFixed(0)},${sy(p.y).toFixed(0)}`).join(' ')}" fill="none" stroke="${colour}" stroke-width="2"/>`)
  start = end
}
for (let sec = 0; sec <= 60; sec += 5) {
  const p = track.find((q) => q.sec >= sec)
  if (!p) continue
  parts.push(`<circle cx="${tx(p.x)}" cy="${tz(p.z)}" r="3.5" fill="#000"/><text x="${tx(p.x) + 5}" y="${tz(p.z) - 5}" font-size="11">${sec}s</text>`)
  parts.push(`<circle cx="${tx(p.x)}" cy="${sy(p.y)}" r="3" fill="#000"/><text x="${tx(p.x) + 4}" y="${sy(p.y) - 4}" font-size="10">${sec}s</text>`)
}
const label = (x, z, text) => `<text x="${tx(x)}" y="${tz(z)}" font-size="13" font-weight="bold" fill="#b00">${text}</text>`
parts.push(label(g.STAR.centre.x + 1, g.STAR.centre.z + 1, '★ Starr: the dive'))
parts.push(label(g.TREE.centre.x - 6, g.TREE.centre.z - 2, 'Tree climb'))
parts.push(label(g.FLAME.centre.x - 4, g.FLAME.centre.z + 1, 'Flame spiral'))
parts.push(label(g.ARCH.centre.x - 7, g.ARCH.centre.z - 4, 'Arch'))
parts.push(label(g.GLASS_ROOM.centre.x - 6, g.GLASS_ROOM.centre.z - 0.6, 'glass gym room'))
parts.push(`<text x="${PAD}" y="${PAD - 10}" font-size="14">Top view (x along the hall, Starr end left; z across, east on top). Colour = ride time, blue 0 s → red 60 s, grey after the run.</text>`)
parts.push(`<text x="${PAD}" y="${sideTop - 10}" font-size="14">Side view (x / height, m): the pit floor at ${g.PIT.floorY} m, ceiling ${g.HALL.h} m.</text>`)

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>${parts.join('')}</svg>\n`)
console.log(`wrote ${path.relative(root, out)}`)
