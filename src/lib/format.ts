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

export function fmtPercent(p: number, digits = 2): string {
  if (!Number.isFinite(p)) return '—';
  if (p > 0 && p < 10 ** -digits / 100) return `<0.${'0'.repeat(digits - 1)}1%`;
  return `${(p * 100).toFixed(digits)}%`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}
