import { describe, expect, it } from 'vitest';
import {
  binomialPmf,
  buildDistribution,
  convolveTruncated,
  hundoProbability,
  ivValuesPerStat,
  logGamma,
  poissonBinomialExact,
  poissonBinomialTruncated,
  poissonPmf,
  purifiedHundoProbability,
  totalLambda,
} from './math';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('IV floor mechanics', () => {
  it('counts (16 - F) possible values per stat', () => {
    expect(ivValuesPerStat(0)).toBe(16);
    expect(ivValuesPerStat(10)).toBe(6);
    expect(ivValuesPerStat(15)).toBe(1);
  });

  it('matches the known hundo probabilities', () => {
    expect(hundoProbability(10)).toBeCloseTo(1 / 216, 12);
    expect(hundoProbability(12)).toBeCloseTo(1 / 64, 12);
    expect(hundoProbability(6)).toBeCloseTo(1 / 1000, 12);
    expect(hundoProbability(0)).toBeCloseTo(1 / 4096, 12);
    expect(hundoProbability(5)).toBeCloseTo(1 / 1331, 12);
    expect(hundoProbability(1)).toBeCloseTo(1 / 3375, 12);
  });

  it('matches the known purified hundo probabilities', () => {
    // Purification adds +2, so a stat only needs to roll >= 13.
    expect(purifiedHundoProbability(6)).toBeCloseTo(27 / 1000, 12);
    expect(purifiedHundoProbability(0)).toBeCloseTo(27 / 4096, 12);
    expect(purifiedHundoProbability(4)).toBeCloseTo(27 / 1728, 12);
  });

  it('is always at least as good as, and usually 27x, the un-purified odds', () => {
    for (let f = 0; f <= 12; f++) {
      expect(purifiedHundoProbability(f)).toBeCloseTo(27 * hundoProbability(f), 12);
    }
  });

  it('is certain once the floor guarantees a >= 13 roll', () => {
    expect(purifiedHundoProbability(13)).toBeCloseTo(1, 12);
    expect(purifiedHundoProbability(14)).toBeCloseTo(1, 12);
    expect(purifiedHundoProbability(15)).toBeCloseTo(1, 12);
  });
});

describe('logGamma', () => {
  it('reproduces factorials', () => {
    expect(Math.exp(logGamma(1))).toBeCloseTo(1, 9);
    expect(Math.exp(logGamma(6))).toBeCloseTo(120, 6);
    expect(Math.exp(logGamma(11))).toBeCloseTo(3628800, 2);
  });
});

describe('Poisson pmf', () => {
  it('matches the reference values for lambda = 0.71', () => {
    const p = poissonPmf(0.71, 6);
    expect(p[0]).toBeCloseTo(0.4916, 4);
    expect(p[1]).toBeCloseTo(0.3491, 4);
    expect(p[2]).toBeCloseTo(0.1239, 4);
  });

  it('sums to 1 over a generous support', () => {
    expect(sum(poissonPmf(3.2, 60))).toBeCloseTo(1, 12);
  });

  it('puts all mass at zero when lambda is zero', () => {
    const p = poissonPmf(0, 6);
    expect(p[0]).toBe(1);
    expect(sum(p.slice(1))).toBe(0);
  });

  it('stays finite and near zero for large lambda instead of underflowing to NaN', () => {
    const p = poissonPmf(400, 6);
    for (const v of p) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1e-100);
    }
  });
});

describe('binomial pmf', () => {
  it('sums to 1 across the full support', () => {
    expect(sum(binomialPmf(40, 0.3))).toBeCloseTo(1, 12);
    expect(sum(binomialPmf(1, 0.5))).toBeCloseTo(1, 12);
    expect(sum(binomialPmf(200, 1 / 512))).toBeCloseTo(1, 12);
  });

  it('matches hand-computed values', () => {
    const p = binomialPmf(3, 0.5);
    expect(p).toHaveLength(4);
    expect(p[0]).toBeCloseTo(0.125, 12);
    expect(p[1]).toBeCloseTo(0.375, 12);
    expect(p[2]).toBeCloseTo(0.375, 12);
    expect(p[3]).toBeCloseTo(0.125, 12);
  });

  it('survives the large-n small-p regime this app actually uses', () => {
    // 200k wild catches at 1/512: P(0 shinies) is astronomically small but must
    // still be a finite non-negative number, not NaN.
    const p = poissonBinomialTruncated([{ n: 200_000, p: 1 / 512 }], 6);
    for (const v of p) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Poisson-binomial DP', () => {
  it('sums to 1.0 within 1e-9 over the full support', () => {
    const cases: number[][] = [
      [0.1, 0.2, 0.3, 0.4, 0.5],
      [1 / 512, 1 / 25, 1 / 20, 1 / 64, 1 / 216],
      Array.from({ length: 60 }, (_, i) => (i + 1) / 200),
      [0, 1, 0.5],
    ];
    for (const probs of cases) {
      expect(Math.abs(sum(poissonBinomialExact(probs)) - 1)).toBeLessThan(1e-9);
    }
  });

  it('reduces to the binomial when every probability is equal', () => {
    const exact = poissonBinomialExact(Array(12).fill(0.25));
    const binom = binomialPmf(12, 0.25);
    for (let k = 0; k < exact.length; k++) {
      expect(exact[k]).toBeCloseTo(binom[k], 12);
    }
  });

  it('grouped-trial convolution equals the per-Bernoulli expansion', () => {
    const trials = [
      { n: 30, p: 0.02 },
      { n: 12, p: 0.1 },
      { n: 5, p: 1 / 216 },
    ];
    const grouped = poissonBinomialTruncated(trials, 8);
    const flat = poissonBinomialExact(
      trials.flatMap((t) => Array<number>(t.n).fill(t.p)),
    );
    for (let k = 0; k <= 8; k++) {
      expect(grouped[k]).toBeCloseTo(flat[k], 12);
    }
  });

  it('truncated mass never exceeds 1', () => {
    const dist = poissonBinomialTruncated([{ n: 1000, p: 0.5 }], 6);
    expect(sum(dist)).toBeLessThanOrEqual(1 + 1e-12);
  });

  it('is the identity for an empty trial list', () => {
    const dist = poissonBinomialTruncated([], 6);
    expect(dist[0]).toBe(1);
    expect(sum(dist.slice(1))).toBe(0);
  });
});

describe('convolveTruncated', () => {
  it('preserves total mass when nothing spills past maxK', () => {
    const a = binomialPmf(3, 0.4);
    const b = binomialPmf(2, 0.6);
    expect(sum(convolveTruncated(a, b, 5))).toBeCloseTo(1, 12);
  });
});

describe('buildDistribution', () => {
  it('agrees between Poisson and exact in the small-p regime', () => {
    const trials = [
      { n: 50_000, p: 1 / 512 / 4096 },
      { n: 300, p: (1 / 20) * (1 / 216) },
      { n: 40, p: 1 / 64 },
    ];
    const d = buildDistribution(trials, 6);
    expect(d.lambda).toBeCloseTo(totalLambda(trials), 12);
    expect(d.diverges).toBe(false);
    expect(d.maxAbsDivergence).toBeLessThan(0.01);
  });

  it('flags divergence when a single trial carries a large p', () => {
    // One coin flip is nothing like a Poisson(0.5).
    const d = buildDistribution([{ n: 1, p: 0.5 }], 6);
    expect(d.diverges).toBe(true);
  });

  it('reports the tail mass above maxK', () => {
    const d = buildDistribution([{ n: 100, p: 0.5 }], 6);
    expect(d.tail).toBeGreaterThan(0.99);
  });
});
