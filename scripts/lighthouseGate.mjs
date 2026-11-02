/** Lighthouse thresholds for `npm run lighthouse` (#193). Performance is reported, never gated. */
export const THRESHOLDS = { seo: 100, accessibility: 95, 'best-practices': 95 }

/** @param {Record<string, { scores: Record<string, number> }>} results  per form factor */
export function gateProblems(results) {
  const problems = []
  for (const [form, { scores }] of Object.entries(results)) {
    for (const [category, min] of Object.entries(THRESHOLDS)) {
      if (!(scores[category] >= min)) problems.push(`${form} ${category} ${scores[category]} < ${min}`)
    }
  }
  return problems
}
