/**
 * Whether Vercel Web Analytics may run on this page load. Only real player traffic
 * counts: a build made by Vercel (where `/_vercel/insights` exists) and not a test run
 * (`?e2e=1`, used by CI and the nightly production smoke).
 */
export function analyticsEnabled(builtOnVercel: boolean, search: string): boolean {
  return builtOnVercel && !new URLSearchParams(search).has('e2e')
}
