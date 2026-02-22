const BASE_URL = ''

export async function submitScore(level: string, name: string, score: number) {
  try {
    const res = await fetch(`${BASE_URL}/api/leaderboard/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, name, score }),
    })
    return res.json()
  } catch {
    return null
  }
}

export async function getTopScores(level: string, limit = 10) {
  try {
    const res = await fetch(`${BASE_URL}/api/leaderboard/top?level=${level}&limit=${limit}`)
    return res.json()
  } catch {
    return { scores: [] }
  }
}

export async function getDailyChallenge() {
  try {
    const res = await fetch(`${BASE_URL}/api/daily/seed`)
    return res.json()
  } catch {
    return null
  }
}

export async function submitGhostRun(
  level: string,
  name: string,
  frames: Array<{ t: number; progress: number; aimX: number; aimY: number; fired: boolean }>,
  score: number,
) {
  try {
    const res = await fetch(`${BASE_URL}/api/ghost/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, name, frames, score }),
    })
    return res.json()
  } catch {
    return null
  }
}
