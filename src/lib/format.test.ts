import { describe, expect, it } from 'vitest';
import { fmtInt, fmtLambda, fmtOneIn, fmtPercent, fmtRange, toDenominator } from './format';

/** Every value these helpers can plausibly be handed by the UI, including the ones that used to break them. */
const EDGE_CASES = [
  0,
  -0,
  1,
  -1,
  0.5,
  1e-12,
  1e12,
  Number.MIN_VALUE,
  Number.MAX_VALUE,
  Number.EPSILON,
  NaN,
  Infinity,
  -Infinity,
];

describe('fmtPercent', () => {
  it('never throws for any digits a caller might pass', () => {
    // Regression: digits = 0 produced '0'.repeat(-1) and threw
    // "RangeError: Invalid count value: -1", blanking the whole page as soon
    // as the sensitivity panel had a contributor worth less than 1%.
    for (let digits = -3; digits <= 25; digits++) {
      for (const p of EDGE_CASES) {
        expect(() => fmtPercent(p, digits), `p=${p} digits=${digits}`).not.toThrow();
      }
    }
  });

  it('renders a sub-1% share as <1% at zero digits rather than 0%', () => {
    expect(fmtPercent(0.004, 0)).toBe('<1%');
    expect(fmtPercent(0.0001, 0)).toBe('<1%');
  });

  it('keeps exact zero as a plain zero, not a "smaller than" form', () => {
    expect(fmtPercent(0, 0)).toBe('0%');
    expect(fmtPercent(0, 2)).toBe('0.00%');
  });

  it('formats ordinary values at the requested precision', () => {
    expect(fmtPercent(0.5)).toBe('50.00%');
    expect(fmtPercent(0.5, 0)).toBe('50%');
    expect(fmtPercent(0.1234, 1)).toBe('12.3%');
    expect(fmtPercent(1, 0)).toBe('100%');
  });

  it('uses the smaller-than form below the visible resolution', () => {
    expect(fmtPercent(1e-9, 2)).toBe('<0.01%');
    expect(fmtPercent(1e-9, 3)).toBe('<0.001%');
  });

  it('returns a dash for non-finite input', () => {
    expect(fmtPercent(NaN)).toBe('—');
    expect(fmtPercent(Infinity)).toBe('—');
  });
});

describe('fmtLambda', () => {
  it('never throws', () => {
    for (const x of EDGE_CASES) expect(() => fmtLambda(x), `x=${x}`).not.toThrow();
  });

  it('scales precision to magnitude', () => {
    expect(fmtLambda(0)).toBe('0');
    expect(fmtLambda(3.75)).toBe('3.75');
    expect(fmtLambda(12.34)).toBe('12.3');
    expect(fmtLambda(123.4)).toBe('123');
    expect(fmtLambda(12345)).toBe('12,345');
  });

  it('falls back to exponent notation for very small non-zero values', () => {
    expect(fmtLambda(0.0000047)).toContain('e-');
  });

  it('returns a dash for non-finite input', () => {
    expect(fmtLambda(NaN)).toBe('—');
    expect(fmtLambda(Infinity)).toBe('—');
  });
});

describe('fmtRange', () => {
  it('never throws', () => {
    for (const a of EDGE_CASES) for (const b of EDGE_CASES) expect(() => fmtRange(a, b)).not.toThrow();
  });

  it('collapses to a single value when the ends agree', () => {
    expect(fmtRange(3.75, 3.75)).toBe('3.75');
  });

  it('shows both ends otherwise', () => {
    expect(fmtRange(1, 2)).toBe('1.00 – 2.00');
  });
});

describe('fmtOneIn', () => {
  it('never throws', () => {
    for (const p of EDGE_CASES) expect(() => fmtOneIn(p), `p=${p}`).not.toThrow();
  });

  it('renders community rates the way players quote them', () => {
    expect(fmtOneIn(1 / 512)).toBe('1 in 512');
    // Denominators stay ungrouped below 10k — "1 in 4096" is how players say it.
    expect(fmtOneIn(1 / 4096)).toBe('1 in 4096');
    expect(fmtOneIn(1 / 20)).toBe('1 in 20.0');
    expect(fmtOneIn(1 / 50_000)).toBe('1 in 50,000');
  });

  it('handles the degenerate ends', () => {
    expect(fmtOneIn(0)).toBe('—');
    expect(fmtOneIn(1)).toBe('1 in 1');
    expect(fmtOneIn(2)).toBe('1 in 1');
  });
});

describe('toDenominator', () => {
  it('never throws', () => {
    for (const p of EDGE_CASES) expect(() => toDenominator(p), `p=${p}`).not.toThrow();
  });

  it('round-trips a probability through its denominator', () => {
    for (const n of [20, 25, 64, 128, 256, 512, 1000, 4096]) {
      expect(Number(toDenominator(1 / n))).toBe(n);
    }
  });

  it('is empty for a zero or invalid rate, so the field renders blank', () => {
    expect(toDenominator(0)).toBe('');
    expect(toDenominator(NaN)).toBe('');
  });
});

describe('fmtInt', () => {
  it('never throws', () => {
    for (const x of EDGE_CASES) expect(() => fmtInt(x), `x=${x}`).not.toThrow();
  });

  it('groups thousands', () => {
    expect(fmtInt(50000)).toBe('50,000');
    expect(fmtInt(0)).toBe('0');
  });
});
