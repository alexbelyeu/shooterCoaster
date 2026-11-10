import { afterEach, expect } from 'vitest'

/**
 * Every unit test may make at most this many `expect()` calls. Each call costs microseconds, so a
 * test that asserts inside its sampling loops is slow in proportion to the runner: 960 000 calls
 * passed in 5 s locally and timed out at 8 s on CI (#492). Keep the worst value in plain numbers
 * inside the loops and assert once after them, with where it happened in the message.
 */
const MAX_ASSERTIONS_PER_TEST = 50_000

afterEach(() => {
  const calls = expect.getState().assertionCalls
  if (calls > MAX_ASSERTIONS_PER_TEST) {
    throw new Error(
      `${calls} expect() calls in one test (limit ${MAX_ASSERTIONS_PER_TEST}): it will time out on a slow runner. ` +
        'Track the worst value inside the loops and assert once after them.',
    )
  }
})
