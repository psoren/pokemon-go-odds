import { describe, expect, it } from 'vitest';
import {
  UNCERTAIN_SPREAD_POINTS,
  assessLuck,
  assessLuckRange,
  gammaP,
  impliedLambdaForMedian,
  ordinal,
  poissonAt,
  poissonCdf,
} from './percentile';
import { poissonPmf } from './math';
import type { Trial } from './types';

/** A trial list with a given total lambda, in the regime this app lives in. */
const trialsWithLambda = (lambda: number, n = 100_000): Trial[] => [{ n, p: lambda / n }];

describe('regularized incomplete gamma', () => {
  it('is 0 at x=0 and approaches 1 for large x', () => {
    expect(gammaP(3, 0)).toBe(0);
    expect(gammaP(3, 200)).toBeCloseTo(1, 12);
  });

  it('matches the exponential special case P(1, x) = 1 - e^-x', () => {
    for (const x of [0.1, 0.5, 1, 3, 10]) {
      expect(gammaP(1, x)).toBeCloseTo(1 - Math.exp(-x), 10);
    }
  });

  it('is monotonically increasing in x', () => {
    let prev = -1;
    for (let x = 0.1; x < 30; x += 0.3) {
      const v = gammaP(5, x);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('Poisson CDF', () => {
  it('agrees with a direct sum of the pmf for moderate lambda', () => {
    for (const lambda of [0.71, 3.2, 12, 40]) {
      const pmf = poissonPmf(lambda, 200);
      let running = 0;
      for (let k = 0; k <= 60; k++) {
        running += pmf[k];
        expect(poissonCdf(lambda, k), `λ=${lambda} k=${k}`).toBeCloseTo(running, 9);
      }
    }
  });

  it('stays in [0, 1] for large lambda where a naive sum would underflow', () => {
    for (const k of [0, 100, 400, 500, 2000]) {
      const v = poissonCdf(800, k);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // The median of Poisson(800) is ~800.
    expect(poissonCdf(800, 800)).toBeGreaterThan(0.45);
    expect(poissonCdf(800, 800)).toBeLessThan(0.55);
  });

  it('matches the known pmf at a point', () => {
    expect(poissonAt(0.71, 0)).toBeCloseTo(0.4916, 4);
    expect(poissonAt(0.71, 1)).toBeCloseTo(0.3491, 4);
    expect(poissonAt(0.71, 2)).toBeCloseTo(0.1239, 4);
  });
});

describe('assessLuck', () => {
  it('puts the mean near the 50th percentile', () => {
    const r = assessLuck(trialsWithLambda(100), 100);
    expect(r.percentile).toBeGreaterThan(45);
    expect(r.percentile).toBeLessThan(55);
  });

  it('reports P(<=) and P(>=) that overlap by exactly P(=)', () => {
    const r = assessLuck(trialsWithLambda(4), 4);
    expect(r.pAtMost + r.pAtLeast - r.pExactly).toBeCloseTo(1, 9);
  });

  it('uses the mid-P convention so a modal zero is not overstated', () => {
    // λ = 0.9: zero is the single most likely outcome, so it should land near
    // the middle of the distribution, not near the bottom.
    const r = assessLuck(trialsWithLambda(0.9), 0);
    // Binomial(100k, 9e-6) rather than an exact Poisson, so allow a little slack.
    expect(r.percentile).toBeCloseTo(0.5 * Math.exp(-0.9) * 100, 3);
    expect(r.percentile).toBeGreaterThan(15);
    expect(r.percentile).toBeLessThan(25);
  });

  it('ranks a high observation above a low one', () => {
    const lo = assessLuck(trialsWithLambda(50), 30).percentile;
    const mid = assessLuck(trialsWithLambda(50), 50).percentile;
    const hi = assessLuck(trialsWithLambda(50), 75).percentile;
    expect(lo).toBeLessThan(mid);
    expect(mid).toBeLessThan(hi);
  });

  it('switches to the Poisson path only above the exact threshold', () => {
    expect(assessLuck(trialsWithLambda(300), 300).method).toBe('exact');
    expect(assessLuck(trialsWithLambda(400), 400).method).toBe('poisson');
  });

  it('agrees across both paths at the boundary', () => {
    // Same observation, one either side of the cutover, should be continuous.
    const a = assessLuck(trialsWithLambda(305), 300);
    const b = assessLuck(trialsWithLambda(305), 301);
    expect(Math.abs(a.percentile - b.percentile)).toBeLessThan(4);
  });

  it('never returns a probability outside [0, 1]', () => {
    for (const obs of [0, 1, 10, 500, 5000]) {
      for (const lambda of [0.01, 1, 100, 900]) {
        const r = assessLuck(trialsWithLambda(lambda), obs);
        for (const p of [r.pAtMost, r.pAtLeast, r.pExactly]) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
        expect(r.percentile).toBeGreaterThanOrEqual(0);
        expect(r.percentile).toBeLessThanOrEqual(100);
      }
    }
  });

  it('handles an empty model without dividing by zero', () => {
    const r = assessLuck([], 0);
    expect(r.lambda).toBe(0);
    expect(Number.isFinite(r.percentile)).toBe(true);
  });
});

describe('impliedLambdaForMedian — the honest diagnostic', () => {
  it('recovers the lambda at which the observation is the 50/50 point', () => {
    for (const obs of [0, 1, 5, 40, 406]) {
      const lambda = impliedLambdaForMedian(obs);
      const r = assessLuck(trialsWithLambda(lambda, 1_000_000), obs);
      expect(r.pAtMost, `obs=${obs}`).toBeCloseTo(0.5, 3);
    }
  });

  it('is close to the observation itself for large counts', () => {
    // The Poisson median is within ~1 of λ, so the implied λ tracks the count.
    expect(impliedLambdaForMedian(406)).toBeGreaterThan(405);
    expect(impliedLambdaForMedian(406)).toBeLessThan(407);
  });

  it('is ln(2) for an observation of zero', () => {
    // P(X <= 0) = e^-λ = 0.5 exactly when λ = ln 2. Regression: bisecting on the
    // mid-P percentile instead collapsed this to ~0, because mid-P never
    // reaches 50% for any λ > 0 when the observation is zero.
    expect(impliedLambdaForMedian(0)).toBeCloseTo(Math.LN2, 6);
  });

  it('increases with the observation', () => {
    let prev = -1;
    for (const obs of [0, 1, 2, 10, 100, 1000]) {
      const v = impliedLambdaForMedian(obs);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });
});

describe('assessLuckRange — the guardrails', () => {
  const range = (lo: number, mid: number, hi: number, observed: number) =>
    assessLuckRange(
      {
        low: trialsWithLambda(lo),
        mid: trialsWithLambda(mid),
        high: trialsWithLambda(hi),
      },
      observed,
    );

  it('reports the percentile as a range across the rate scenarios', () => {
    const r = range(80, 100, 120, 100);
    expect(r.percentileLow).toBeLessThan(r.percentileHigh);
    expect(r.spread).toBeCloseTo(r.percentileHigh - r.percentileLow, 12);
  });

  it('suppresses the point estimate when the rates disagree by >20 points', () => {
    // A wide rate band on a big count moves the percentile enormously.
    const r = range(300, 400, 500, 400);
    expect(r.spread).toBeGreaterThan(UNCERTAIN_SPREAD_POINTS);
    expect(r.tooUncertain).toBe(true);
  });

  it('allows a point estimate when the rates barely matter', () => {
    const r = range(99, 100, 101, 100);
    expect(r.spread).toBeLessThan(UNCERTAIN_SPREAD_POINTS);
    expect(r.tooUncertain).toBe(false);
  });

  it('flags a calibration problem only when EVERY scenario is out of band', () => {
    // Wildly more than predicted under all three -> a rate is wrong.
    const wayHigh = range(10, 12, 15, 200);
    expect(wayHigh.outOfBand).toBe(true);
    expect(wayHigh.direction).toBe('above');

    // Wildly fewer than predicted under all three.
    const wayLow = range(200, 250, 300, 5);
    expect(wayLow.outOfBand).toBe(true);
    expect(wayLow.direction).toBe('below');

    // Comfortably inside under at least one scenario -> not a calibration flag.
    const ordinary = range(80, 100, 120, 110);
    expect(ordinary.outOfBand).toBe(false);
    expect(ordinary.direction).toBeNull();
  });

  it('backs out the rate multiplier that would make the observation median', () => {
    // Observed 200 against a predicted 100 implies the true rate is ~2x.
    const r = range(90, 100, 110, 200);
    expect(r.lambdaRatio).toBeGreaterThan(1.9);
    expect(r.lambdaRatio).toBeLessThan(2.1);
  });

  it('gives a ratio of ~1 when the model already agrees with reality', () => {
    const r = range(95, 100, 105, 100);
    expect(r.lambdaRatio).toBeGreaterThan(0.95);
    expect(r.lambdaRatio).toBeLessThan(1.05);
  });

  it('never produces NaN for a zero-lambda model', () => {
    const r = assessLuckRange({ low: [], mid: [], high: [] }, 0);
    expect(Number.isFinite(r.percentileLow)).toBe(true);
    expect(Number.isFinite(r.percentileHigh)).toBe(true);
  });
});

describe('ordinal', () => {
  it('handles the teens and the usual suffixes', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(63)).toBe('63rd');
    expect(ordinal(100)).toBe('100th');
  });
});
