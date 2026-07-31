/**
 * Pure probability math. No game knowledge beyond the IV roll mechanic,
 * no React, no config. Everything here is unit tested.
 */

import type { Distribution, Trial } from './types';

/** Number of distinct values each IV stat can roll given floor F: [F, 15]. */
export function ivValuesPerStat(floor: number): number {
  return 16 - clampFloor(floor);
}

function clampFloor(floor: number): number {
  if (!Number.isFinite(floor)) return 0;
  return Math.min(15, Math.max(0, Math.round(floor)));
}

/**
 * P(all three stats roll 15) with IV floor F.
 *
 *   Each stat is uniform over [F, 15]  ->  (16 - F) values
 *   P(hundo) = 1 / (16 - F)^3
 *
 * F = 10 -> 1/216, F = 12 -> 1/64, F = 6 -> 1/1000.
 */
export function hundoProbability(floor: number): number {
  const values = ivValuesPerStat(floor);
  return 1 / (values * values * values);
}

/**
 * P(a shadow purifies into a hundo) with IV floor F.
 *
 * Purification adds +2 to every IV (capped at 15), so a stat only needs to
 * roll >= 13. There are min(3, 16 - F) such values (13, 14, 15), out of
 * (16 - F) total:
 *
 *   P(purify-hundo) = (min(3, 16 - F) / (16 - F))^3
 *
 * F = 6 -> (3/10)^3 = 27/1000.  F = 0 -> (3/16)^3 = 27/4096.
 * For F >= 13 every roll already purifies to 15, so the result is 1.
 */
export function purifiedHundoProbability(floor: number): number {
  const values = ivValuesPerStat(floor);
  const qualifying = Math.min(3, values);
  const p = qualifying / values;
  return p * p * p;
}

/** Lanczos log-gamma. Accurate to ~1e-13 for the range we use. */
const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS_C[0];
  const t = z + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) a += LANCZOS_C[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** log(n!) */
function logFactorial(n: number): number {
  return logGamma(n + 1);
}

/**
 * Poisson pmf, P(X = k) for k = 0..maxK, computed in log space so it stays
 * correct for large lambda (where P(0..6) is legitimately ~0 rather than NaN).
 */
export function poissonPmf(lambda: number, maxK: number): number[] {
  const out = new Array<number>(maxK + 1).fill(0);
  if (!(lambda > 0)) {
    out[0] = 1;
    return out;
  }
  const logLambda = Math.log(lambda);
  for (let k = 0; k <= maxK; k++) {
    out[k] = Math.exp(-lambda + k * logLambda - logFactorial(k));
  }
  return out;
}

/**
 * Binomial pmf truncated to k = 0..maxK, in log space.
 *
 * `n` may be very large (hundreds of thousands of wild catches) and `p` very
 * small, so the naive (1-p)^n * ratio recursion underflows to exactly zero and
 * then propagates zeros. Computing each term as
 *   log C(n,k) + k log p + (n-k) log(1-p)
 * keeps the small-but-nonzero terms alive.
 */
export function binomialPmfTruncated(n: number, p: number, maxK: number): number[] {
  const out = new Array<number>(maxK + 1).fill(0);
  const trials = Math.max(0, Math.round(n));
  if (trials === 0 || !(p > 0)) {
    out[0] = 1;
    return out;
  }
  if (p >= 1) {
    if (trials <= maxK) out[trials] = 1;
    return out;
  }
  const logP = Math.log(p);
  const log1mP = Math.log1p(-p);
  const logNFact = logFactorial(trials);
  const kMax = Math.min(maxK, trials);
  for (let k = 0; k <= kMax; k++) {
    const logC = logNFact - logFactorial(k) - logFactorial(trials - k);
    out[k] = Math.exp(logC + k * logP + (trials - k) * log1mP);
  }
  return out;
}

/** Full binomial pmf over k = 0..n. Sums to 1. Only safe for modest n. */
export function binomialPmf(n: number, p: number): number[] {
  return binomialPmfTruncated(n, p, Math.max(0, Math.round(n)));
}

/** Convolve two truncated pmfs, keeping k = 0..maxK. */
export function convolveTruncated(a: number[], b: number[], maxK: number): number[] {
  const out = new Array<number>(maxK + 1).fill(0);
  for (let i = 0; i < a.length && i <= maxK; i++) {
    if (a[i] === 0) continue;
    const limit = Math.min(b.length - 1, maxK - i);
    for (let j = 0; j <= limit; j++) {
      out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

/**
 * Exact Poisson-binomial distribution over a list of independent Bernoulli
 * probabilities. Returns the FULL distribution (length probs.length + 1),
 * which sums to 1. O(n^2) — use only for small n (it exists so the truncated
 * path can be tested against something that must sum to 1).
 */
export function poissonBinomialExact(probs: number[]): number[] {
  let dist = [1];
  for (const p of probs) {
    const next = new Array<number>(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * (1 - p);
      next[k + 1] += dist[k] * p;
    }
    dist = next;
  }
  return dist;
}

/**
 * Exact Poisson-binomial over grouped trials, truncated to k = 0..maxK.
 *
 * Each group of `n` identical Bernoulli(p) trials is a Binomial(n, p); the
 * groups are independent, so the total is the convolution of their pmfs. This
 * is exact — it is not the Poisson approximation — and it costs
 * O(sources * maxK^2) instead of O(total_trials * maxK).
 */
export function poissonBinomialTruncated(trials: Trial[], maxK: number): number[] {
  let dist = new Array<number>(maxK + 1).fill(0);
  dist[0] = 1;
  for (const t of trials) {
    if (!(t.p > 0) || t.n <= 0) continue;
    const pmf = binomialPmfTruncated(t.n, t.p, maxK);
    dist = convolveTruncated(dist, pmf, maxK);
  }
  return dist;
}

/** Sum of n * p over trials. */
export function totalLambda(trials: Trial[]): number {
  return trials.reduce((acc, t) => acc + t.n * t.p, 0);
}

/**
 * Build the comparison object the UI renders: Poisson approximation vs exact
 * Poisson-binomial, plus a divergence flag.
 *
 * The two agree closely whenever every individual p is small, which is the
 * regime this app lives in. They are flagged as divergent at >1 percentage
 * point on any single k.
 */
export const DIVERGENCE_THRESHOLD = 0.01;

export function buildDistribution(trials: Trial[], maxK: number): Distribution {
  const lambda = totalLambda(trials);
  const poisson = poissonPmf(lambda, maxK);
  const exact = poissonBinomialTruncated(trials, maxK);
  let maxAbsDivergence = 0;
  for (let k = 0; k <= maxK; k++) {
    maxAbsDivergence = Math.max(maxAbsDivergence, Math.abs(poisson[k] - exact[k]));
  }
  const sum = exact.reduce((a, b) => a + b, 0);
  return {
    poisson,
    exact,
    tail: Math.max(0, 1 - sum),
    lambda,
    maxAbsDivergence,
    diverges: maxAbsDivergence > DIVERGENCE_THRESHOLD,
  };
}
