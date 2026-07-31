/**
 * Display helpers. The house style: every headline number is a RANGE, and we
 * never render more precision than a community-estimated rate can support.
 */

/** Expected counts (lambda). Scales precision to magnitude. */
export function fmtLambda(x: number): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  if (x >= 1000) return Math.round(x).toLocaleString();
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  if (x >= 1) return x.toFixed(2);
  if (x >= 0.01) return x.toFixed(3);
  return x.toExponential(1);
}

/** A low–high range, collapsing to a single value when the ends agree. */
export function fmtRange(low: number, high: number): string {
  const a = fmtLambda(low);
  const b = fmtLambda(high);
  return a === b ? a : `${a} – ${b}`;
}

/** A probability as "1 in N". */
export function fmtOneIn(p: number): string {
  if (!(p > 0)) return '—';
  if (p >= 1) return '1 in 1';
  const n = 1 / p;
  if (n >= 10_000) return `1 in ${Math.round(n).toLocaleString()}`;
  if (n >= 100) return `1 in ${Math.round(n)}`;
  if (n >= 10) return `1 in ${n.toFixed(1)}`;
  return `1 in ${n.toFixed(2)}`;
}

/** The denominator alone, for editing "1 in ___" fields. */
export function toDenominator(p: number): string {
  if (!(p > 0)) return '';
  const n = 1 / p;
  return n >= 100 ? String(Math.round(n)) : String(Number(n.toFixed(2)));
}

/**
 * A probability as a percentage, with a "smaller than we can show" form so a
 * tiny-but-nonzero contribution never renders as a flat 0%.
 *
 * `digits` is clamped to [0, 20]: it feeds both toFixed (which throws outside
 * that range) and a repeat() count that used to go negative at digits = 0.
 */
export function fmtPercent(p: number, digits = 2): string {
  if (!Number.isFinite(p)) return '—';
  const d = Math.min(20, Math.max(0, Math.trunc(digits)));
  const smallest = 10 ** -d / 100;
  if (p > 0 && p < smallest) {
    return d === 0 ? '<1%' : `<0.${'0'.repeat(d - 1)}1%`;
  }
  return `${(p * 100).toFixed(d)}%`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}
