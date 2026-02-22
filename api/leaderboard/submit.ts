import type { VercelRequest, VercelResponse } from '@vercel/node'

// In production, use Vercel KV (Redis-compatible sorted sets)
// For now, use in-memory store as placeholder
const scores: Record<string, { name: string; score: number; timestamp: number }[]> = {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { level, name, score } = req.body as {
    level: string
    name: string
    score: number
  }

  if (!level || !name || typeof score !== 'number') {
    return res.status(400).json({ error: 'Missing level, name, or score' })
  }

  if (!scores[level]) scores[level] = []

  scores[level].push({ name, score, timestamp: Date.now() })
  scores[level].sort((a, b) => b.score - a.score)
  scores[level] = scores[level].slice(0, 100) // keep top 100

  return res.status(200).json({ success: true, rank: scores[level].findIndex((s) => s.name === name && s.score === score) + 1 })
}
