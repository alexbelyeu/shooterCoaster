import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { flickerSpikes, pngLuma, regionMeans } from './flicker.mjs'

const frame = (t: number, value: (x: number, y: number) => number) => {
  const width = 16
  const height = 12
  const luma = new Float32Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) luma[y * width + x] = value(x, y)
  return { t, width, height, luma }
}

describe('flicker', () => {
  it('averages each region', () => {
    const m = regionMeans(frame(0, (x) => (x < 8 ? 0 : 100)))
    expect(m[0]).toBe(0)
    expect(m[7]).toBe(100)
  })

  it('finds a region that lights up for one step and goes back', () => {
    const base = 60
    const probes = [0, 1, 2, 3, 4, 5].map((i) => frame(i / 10, (x, y) => (i === 2 && y < 2 && x < 2 ? base + 80 : base)))
    const spikes = flickerSpikes(probes)
    expect(spikes).toHaveLength(1)
    expect(spikes[0]).toMatchObject({ region: 'top 1/8', count: 1, first: 0.2 })
  })

  it('a steady fade or a lasting change is no flicker', () => {
    const fade = [0, 1, 2, 3, 4, 5].map((i) => frame(i / 10, () => 40 + i * 25))
    const change = [0, 1, 2, 3].map((i) => frame(i / 10, () => (i >= 2 ? 160 : 40)))
    expect(flickerSpikes(fade)).toEqual([])
    expect(flickerSpikes(change)).toEqual([])
  })
})

/** A 3x2 RGB PNG, each row under its own filter (Sub, then Paeth), to exercise the unfiltering. */
function png(rows: number[][][], filters: number[]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(rows[0].length, 0)
  ihdr.writeUInt32BE(rows.length, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw: number[] = []
  let prev: number[] = new Array(rows[0].length * 3).fill(0)
  rows.forEach((r, y) => {
    const line = r.flat()
    raw.push(filters[y])
    line.forEach((v, i) => {
      const a = i >= 3 ? line[i - 3] : 0
      const b = prev[i]
      const c = i >= 3 ? prev[i - 3] : 0
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      const pred = filters[y] === 1 ? a : filters[y] === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0
      raw.push((v - pred) & 255)
    })
    prev = line
  })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))])
}

describe('pngLuma', () => {
  it('decodes filtered RGB rows to luma', () => {
    const white = [255, 255, 255]
    const black = [0, 0, 0]
    const red = [255, 0, 0]
    const { width, height, luma } = pngLuma(png([[white, black, red], [red, white, black]], [1, 4]))
    expect([width, height]).toEqual([3, 2])
    expect(Array.from(luma).map((v) => Math.round(v))).toEqual([255, 0, 54, 54, 255, 0])
  })

  it('refuses a PNG it cannot read', () => {
    const buf = png([[[0, 0, 0]]], [0])
    buf[24] = 16
    expect(() => pngLuma(buf)).toThrow(/unsupported/)
  })
})
