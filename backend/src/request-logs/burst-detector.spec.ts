import { BurstDetector, type BurstVerdict } from './burst-detector';
import { BURST_ERROR_RATIO_THRESHOLD, BURST_MIN_REQUESTS } from './filters';

describe('BurstDetector', () => {
  let detector: BurstDetector;

  beforeEach(() => {
    detector = new BurstDetector();
  });

  it('does not drop requests below the minimum count', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS - 1; i++) {
      expect(detector.evaluate('1.2.3.4', '/x', 404)).toEqual({
        dropped: false,
        newlyFlagged: false,
      });
    }
  });

  it('drops a client once it crosses the count and error-ratio thresholds', () => {
    let verdict: BurstVerdict | undefined;
    for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
      verdict = detector.evaluate('1.2.3.4', `/probe-${i}`, 404);
    }
    expect(verdict?.dropped).toBe(true);
  });

  it('does not drop a busy but mostly-successful client', () => {
    const errorCount = Math.floor(
      (BURST_MIN_REQUESTS + 5) * (BURST_ERROR_RATIO_THRESHOLD - 0.1),
    );
    let verdict: BurstVerdict | undefined;
    for (let i = 0; i < BURST_MIN_REQUESTS + 5; i++) {
      const status = i < errorCount ? 404 : 200;
      verdict = detector.evaluate('1.2.3.4', `/route-${i}`, status);
    }
    expect(verdict?.dropped).toBe(false);
  });

  it('tracks each client IP independently', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
      detector.evaluate('1.1.1.1', `/probe-${i}`, 404);
    }

    expect(detector.evaluate('2.2.2.2', '/probe-0', 404).dropped).toBe(false);
  });

  it('never drops or flags a request with no client IP', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS + 5; i++) {
      expect(detector.evaluate(undefined, `/probe-${i}`, 404)).toEqual({
        dropped: false,
        newlyFlagged: false,
      });
    }
  });

  it('exempts the GitHub webhook path regardless of volume or status', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS + 20; i++) {
      expect(
        detector.evaluate('140.82.112.1', '/api/github/webhook', 404),
      ).toEqual({ dropped: false, newlyFlagged: false });
    }
  });

  it('reports newlyFlagged exactly once per burst', () => {
    const verdicts: BurstVerdict[] = [];
    for (let i = 0; i < BURST_MIN_REQUESTS + 5; i++) {
      verdicts.push(detector.evaluate('1.2.3.4', `/probe-${i}`, 404));
    }

    expect(verdicts.filter((v) => v.newlyFlagged)).toHaveLength(1);
    // the tripping request is the first dropped one
    expect(verdicts.findIndex((v) => v.dropped)).toBe(
      verdicts.findIndex((v) => v.newlyFlagged),
    );
    expect(verdicts.slice(BURST_MIN_REQUESTS - 1).every((v) => v.dropped)).toBe(
      true,
    );
  });

  it('can flag the same IP again after its window has cleared', () => {
    jest.useFakeTimers();
    try {
      for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
        detector.evaluate('1.2.3.4', `/probe-${i}`, 404);
      }

      jest.advanceTimersByTime(60_000);
      detector.prune();

      const verdicts: BurstVerdict[] = [];
      for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
        verdicts.push(detector.evaluate('1.2.3.4', `/again-${i}`, 404));
      }
      expect(verdicts.filter((v) => v.newlyFlagged)).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('prune removes IPs with no requests in the current window', () => {
    jest.useFakeTimers();
    try {
      for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
        detector.evaluate('1.2.3.4', `/probe-${i}`, 404);
      }

      jest.advanceTimersByTime(60_000);
      detector.prune();

      // window has fully elapsed, so this client starts fresh again
      for (let i = 0; i < BURST_MIN_REQUESTS - 1; i++) {
        expect(detector.evaluate('1.2.3.4', `/probe-${i}`, 404).dropped).toBe(
          false,
        );
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
