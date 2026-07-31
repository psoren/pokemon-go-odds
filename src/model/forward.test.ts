import { describe, expect, it } from 'vitest';
import { SOURCES, SOURCES_BY_ID } from '../config/rates';
import { computeSources, emptyInputs, runModel, validate } from './forward';
import { hundoProbability, purifiedHundoProbability } from './math';
import type { ModelInputs } from './types';

function inputs(counts: Record<string, number>, patch: Partial<ModelInputs> = {}): ModelInputs {
  return { ...emptyInputs(), counts, ...patch };
}

const result = (counts: Record<string, number>, id: string, patch?: Partial<ModelInputs>) =>
  computeSources(inputs(counts, patch), 'mid').find((r) => r.def.id === id)!;

describe('rate config integrity', () => {
  it('has a unique id, a citation and a legal IV floor for every source', () => {
    const ids = new Set<string>();
    for (const s of SOURCES) {
      expect(ids.has(s.id), `duplicate id ${s.id}`).toBe(false);
      ids.add(s.id);
      expect(s.citation.length).toBeGreaterThan(10);
      expect(s.ivFloor).toBeGreaterThanOrEqual(0);
      expect(s.ivFloor).toBeLessThanOrEqual(15);
    }
  });

  it('orders every rate band low <= mid <= high as probabilities', () => {
    for (const s of SOURCES) {
      if (!s.shinyRate) continue;
      expect(s.shinyRate.low, s.id).toBeLessThanOrEqual(s.shinyRate.mid);
      expect(s.shinyRate.mid, s.id).toBeLessThanOrEqual(s.shinyRate.high);
      expect(s.shinyRate.low, s.id).toBeGreaterThan(0);
      expect(s.shinyRate.high, s.id).toBeLessThanOrEqual(1);
    }
  });

  it('gives trade sources no shiny rate at all', () => {
    for (const s of SOURCES.filter((x) => x.kind === 'trade')) {
      expect(s.shinyRate).toBeUndefined();
    }
  });

  it('uses the documented trade IV floors', () => {
    expect(SOURCES_BY_ID['trade-good'].ivFloor).toBe(1);
    expect(SOURCES_BY_ID['trade-great'].ivFloor).toBe(2);
    expect(SOURCES_BY_ID['trade-ultra'].ivFloor).toBe(3);
    expect(SOURCES_BY_ID['trade-best'].ivFloor).toBe(5);
    expect(SOURCES_BY_ID['trade-lucky'].ivFloor).toBe(12);
  });

  it('uses the documented encounter IV floors', () => {
    expect(SOURCES_BY_ID['wild'].ivFloor).toBe(0);
    expect(SOURCES_BY_ID['wild-weather'].ivFloor).toBe(4);
    expect(SOURCES_BY_ID['research'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['eggs'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['raid-t14'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['raid-t5'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['shadow-raid'].ivFloor).toBe(6);
    expect(SOURCES_BY_ID['grunt-shadow'].ivFloor).toBe(0);
    expect(SOURCES_BY_ID['grunt-shadow-weather'].ivFloor).toBe(4);
    expect(SOURCES_BY_ID['giovanni'].ivFloor).toBe(6);
  });
});

describe('trades are re-rolls, not new Pokémon', () => {
  it('never increases the shiny expected count', () => {
    const base = runModel(inputs({ wild: 50_000, 'raid-t5': 400 }), 'mid');
    const withTrades = runModel(
      inputs({
        wild: 50_000,
        'raid-t5': 400,
        'trade-lucky': 120,
        'trade-best': 300,
        'trade-good': 50,
        'trade-great': 50,
        'trade-ultra': 50,
      }),
      'mid',
    );
    expect(withTrades.lambdaShiny).toBeCloseTo(base.lambdaShiny, 12);
  });

  it('contributes zero shiny lambda from every trade source individually', () => {
    for (const s of SOURCES.filter((x) => x.kind === 'trade')) {
      expect(result({ [s.id]: 1000 }, s.id).lambdaShiny).toBe(0);
    }
  });

  it('contributes zero to the shiny distribution', () => {
    const only = runModel(inputs({ 'trade-lucky': 500 }), 'mid');
    expect(only.lambdaShiny).toBe(0);
    expect(only.shiny.exact[0]).toBeCloseTo(1, 12);
  });

  it('does increase the shundo count via a fresh IV roll at the trade floor', () => {
    const r = result({ 'trade-lucky': 64 }, 'trade-lucky');
    // 64 shiny trades at floor 12 -> 64 * 1/64 = 1 expected shundo.
    expect(r.lambdaShundo).toBeCloseTo(1, 12);
    // A shundo is also a hundo.
    expect(r.lambdaHundo).toBeCloseTo(1, 12);
  });

  it('applies the best-friend floor of 5 to best-friend trades', () => {
    const r = result({ 'trade-best': 1331 }, 'trade-best');
    expect(r.lambdaShundo).toBeCloseTo(1331 * hundoProbability(5), 12);
  });

  it('makes a lucky trade ~21x better than a best-friend trade per shiny', () => {
    const lucky = result({ 'trade-lucky': 1 }, 'trade-lucky').lambdaShundo;
    const best = result({ 'trade-best': 1 }, 'trade-best').lambdaShundo;
    expect(lucky / best).toBeCloseTo(1331 / 64, 9);
  });
});

describe('shadows', () => {
  it('cannot be traded, so purification is their only IV upgrade', () => {
    for (const s of SOURCES.filter((x) => x.kind === 'shadow')) {
      expect(s.subsetOf === undefined || SOURCES_BY_ID[s.subsetOf!].kind).not.toBe('trade');
    }
  });

  it('reports as-caught and purified hundo lambdas side by side', () => {
    const r = result({ giovanni: 1000 }, 'giovanni');
    expect(r.lambdaHundoAsCaught).toBeCloseTo(1000 * hundoProbability(6), 12);
    expect(r.lambdaHundoPurified).toBeCloseTo(1000 * purifiedHundoProbability(6), 12);
    // floor 6: 1/1000 as caught vs 27/1000 purified.
    expect(r.lambdaHundoAsCaught).toBeCloseTo(1, 12);
    expect(r.lambdaHundoPurified).toBeCloseTo(27, 12);
  });

  it('switches the active hundo path when purification is assumed', () => {
    const asCaught = result({ 'grunt-shadow': 4096 }, 'grunt-shadow');
    const purified = result({ 'grunt-shadow': 4096 }, 'grunt-shadow', { assumePurified: true });
    expect(asCaught.lambdaHundo).toBeCloseTo(1, 12);
    expect(purified.lambdaHundo).toBeCloseTo(27, 12);
  });

  it('leaves non-shadow sources untouched by the purification toggle', () => {
    const asCaught = result({ 'raid-t5': 500 }, 'raid-t5');
    const purified = result({ 'raid-t5': 500 }, 'raid-t5', { assumePurified: true });
    expect(purified.lambdaHundo).toBeCloseTo(asCaught.lambdaHundo, 12);
  });
});

describe('subset sources are subtracted, not added', () => {
  it('carves Community Day and weather-boosted catches out of the wild total', () => {
    const counts = { wild: 10_000, 'community-day': 1_500, 'wild-weather': 2_000 };
    expect(result(counts, 'wild').effectiveCount).toBe(6_500);
    expect(result(counts, 'community-day').effectiveCount).toBe(1_500);
    expect(result(counts, 'wild-weather').effectiveCount).toBe(2_000);
  });

  it('carves weather-boosted shadows out of the grunt total', () => {
    const counts = { 'grunt-shadow': 900, 'grunt-shadow-weather': 300 };
    expect(result(counts, 'grunt-shadow').effectiveCount).toBe(600);
  });

  it('flags — and clamps rather than going negative on — an over-subscribed parent', () => {
    const bad = inputs({ wild: 100, 'community-day': 400 });
    const issues = validate(bad);
    expect(issues.some((i) => i.sourceId === 'wild' && i.severity === 'error')).toBe(true);
    expect(computeSources(bad, 'mid').find((r) => r.def.id === 'wild')!.effectiveCount).toBe(0);
  });

  it('is silent when the subsets fit', () => {
    expect(validate(inputs({ wild: 10_000, 'community-day': 400 }))).toHaveLength(0);
  });
});

describe('independence of shiny and IV rolls', () => {
  it('gives P(shundo) = P(shiny) * P(hundo) per source', () => {
    const r = result({ 'raid-t5': 1 }, 'raid-t5');
    expect(r.lambdaShundo).toBeCloseTo(r.shinyP * r.hundoP, 15);
  });

  it('sums lambda across sources', () => {
    const out = runModel(inputs({ wild: 20_000, 'raid-t5': 300, eggs: 800 }), 'mid');
    const manual = out.sources.reduce((a, r) => a + r.lambdaShiny, 0);
    expect(out.lambdaShiny).toBeCloseTo(manual, 12);
  });
});

describe('scenarios', () => {
  it('orders shiny expectations low <= mid <= high', () => {
    const counts = { wild: 40_000, 'raid-t5': 500, eggs: 1_200, 'grunt-shadow': 3_000 };
    const lo = runModel(inputs(counts), 'low');
    const mid = runModel(inputs(counts), 'mid');
    const hi = runModel(inputs(counts), 'high');
    expect(lo.lambdaShiny).toBeLessThanOrEqual(mid.lambdaShiny);
    expect(mid.lambdaShiny).toBeLessThanOrEqual(hi.lambdaShiny);
    expect(lo.lambdaShundo).toBeLessThanOrEqual(hi.lambdaShundo);
  });

  it('leaves the hundo count untouched by the shiny rate scenario', () => {
    // IV floors are exact game mechanics; only the shiny rates are estimates.
    const counts = { wild: 40_000, 'raid-t5': 500, 'trade-lucky': 90 };
    expect(runModel(inputs(counts), 'low').lambdaHundo).toBeCloseTo(
      runModel(inputs(counts), 'high').lambdaHundo,
      12,
    );
  });
});

describe('overrides', () => {
  it('honours a runtime shiny-rate override', () => {
    const out = computeSources(
      { ...emptyInputs(), counts: { wild: 1000 }, overrides: { wild: { mid: 0.5 } } },
      'mid',
    );
    expect(out.find((r) => r.def.id === 'wild')!.lambdaShiny).toBeCloseTo(500, 9);
  });

  it('honours a runtime IV floor override', () => {
    const out = computeSources(
      { ...emptyInputs(), counts: { 'raid-t5': 216 }, overrides: { 'raid-t5': { ivFloor: 15 } } },
      'mid',
    );
    expect(out.find((r) => r.def.id === 'raid-t5')!.hundoP).toBeCloseTo(1, 12);
  });
});

describe('whole-model sanity', () => {
  it('produces a distribution that never exceeds unit mass', () => {
    const out = runModel(
      inputs({
        wild: 120_000,
        'wild-weather': 30_000,
        'community-day': 4_000,
        'event-wild': 6_000,
        eggs: 2_400,
        research: 3_000,
        'raid-t14': 1_800,
        'raid-t5': 900,
        'shadow-raid': 60,
        'grunt-shadow': 5_000,
        'grunt-shadow-weather': 1_200,
        'leader-shadow': 400,
        giovanni: 30,
        'trade-lucky': 150,
        'trade-best': 600,
      }),
      'mid',
    );
    for (const d of [out.shiny, out.hundo, out.shundo]) {
      const total = d.exact.reduce((a, b) => a + b, 0) + d.tail;
      expect(total).toBeCloseTo(1, 9);
      expect(d.diverges).toBe(false);
    }
    expect(out.lambdaShiny).toBeGreaterThan(0);
  });

  it('returns an all-zero model for empty inputs', () => {
    const out = runModel(emptyInputs(), 'mid');
    expect(out.lambdaShiny).toBe(0);
    expect(out.shiny.exact[0]).toBe(1);
    expect(out.validation).toHaveLength(0);
  });
});
