import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Ghost run recording endpoint.
 * Accepts compressed frame data: [{t, progress, aimX, aimY, fired}]
 * In production, store in Vercel KV with TTL.
 */

const ghostRuns: Record<string, unknown[]> = {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { level, name, frames, score } = req.body as {
    level: string
    name: string
    frames: Array<{ t: number; progress: number; aimX: number; aimY: number; fired: boolean }>
    score: number
  }

  if (!level || !name || !frames) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const key = `${level}:${name}`
  ghostRuns[key] = frames

  return res.status(200).json({ success: true, frameCount: frames.length })
}
