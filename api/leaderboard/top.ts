import type { VercelRequest, VercelResponse } from '@vercel/node'

// Placeholder in-memory store — replace with Vercel KV in production
const scores: Record<string, { name: string; score: number; timestamp: number }[]> = {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const level = req.query.level as string
  const limit = parseInt(req.query.limit as string) || 10

  if (!level) {
    return res.status(400).json({ error: 'Missing level parameter' })
  }

  const levelScores = (scores[level] || []).slice(0, limit)

  return res.status(200).json({ scores: levelScores })
}
