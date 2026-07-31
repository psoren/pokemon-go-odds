/**
 * Reverse mode: given what you ACTUALLY have, where does that land in the
 * predicted distribution?
 *
 * This is far more sensitive to rate error than the forward model. A 20% error
 * in the wild shiny rate barely moves "expected shinies" as a headline, but it
 * can move a percentile from the 40th to the 90th. Everything here is therefore
 * built to report a RANGE and to refuse to answer when the range is too wide to
 * mean anything.
 *
 * Strictly read-only against the forward model: nothing in this file writes
 * back to the inputs or tunes a rate.
 */

import { logGamma, poissonBinomialTruncated } from './math';
import type { Scenario, Trial } from './types';

/**
 * Above this many successes the exact Poisson-binomial convolution costs
 * O(k²) per source and stops being worth it — the Poisson approximation is
 * accurate to ~0.1% in this app's regime (many trials, tiny probabilities),
 * which the forward model's divergence check demonstrates on every render.
 */
const EXACT_MAX_K = 300;

/* -------------------------------------------------------------------------- */
/* Regularized incomplete gamma, for the Poisson CDF                          */
/* -------------------------------------------------------------------------- */

/** Regularized lower incomplete gamma P(a, x), by series expansion. */
function gammaPSeries(a: number, x: number): number {
  let sum = 1 / a;
  let term = sum;
  for (let n = 1; n < 1000; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularized upper incomplete gamma Q(a, x), by continued fraction. */
function gammaQContinued(a: number, x: number): number {
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Regularized lower incomplete gamma P(a, x) = γ(a,x)/Γ(a). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) return gammaPSeries(a, x);
  return 1 - gammaQContinued(a, x);
}

/**
 * Poisson CDF, P(X <= k), via the identity P(X <= k) = Q(k+1, λ).
 * Stable for the large λ where a term-by-term sum would underflow.
 */
export function poissonCdf(lambda: number, k: number): number {
  if (k < 0) return 0;
  if (!(lambda > 0)) return 1;
  const q = 1 - gammaP(k + 1, lambda);
  return Math.min(1, Math.max(0, q));
}

/** Poisson pmf at a single k, in log space. */
export function poissonAt(lambda: number, k: number): number {
  if (k < 0) return 0;
  if (!(lambda > 0)) return k === 0 ? 1 : 0;
  return Math.exp(-lambda + k * Math.log(lambda) - logGamma(k + 1));
}

/* -------------------------------------------------------------------------- */
/* Where an observation lands                                                 */
/* -------------------------------------------------------------------------- */

export interface LuckResult {
  observed: number;
  lambda: number;
  /** P(X <= observed). */
  pAtMost: number;
  /** P(X >= observed). */
  pAtLeast: number;
  /** P(X = observed). */
  pExactly: number;
  /**
   * Percentile, 0-100, using the mid-P convention:
   *   P(X < observed) + 0.5 * P(X = observed)
   * Without the half-mass term a discrete distribution reports a systematically
   * inflated percentile — at λ = 0.9, "0 shundos" would otherwise read as the
   * 41st percentile when it is really the median outcome.
   */
  percentile: number;
  method: 'exact' | 'poisson';
}

/** Total expected count for a trial list. */
function lambdaOf(trials: Trial[]): number {
  return trials.reduce((acc, t) => acc + t.n * t.p, 0);
}

export function assessLuck(trials: Trial[], observed: number): LuckResult {
  const lambda = lambdaOf(trials);
  const k = Math.max(0, Math.round(observed));

  let pBelow: number;
  let pExactly: number;
  let method: 'exact' | 'poisson';

  if (k <= EXACT_MAX_K) {
    const pmf = poissonBinomialTruncated(trials, k);
    pExactly = pmf[k] ?? 0;
    pBelow = pmf.slice(0, k).reduce((a, b) => a + b, 0);
    method = 'exact';
  } else {
    pExactly = poissonAt(lambda, k);
    pBelow = poissonCdf(lambda, k - 1);
    method = 'poisson';
  }

  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const pAtMost = clamp(pBelow + pExactly);

  return {
    observed: k,
    lambda,
    pAtMost,
    pAtLeast: clamp(1 - pBelow),
    pExactly: clamp(pExactly),
    percentile: clamp(pBelow + 0.5 * pExactly) * 100,
    method,
  };
}

/* -------------------------------------------------------------------------- */
/* Predictive distribution — integrating over the rate uncertainty            */
/* -------------------------------------------------------------------------- */

export interface PredictiveLuck {
  percentile: number;
  pAtMost: number;
  pAtLeast: number;
}

/**
 * Where an observation lands once the RATE uncertainty is folded in, rather
 * than conditioned on one particular rate being correct.
 *
 * This exists because the per-scenario approach is degenerate. Evaluating the
 * percentile separately at λ_low and λ_high and reporting the span answers a
 * question nobody asked: "if the rarest plausible rates are exactly right, how
 * lucky were you?" With a 4x-wide rate band the two answers are always ~0 and
 * ~100, so the range is always the whole scale and the app always refuses to
 * speak — even when the observation sits exactly on the best guess.
 *
 * The right object is the PREDICTIVE distribution: λ is itself uncertain, so
 *
 *   P(X = k) = ∫ Poisson(k; λ) p(λ) dλ
 *
 * approximated here by a weighted grid over [low, high] with a triangular
 * weight peaked at mid. That is much wider than any single Poisson, which is
 * exactly right — most of your uncertainty really is about the rates, not about
 * your luck — and it always yields a usable answer.
 */
export function predictiveLuck(
  lambdaLow: number,
  lambdaMid: number,
  lambdaHigh: number,
  observed: number,
  grid = 61,
): PredictiveLuck {
  const k = Math.max(0, Math.round(observed));
  const lo = Math.max(0, Math.min(lambdaLow, lambdaMid, lambdaHigh));
  const hi = Math.max(lambdaLow, lambdaMid, lambdaHigh);
  const mid = Math.min(hi, Math.max(lo, lambdaMid));

  // Degenerate band: nothing to integrate over, so it is a plain Poisson.
  if (!(hi > lo)) {
    const pBelow = poissonCdf(mid, k - 1);
    const pExact = poissonAt(mid, k);
    return {
      percentile: Math.min(100, Math.max(0, (pBelow + 0.5 * pExact) * 100)),
      pAtMost: Math.min(1, pBelow + pExact),
      pAtLeast: Math.min(1, 1 - pBelow),
    };
  }

  let wSum = 0;
  let below = 0;
  let exact = 0;
  for (let i = 0; i < grid; i++) {
    const lambda = lo + ((hi - lo) * i) / (grid - 1);
    // Triangular weight: rises to 1 at mid, falls to 0 at each end.
    const w =
      lambda <= mid
        ? mid > lo
          ? (lambda - lo) / (mid - lo)
          : 1
        : hi > mid
          ? (hi - lambda) / (hi - mid)
          : 1;
    if (!(w > 0)) continue;
    wSum += w;
    below += w * poissonCdf(lambda, k - 1);
    exact += w * poissonAt(lambda, k);
  }
  if (!(wSum > 0)) return { percentile: 50, pAtMost: 0.5, pAtLeast: 0.5 };

  const pBelow = below / wSum;
  const pExact = exact / wSum;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return {
    percentile: clamp(pBelow + 0.5 * pExact) * 100,
    pAtMost: clamp(pBelow + pExact),
    pAtLeast: clamp(1 - pBelow),
  };
}

/* -------------------------------------------------------------------------- */
/* The guardrails                                                             */
/* -------------------------------------------------------------------------- */

/** Percentile spread beyond which we refuse to give a point estimate. */
export const UNCERTAIN_SPREAD_POINTS = 20;

export interface LuckRange {
  observed: number;
  byScenario: Record<Scenario, LuckResult>;
  /** Lowest and highest percentile across the low/mid/high rate scenarios. */
  percentileLow: number;
  percentileHigh: number;
  /** percentileHigh - percentileLow, in percentile points. */
  spread: number;
  /**
   * True when the rate estimates alone move the percentile by more than
   * UNCERTAIN_SPREAD_POINTS. The point estimate is meaningless at that width
   * and the UI suppresses it entirely.
   */
  tooUncertain: boolean;
  /**
   * True when the observation sits outside the 1st-99th percentile band under
   * EVERY scenario. At that point the honest inference is almost always "a rate
   * assumption is wrong", not "you got spectacularly lucky".
   */
  outOfBand: boolean;
  /** Which tail it fell out of, when outOfBand. */
  direction: 'above' | 'below' | null;
  /**
   * The headline answer: where the observation lands once rate uncertainty is
   * integrated over, rather than conditioned on one scenario being right.
   */
  predictive: PredictiveLuck;
  /** λ that would make the observation exactly the median outcome. */
  impliedLambda: number;
  /** impliedLambda / (mid-scenario λ). 1.0 means the model already agrees. */
  lambdaRatio: number;
}

/**
 * Solve for the λ at which `observed` is the median outcome — the rate at which
 * your count is the 50/50 point, with half of all outcomes at or below it.
 *
 * This is the honest diagnostic: comparing it to the configured λ tells you
 * whether the model or your luck is the outlier.
 *
 * Defined as the λ solving P(X <= observed) = 0.5, which is monotonically
 * decreasing in λ and therefore has exactly one root. The mid-P convention used
 * for *reporting* a percentile is deliberately NOT used here: for a small
 * observation like zero shundos, mid-P never reaches 50% for any λ > 0, and
 * bisecting on it collapses to λ = 0. P(X <= 0) = 0.5 correctly gives ln 2.
 */
export function impliedLambdaForMedian(observed: number): number {
  const k = Math.max(0, Math.round(observed));
  const atMost = (lambda: number) => poissonCdf(lambda, k);

  let lo = 1e-12;
  let hi = Math.max(10, (k + 1) * 4);
  // Expand until the CDF at `hi` has dropped below one half.
  for (let i = 0; i < 200 && atMost(hi) > 0.5; i++) hi *= 2;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (atMost(mid) > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function assessLuckRange(
  trialsByScenario: Record<Scenario, Trial[]>,
  observed: number,
): LuckRange {
  const byScenario = {
    low: assessLuck(trialsByScenario.low, observed),
    mid: assessLuck(trialsByScenario.mid, observed),
    high: assessLuck(trialsByScenario.high, observed),
  };
  const percentiles = [
    byScenario.low.percentile,
    byScenario.mid.percentile,
    byScenario.high.percentile,
  ];
  const percentileLow = Math.min(...percentiles);
  const percentileHigh = Math.max(...percentiles);
  const spread = percentileHigh - percentileLow;

  const impliedLambda = impliedLambdaForMedian(observed);
  const predictive = predictiveLuck(
    byScenario.low.lambda,
    byScenario.mid.lambda,
    byScenario.high.lambda,
    observed,
  );

  // Calibration failure is judged against the PREDICTIVE distribution. Being
  // outside its 1st-99th band means NO plausible rate explains the observation,
  // which is the real red flag. The old test — outside the band under each
  // scenario separately — fired for perfectly ordinary counts, because a wide
  // rate band guarantees the extremes disagree.
  const allAbove = predictive.percentile > 99;
  const allBelow = predictive.percentile < 1;

  return {
    observed: Math.max(0, Math.round(observed)),
    byScenario,
    predictive,
    percentileLow,
    percentileHigh,
    spread,
    tooUncertain: spread > UNCERTAIN_SPREAD_POINTS,
    outOfBand: allAbove || allBelow,
    direction: allAbove ? 'above' : allBelow ? 'below' : null,
    impliedLambda,
    lambdaRatio: byScenario.mid.lambda > 0 ? impliedLambda / byScenario.mid.lambda : NaN,
  };
}

/** Ordinal suffix for a percentile, e.g. 63 -> "63rd". */
export function ordinal(n: number): string {
  const r = Math.round(n);
  const mod100 = r % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${r}th`;
  switch (r % 10) {
    case 1:
      return `${r}st`;
    case 2:
      return `${r}nd`;
    case 3:
      return `${r}rd`;
    default:
      return `${r}th`;
  }
}
