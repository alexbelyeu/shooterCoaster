/** `?perf=1` (#536): the hitch recorder and its panel, for this page load only. Nothing is stored or sent. */
const requested = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === '1'

export const perfRequested = () => requested
