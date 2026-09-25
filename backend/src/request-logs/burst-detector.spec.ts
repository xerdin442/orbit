import { BurstDetector, type BurstVerdict } from './burst-detector';
import { BURST_ERROR_RATIO_THRESHOLD, BURST_MIN_REQUESTS } from './filters';

describe('BurstDetector', () => {
  let detector: BurstDetector;

  beforeEach(() => {
    detector = new BurstDetector();
  });

  it('does not flag requests below the minimum count', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS - 1; i++) {
      expect(detector.isBurst('1.2.3.4', '/x', 404)).toBe(false);
    }
  });

  it('flags a client once it crosses the count and error-ratio thresholds', () => {
    let flagged = false;
    for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
      flagged = detector.isBurst('1.2.3.4', `/probe-${i}`, 404);
    }
    expect(flagged).toBe(true);
  });

  it('does not flag a busy but mostly-successful client', () => {
    const errorCount = Math.floor(
      (BURST_MIN_REQUESTS + 5) * (BURST_ERROR_RATIO_THRESHOLD - 0.1),
    );
    let flagged = false;
    for (let i = 0; i < BURST_MIN_REQUESTS + 5; i++) {
      const status = i < errorCount ? 404 : 200;
      flagged = detector.isBurst('1.2.3.4', `/route-${i}`, status);
    }
    expect(flagged).toBe(false);
  });

  it('tracks each client IP independently', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
      detector.isBurst('1.1.1.1', `/probe-${i}`, 404);
    }

    expect(detector.isBurst('2.2.2.2', '/probe-0', 404)).toBe(false);
  });

  it('never flags a request with no client IP', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS + 5; i++) {
      expect(detector.isBurst(undefined, `/probe-${i}`, 404)).toBe(false);
    }
  });

  it('exempts the GitHub webhook path regardless of volume', () => {
    for (let i = 0; i < BURST_MIN_REQUESTS + 20; i++) {
      expect(detector.isBurst('140.82.112.1', '/api/github/webhook', 200)).toBe(
        false,
      );
    }
  });

  describe('evaluate', () => {
    it('reports newlyFlagged exactly once per burst', () => {
      const verdicts: BurstVerdict[] = [];
      for (let i = 0; i < BURST_MIN_REQUESTS + 5; i++) {
        verdicts.push(detector.evaluate('1.2.3.4', `/probe-${i}`, 404));
      }

      const flagged = verdicts.filter((v) => v.newlyFlagged);
      expect(flagged).toHaveLength(1);
      // the tripping request is the first dropped one
      expect(verdicts.findIndex((v) => v.dropped)).toBe(
        verdicts.findIndex((v) => v.newlyFlagged),
      );
      expect(
        verdicts.slice(BURST_MIN_REQUESTS - 1).every((v) => v.dropped),
      ).toBe(true);
    });

    it('never reports newlyFlagged for exempt paths or missing IPs', () => {
      for (let i = 0; i < BURST_MIN_REQUESTS + 5; i++) {
        expect(detector.evaluate(undefined, '/x', 404).newlyFlagged).toBe(
          false,
        );
        expect(
          detector.evaluate('1.2.3.4', '/api/github/webhook', 404).newlyFlagged,
        ).toBe(false);
      }
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
  });

  it('prune removes IPs with no requests in the current window', () => {
    jest.useFakeTimers();
    try {
      for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
        detector.isBurst('1.2.3.4', `/probe-${i}`, 404);
      }

      jest.advanceTimersByTime(60_000);
      detector.prune();

      // window has fully elapsed, so this client starts fresh again
      for (let i = 0; i < BURST_MIN_REQUESTS - 1; i++) {
        expect(detector.isBurst('1.2.3.4', `/probe-${i}`, 404)).toBe(false);
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
