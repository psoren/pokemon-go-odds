import { describe, expect, it } from 'vitest';
import {
  DERIVED_SOURCES,
  MEDAL_SOURCES,
  SOURCES,
  SOURCES_BY_ID,
  childrenOf,
  depthOf,
} from '../config/rates';
import { MEDALS, TIERS } from '../config/medals';
import { computeSources, emptyInputs, resolveCounts, runModel, validate } from './forward';
import { hundoProbability, purifiedHundoProbability } from './math';
import type { ModelInputs } from './types';

function inputs(counts: Record<string, number>, patch: Partial<ModelInputs> = {}): ModelInputs {
  return { ...emptyInputs(), counts, ...patch };
}

const result = (counts: Record<string, number>, id: string, patch?: Partial<ModelInputs>) =>
  computeSources(inputs(counts, patch), 'mid').find((r) => r.def.id === id)!;

/** Zero out every derived fraction, so only what you typed exists. */
function noAssumptions(): Record<string, { low: number; mid: number; high: number }> {
  return Object.fromEntries(
    DERIVED_SOURCES.map((s) => [s.id, { low: 0, mid: 0, high: 0 }]),
  );
}

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

  it('gives trade and reference sources no shiny rate at all', () => {
    for (const s of SOURCES.filter((x) => x.kind === 'trade' || x.kind === 'reference')) {
      expect(s.shinyRate, s.id).toBeUndefined();
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
    expect(SOURCES_BY_ID['collector'].ivFloor).toBe(0);
    expect(SOURCES_BY_ID['wild-weather'].ivFloor).toBe(4);
    expect(SOURCES_BY_ID['research'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['eggs'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['raid-champion'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['raid-legend'].ivFloor).toBe(10);
    expect(SOURCES_BY_ID['shadow-raid'].ivFloor).toBe(6);
    expect(SOURCES_BY_ID['rocket-hero'].ivFloor).toBe(0);
    expect(SOURCES_BY_ID['grunt-shadow-weather'].ivFloor).toBe(4);
    expect(SOURCES_BY_ID['giovanni'].ivFloor).toBe(6);
  });
});

describe('medals are the only typed inputs', () => {
  it('splits every source into exactly one of medal-backed, derived, or remainder', () => {
    for (const s of SOURCES) {
      const isMedal = s.medal !== null;
      const isDerived = s.derivedFrom !== undefined;
      const isRemainder = !isMedal && !isDerived;
      expect([isMedal, isDerived, isRemainder].filter(Boolean).length, s.id).toBe(1);
      // A source with no medal must explain itself.
      if (!isMedal) expect(s.medalNote, s.id).toBeTruthy();
      // A remainder must hang off a parent to be the remainder OF something.
      if (isRemainder) expect(s.subsetOf, s.id).toBeTruthy();
    }
  });

  it('exposes exactly the nine medals a player can read off the Medals screen', () => {
    expect(MEDAL_SOURCES.map((s) => s.medal!.name).sort()).toEqual([
      'Battle Legend',
      'Breeder',
      'Champion',
      'Collector',
      'Gentleman',
      'Hero',
      'Pokémon Ranger',
      'Purifier',
      'Ultra Hero',
    ]);
  });

  it('derives every non-medal count from a source that exists', () => {
    for (const s of DERIVED_SOURCES) {
      const parent = SOURCES_BY_ID[s.derivedFrom!.parentId];
      expect(parent, `${s.id} -> ${s.derivedFrom!.parentId}`).toBeDefined();
      expect(s.derivedFrom!.rationale.length).toBeGreaterThan(20);
    }
  });

  it('orders every derived fraction low <= mid <= high within [0, 1]', () => {
    for (const s of DERIVED_SOURCES) {
      const f = s.derivedFrom!.fraction;
      expect(f.low, s.id).toBeLessThanOrEqual(f.mid);
      expect(f.mid, s.id).toBeLessThanOrEqual(f.high);
      expect(f.low, s.id).toBeGreaterThanOrEqual(0);
      expect(f.high, s.id).toBeLessThanOrEqual(1);
    }
  });

  it('keeps sibling derived fractions from over-subscribing their parent at mid', () => {
    const parents = new Set(DERIVED_SOURCES.map((s) => s.derivedFrom!.parentId));
    for (const parentId of parents) {
      const total = DERIVED_SOURCES.filter((s) => s.derivedFrom!.parentId === parentId).reduce(
        (a, s) => a + s.derivedFrom!.fraction.mid,
        0,
      );
      expect(total, `${parentId} derived siblings at mid`).toBeLessThanOrEqual(1);
    }
  });

  it('uses the documented platinum thresholds', () => {
    expect(MEDALS.collector.platinum).toBe(50_000);
    expect(MEDALS.breeder.platinum).toBe(2_500);
    expect(MEDALS.ranger.platinum).toBe(2_500);
    expect(MEDALS.champion.platinum).toBe(2_000);
    expect(MEDALS.battleLegend.platinum).toBe(2_000);
    expect(MEDALS.hero.platinum).toBe(2_000);
    expect(MEDALS.ultraHero.platinum).toBe(50);
    expect(MEDALS.purifier.platinum).toBe(1_000);
    expect(MEDALS.gentleman.platinum).toBe(2_500);
  });

  it('has strictly increasing tier thresholds on every medal', () => {
    for (const [key, medal] of Object.entries(MEDALS)) {
      for (let i = 1; i < TIERS.length; i++) {
        expect(medal[TIERS[i]], `${key} ${TIERS[i]}`).toBeGreaterThan(medal[TIERS[i - 1]]);
      }
      expect(medal.description, key).toContain('___');
    }
  });
});

describe('deriving counts from medals', () => {
  it('produces a full model from medals alone', () => {
    const out = runModel(
      inputs({
        collector: 180_000,
        'raid-champion': 2_700,
        'raid-legend': 900,
        'rocket-hero': 6_600,
        giovanni: 30,
        research: 3_000,
        eggs: 2_400,
        gentleman: 1_400,
        purifier: 300,
      }),
      'mid',
    );
    expect(out.lambdaShiny).toBeGreaterThan(0);
    expect(out.lambdaShundo).toBeGreaterThan(0);
    expect(out.validation).toHaveLength(0);
    // Every derived source got a count without the user typing one.
    for (const s of DERIVED_SOURCES) {
      const row = out.sources.find((r) => r.def.id === s.id)!;
      expect(row.rawCount, s.id).toBeGreaterThan(0);
    }
  });

  it('scales derived counts with the medal they hang off', () => {
    const small = result({ gentleman: 1_000 }, 'trades-shiny').rawCount;
    const big = result({ gentleman: 10_000 }, 'trades-shiny').rawCount;
    expect(big).toBeCloseTo(small * 10, -1);
  });

  it('applies the configured fraction exactly', () => {
    const f = SOURCES_BY_ID['community-day'].derivedFrom!.fraction.mid;
    expect(result({ collector: 100_000 }, 'community-day').rawCount).toBe(
      Math.round(100_000 * f),
    );
  });

  it('honours a runtime assumption override', () => {
    const r = result({ gentleman: 1_000 }, 'trades-shiny', {
      assumptions: { 'trades-shiny': { mid: 0.5 } },
    });
    expect(r.rawCount).toBe(500);
  });

  it('gives Best Friend trades the remainder of the shiny trades', () => {
    const counts = { gentleman: 10_000 };
    const shiny = result(counts, 'trades-shiny').rawCount;
    const assigned = ['trade-lucky', 'trade-good', 'trade-great', 'trade-ultra'].reduce(
      (a, id) => a + result(counts, id).rawCount,
      0,
    );
    expect(result(counts, 'trade-best').rawCount).toBe(shiny - assigned);
  });

  it('collapses to typed medals only when every assumption is zeroed', () => {
    const patch = { assumptions: noAssumptions() };
    const counts = { collector: 50_000, gentleman: 2_000 };
    for (const s of DERIVED_SOURCES) {
      expect(result(counts, s.id, patch).rawCount, s.id).toBe(0);
    }
    // With no shiny trades assumed, there is nothing left for Best Friend either.
    expect(result(counts, 'trade-best', patch).rawCount).toBe(0);
    // The Collector remainder is then the whole medal.
    expect(result(counts, 'collector', patch).effectiveCount).toBe(50_000);
  });

  it('varies derived counts across scenarios, widening the headline range', () => {
    const counts = { collector: 100_000, gentleman: 5_000 };
    const lo = runModel(inputs(counts), 'low');
    const hi = runModel(inputs(counts), 'high');
    const loCd = lo.sources.find((r) => r.def.id === 'community-day')!.rawCount;
    const hiCd = hi.sources.find((r) => r.def.id === 'community-day')!.rawCount;
    expect(hiCd).toBeGreaterThan(loCd);
    expect(hi.lambdaShiny).toBeGreaterThan(lo.lambdaShiny);
    expect(hi.lambdaShundo).toBeGreaterThan(lo.lambdaShundo);
  });
});

describe('medal nesting', () => {
  it('points every subsetOf at a source that exists', () => {
    for (const s of SOURCES) {
      if (!s.subsetOf) continue;
      expect(SOURCES_BY_ID[s.subsetOf], `${s.id} -> ${s.subsetOf}`).toBeDefined();
    }
  });

  it('has an acyclic subset graph with the expected roots', () => {
    for (const s of SOURCES) {
      expect(depthOf(s.id), `${s.id} depth`).toBeLessThan(8);
    }
    const roots = SOURCES.filter((s) => !s.subsetOf).map((s) => s.id).sort();
    expect(roots).toEqual(['collector', 'eggs', 'gentleman', 'purifier']);
  });

  it('nests raids and Rocket two levels deep under Collector', () => {
    expect(depthOf('collector')).toBe(0);
    expect(depthOf('raid-champion')).toBe(1);
    expect(depthOf('raid-legend')).toBe(2);
    expect(depthOf('shadow-raid')).toBe(2);
    expect(depthOf('rocket-hero')).toBe(1);
    expect(depthOf('giovanni')).toBe(2);
    expect(depthOf('trade-lucky')).toBe(2);
  });

  it('keeps eggs out of the Collector subtree — hatching is not catching', () => {
    expect(SOURCES_BY_ID['eggs'].subsetOf).toBeUndefined();
    expect(childrenOf('collector').map((c) => c.id)).not.toContain('eggs');
  });

  it('subtracts a full two-level tree correctly', () => {
    const patch = { assumptions: noAssumptions() };
    const counts = {
      collector: 100_000,
      research: 1_000,
      'raid-champion': 2_000,
      'raid-legend': 500,
      'rocket-hero': 5_000,
      giovanni: 30,
    };
    expect(result(counts, 'collector', patch).effectiveCount).toBe(
      100_000 - (1_000 + 2_000 + 5_000),
    );
    expect(result(counts, 'raid-champion', patch).effectiveCount).toBe(2_000 - 500);
    expect(result(counts, 'rocket-hero', patch).effectiveCount).toBe(5_000 - 30);
    expect(validate(inputs(counts, patch))).toHaveLength(0);
  });

  it('never double counts: effective totals equal the medal roots', () => {
    const patch = { assumptions: noAssumptions() };
    const counts = {
      collector: 60_000,
      'raid-champion': 1_000,
      'raid-legend': 300,
      'rocket-hero': 2_000,
      giovanni: 20,
      eggs: 800,
    };
    const total = computeSources(inputs(counts, patch), 'mid')
      .filter((r) => r.def.kind === 'catch' || r.def.kind === 'shadow')
      .reduce((a, r) => a + r.effectiveCount, 0);
    // Collector (60k) + Breeder (800). Everything else is carved out of Collector.
    expect(total).toBe(60_800);
  });

  it('flags — and clamps rather than going negative on — an over-subscribed parent', () => {
    const bad = inputs({ collector: 100, 'raid-champion': 400 });
    const issues = validate(bad);
    expect(issues.some((i) => i.sourceId === 'collector' && i.severity === 'error')).toBe(true);
    expect(
      computeSources(bad, 'mid').find((r) => r.def.id === 'collector')!.effectiveCount,
    ).toBe(0);
  });

  it('names the offending medal in the validation message', () => {
    const issues = validate(
      inputs({ collector: 500_000, 'raid-champion': 10, 'raid-legend': 90 }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].sourceId).toBe('raid-champion');
    expect(issues[0].message).toContain('Champion');
  });

  it('stays quiet about a parent that has simply not been entered yet', () => {
    expect(validate(inputs({ 'raid-champion': 1_000 }))).toHaveLength(0);
    expect(result({ 'raid-champion': 1_000 }, 'raid-legend').effectiveCount).toBe(0);
  });

  it('never lets the Best Friend remainder push its parent over', () => {
    // The remainder absorbs slack by construction, so it can never cause an error.
    expect(validate(inputs({ gentleman: 5_000 }))).toHaveLength(0);
  });
});

describe('trades are re-rolls, not new Pokémon', () => {
  it('never increases the shiny expected count', () => {
    const base = runModel(inputs({ collector: 50_000, 'raid-legend': 400 }), 'mid');
    const withTrades = runModel(
      inputs({ collector: 50_000, 'raid-legend': 400, gentleman: 3_000 }),
      'mid',
    );
    expect(withTrades.lambdaShiny).toBeCloseTo(base.lambdaShiny, 12);
    // …but they do add shundos.
    expect(withTrades.lambdaShundo).toBeGreaterThan(base.lambdaShundo);
  });

  it('contributes zero shiny lambda from every trade source individually', () => {
    for (const s of SOURCES.filter((x) => x.kind === 'trade')) {
      expect(result({ gentleman: 10_000 }, s.id).lambdaShiny, s.id).toBe(0);
    }
  });

  it('contributes zero to the shiny distribution', () => {
    const only = runModel(inputs({ gentleman: 5_000 }), 'mid');
    expect(only.lambdaShiny).toBe(0);
    expect(only.shiny.exact[0]).toBeCloseTo(1, 12);
  });

  it('does increase the shundo count via a fresh IV roll at the trade floor', () => {
    // Pin the derived counts so the arithmetic is exact: 64 lucky shiny trades.
    const r = result({ gentleman: 640 }, 'trade-lucky', {
      assumptions: {
        'trades-shiny': { mid: 0.2 },
        'trade-lucky': { mid: 0.5 },
        'trade-good': { mid: 0 },
        'trade-great': { mid: 0 },
        'trade-ultra': { mid: 0 },
      },
    });
    expect(r.rawCount).toBe(64);
    // 64 shiny trades at floor 12 -> 64 * 1/64 = 1 expected shundo.
    expect(r.lambdaShundo).toBeCloseTo(1, 12);
    // A shundo is also a hundo.
    expect(r.lambdaHundo).toBeCloseTo(1, 12);
  });

  it('makes a lucky trade ~21x better than a best-friend trade per shiny', () => {
    expect(hundoProbability(12) / hundoProbability(5)).toBeCloseTo(1331 / 64, 9);
  });

  it('is not carved out of any catch medal', () => {
    const patch = { assumptions: noAssumptions() };
    const withoutTrades = result({ collector: 10_000 }, 'collector', patch).effectiveCount;
    const withTrades = result(
      { collector: 10_000, gentleman: 5_000 },
      'collector',
      patch,
    ).effectiveCount;
    expect(withTrades).toBe(withoutTrades);
  });

  it('gives reference medals zero lambda of their own', () => {
    for (const id of ['gentleman', 'trades-shiny', 'purifier']) {
      const r = result({ gentleman: 5_000, purifier: 500 }, id);
      expect(r.lambdaShiny, id).toBe(0);
      expect(r.lambdaHundo, id).toBe(0);
      expect(r.lambdaShundo, id).toBe(0);
    }
  });
});

describe('purification comes from the Purifier medal', () => {
  const patch = { assumptions: noAssumptions() };

  it('applies nothing when the Purifier medal is empty', () => {
    const r = result({ 'rocket-hero': 4096 }, 'rocket-hero', patch);
    expect(r.purifiedFraction).toBe(0);
    expect(r.lambdaHundo).toBeCloseTo(1, 12);
  });

  it('applies fully when every shadow has been purified', () => {
    const r = result({ 'rocket-hero': 4096, purifier: 4096 }, 'rocket-hero', patch);
    expect(r.purifiedFraction).toBe(1);
    expect(r.lambdaHundo).toBeCloseTo(27, 12);
  });

  it('blends the two paths in between', () => {
    const r = result({ 'rocket-hero': 4096, purifier: 1024 }, 'rocket-hero', patch);
    expect(r.purifiedFraction).toBeCloseTo(0.25, 12);
    // 0.75 * 1 + 0.25 * 27
    expect(r.lambdaHundo).toBeCloseTo(0.75 * 1 + 0.25 * 27, 12);
  });

  it('clamps at 1 when more purifications than shadows are claimed', () => {
    const r = result({ 'rocket-hero': 100, purifier: 9_999 }, 'rocket-hero', patch);
    expect(r.purifiedFraction).toBe(1);
  });

  it('divides by effective shadow counts, not the raw Hero total', () => {
    // Hero 1000 with Giovanni 200 carved out is still 1000 shadows in total,
    // so a Purifier of 500 is half — the nesting must not inflate the divisor.
    const r = result({ 'rocket-hero': 1_000, giovanni: 200, purifier: 500 }, 'giovanni', patch);
    expect(r.purifiedFraction).toBeCloseTo(0.5, 12);
  });

  it('leaves non-shadow sources untouched', () => {
    const r = result({ 'raid-legend': 500, 'rocket-hero': 100, purifier: 100 }, 'raid-legend', patch);
    expect(r.purifiedFraction).toBe(0);
    expect(r.lambdaHundo).toBeCloseTo(500 * hundoProbability(10), 12);
  });

  it('still reports both pure endpoints side by side', () => {
    const r = result({ giovanni: 1000, 'rocket-hero': 1000, purifier: 500 }, 'giovanni', patch);
    expect(r.lambdaHundoAsCaught).toBeCloseTo(1000 * hundoProbability(6), 12);
    expect(r.lambdaHundoPurified).toBeCloseTo(1000 * purifiedHundoProbability(6), 12);
  });

  it('lets a shiny shadow purify into a shundo', () => {
    const r = result({ giovanni: 1000, purifier: 1000 }, 'giovanni', patch);
    expect(r.lambdaShundo).toBeCloseTo(1000 * r.shinyP * purifiedHundoProbability(6), 12);
  });
});

describe('independence of shiny and IV rolls', () => {
  it('gives P(shundo) = P(shiny) * P(hundo) per source', () => {
    const r = result({ 'raid-champion': 1, 'raid-legend': 1 }, 'raid-legend');
    expect(r.lambdaShundo).toBeCloseTo(r.shinyP * r.hundoP, 15);
  });

  it('sums lambda across sources', () => {
    const out = runModel(inputs({ collector: 20_000, 'raid-legend': 300, eggs: 800 }), 'mid');
    const manual = out.sources.reduce((a, r) => a + r.lambdaShiny, 0);
    expect(out.lambdaShiny).toBeCloseTo(manual, 12);
  });
});

describe('scenarios', () => {
  const counts = {
    collector: 40_000,
    'raid-champion': 800,
    'raid-legend': 500,
    eggs: 1_200,
    'rocket-hero': 3_000,
    gentleman: 2_000,
  };

  it('orders shiny expectations low <= mid <= high', () => {
    const lo = runModel(inputs(counts), 'low');
    const mid = runModel(inputs(counts), 'mid');
    const hi = runModel(inputs(counts), 'high');
    expect(lo.lambdaShiny).toBeLessThanOrEqual(mid.lambdaShiny);
    expect(mid.lambdaShiny).toBeLessThanOrEqual(hi.lambdaShiny);
    expect(lo.lambdaShundo).toBeLessThanOrEqual(hi.lambdaShundo);
  });

  it('lets the hundo count move only through the derived splits, not the rates', () => {
    // IV floors are exact, so with the splits pinned the hundo count is scenario-free.
    const patch = { assumptions: noAssumptions() };
    expect(runModel(inputs(counts, patch), 'low').lambdaHundo).toBeCloseTo(
      runModel(inputs(counts, patch), 'high').lambdaHundo,
      12,
    );
  });
});

describe('overrides', () => {
  it('honours a runtime shiny-rate override', () => {
    const out = computeSources(
      {
        ...emptyInputs(),
        counts: { collector: 1000 },
        overrides: { collector: { mid: 0.5 } },
        assumptions: noAssumptions(),
      },
      'mid',
    );
    expect(out.find((r) => r.def.id === 'collector')!.lambdaShiny).toBeCloseTo(500, 9);
  });

  it('honours a runtime IV floor override', () => {
    const out = computeSources(
      {
        ...emptyInputs(),
        counts: { 'raid-champion': 300, 'raid-legend': 216 },
        overrides: { 'raid-legend': { ivFloor: 15 } },
      },
      'mid',
    );
    expect(out.find((r) => r.def.id === 'raid-legend')!.hundoP).toBeCloseTo(1, 12);
  });
});

describe('whole-model sanity', () => {
  it('produces a distribution that never exceeds unit mass', () => {
    const out = runModel(
      inputs({
        collector: 180_000,
        research: 3_000,
        'raid-champion': 2_700,
        'raid-legend': 900,
        'rocket-hero': 6_600,
        giovanni: 30,
        eggs: 2_400,
        gentleman: 1_400,
        purifier: 400,
      }),
      'mid',
    );
    for (const d of [out.shiny, out.hundo, out.shundo]) {
      const total = d.exact.reduce((a, b) => a + b, 0) + d.tail;
      expect(total).toBeCloseTo(1, 9);
      expect(d.diverges).toBe(false);
    }
    expect(out.validation).toHaveLength(0);
  });

  it('handles every medal sitting at exactly platinum', () => {
    const out = runModel(
      inputs({
        collector: MEDALS.collector.platinum,
        'raid-champion': MEDALS.champion.platinum,
        'raid-legend': MEDALS.battleLegend.platinum,
        'rocket-hero': MEDALS.hero.platinum,
        giovanni: MEDALS.ultraHero.platinum,
        research: MEDALS.ranger.platinum,
        eggs: MEDALS.breeder.platinum,
        gentleman: MEDALS.gentleman.platinum,
        purifier: MEDALS.purifier.platinum,
      }),
      'mid',
    );
    expect(out.lambdaShiny).toBeGreaterThan(0);
    expect(out.lambdaShundo).toBeGreaterThan(0);
    for (const r of out.sources) {
      expect(r.effectiveCount, r.def.id).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.lambdaShundo), r.def.id).toBe(true);
    }
  });

  it('resolves every source id exactly once', () => {
    const resolved = resolveCounts(inputs({ collector: 1_000, gentleman: 100 }), 'mid');
    expect(Object.keys(resolved).sort()).toEqual(SOURCES.map((s) => s.id).sort());
  });

  it('returns an all-zero model for empty inputs', () => {
    const out = runModel(emptyInputs(), 'mid');
    expect(out.lambdaShiny).toBe(0);
    expect(out.lambdaShundo).toBe(0);
    expect(out.shiny.exact[0]).toBe(1);
    expect(out.validation).toHaveLength(0);
    expect(out.purifiedFraction).toBe(0);
  });
});
