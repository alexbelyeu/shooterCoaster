import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Daily challenge: deterministic seed from date.
 * Same seed → same procedural track for all players.
 * Resets at midnight UTC.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const now = new Date()
  const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`

  // Simple hash for deterministic seed
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }

  // Generate track parameters from seed
  const seed = Math.abs(hash)
  const varA = (seed % 7) + 2          // 2-8
  const varB = ((seed >> 4) % 30) + 10 // 10-39
  const varC = ((seed >> 8) % 5) + 2   // 2-6
  const scalar = ((seed >> 12) % 50) + 20 // 20-69

  return res.status(200).json({
    date: dateStr,
    seed,
    track: { varA, varB, varC, scalar },
    expiresAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString(),
  })
}
