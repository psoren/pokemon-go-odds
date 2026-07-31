import { describe, expect, it } from 'vitest';
import { SOURCES, SOURCES_BY_ID, childrenOf, depthOf } from '../config/rates';
import { MEDALS, TIERS } from '../config/medals';
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

describe('medal mapping', () => {
  it('declares a medal or an explicit no-medal note for every source', () => {
    for (const s of SOURCES) {
      expect(s.medal !== undefined, `${s.id} must declare medal (or null)`).toBe(true);
      if (s.medal === null) {
        expect(s.medalNote, `${s.id} has no medal so needs a medalNote`).toBeTruthy();
        expect(s.medalNote!.length).toBeGreaterThan(20);
      }
    }
  });

  it('has strictly increasing tier thresholds on every medal', () => {
    for (const [key, medal] of Object.entries(MEDALS)) {
      for (let i = 1; i < TIERS.length; i++) {
        expect(medal[TIERS[i]], `${key} ${TIERS[i]}`).toBeGreaterThan(medal[TIERS[i - 1]]);
      }
      expect(medal.description, key).toContain('___');
    }
  });

  it('maps each count to the medal that actually tracks it', () => {
    expect(SOURCES_BY_ID['collector'].medal?.name).toBe('Collector');
    expect(SOURCES_BY_ID['eggs'].medal?.name).toBe('Breeder');
    expect(SOURCES_BY_ID['research'].medal?.name).toBe('Pokémon Ranger');
    expect(SOURCES_BY_ID['raid-champion'].medal?.name).toBe('Champion');
    expect(SOURCES_BY_ID['raid-legend'].medal?.name).toBe('Battle Legend');
    expect(SOURCES_BY_ID['rocket-hero'].medal?.name).toBe('Hero');
    expect(SOURCES_BY_ID['giovanni'].medal?.name).toBe('Ultra Hero');
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

  it('claims no medal for the things no medal tracks', () => {
    // Weather boost, Community Day, events, shadow raids, leaders and shiny
    // trades genuinely have no medal. Pretending otherwise would be worse than
    // asking the user to estimate.
    for (const id of [
      'wild-weather',
      'community-day',
      'event-wild',
      'shadow-raid',
      'leader-shadow',
      'grunt-shadow-weather',
      'trade-lucky',
      'trade-best',
    ]) {
      expect(SOURCES_BY_ID[id].medal, id).toBeNull();
    }
  });
});

describe('medal nesting', () => {
  it('points every subsetOf at a source that exists', () => {
    for (const s of SOURCES) {
      if (!s.subsetOf) continue;
      expect(SOURCES_BY_ID[s.subsetOf], `${s.id} -> ${s.subsetOf}`).toBeDefined();
    }
  });

  it('has an acyclic subset graph rooted at Collector, Breeder and the trades', () => {
    for (const s of SOURCES) {
      expect(depthOf(s.id), `${s.id} depth`).toBeLessThan(8);
    }
    const roots = SOURCES.filter((s) => !s.subsetOf).map((s) => s.id);
    expect(roots).toContain('collector');
    expect(roots).toContain('eggs');
    // Trades are re-rolls of Pokémon counted elsewhere, so they are their own roots.
    expect(roots.filter((id) => id.startsWith('trade-'))).toHaveLength(5);
  });

  it('nests raids and Rocket two levels deep under Collector', () => {
    expect(depthOf('collector')).toBe(0);
    expect(depthOf('raid-champion')).toBe(1);
    expect(depthOf('raid-legend')).toBe(2);
    expect(depthOf('shadow-raid')).toBe(2);
    expect(depthOf('rocket-hero')).toBe(1);
    expect(depthOf('giovanni')).toBe(2);
    expect(depthOf('eggs')).toBe(0);
  });

  it('keeps eggs out of the Collector subtree — hatching is not catching', () => {
    expect(SOURCES_BY_ID['eggs'].subsetOf).toBeUndefined();
    expect(childrenOf('collector').map((c) => c.id)).not.toContain('eggs');
  });

  it('subtracts a full two-level tree correctly', () => {
    const counts = {
      collector: 100_000,
      'wild-weather': 20_000,
      'community-day': 3_000,
      'event-wild': 4_000,
      research: 1_000,
      'raid-champion': 2_000,
      'raid-legend': 500,
      'shadow-raid': 100,
      'rocket-hero': 5_000,
      'grunt-shadow-weather': 500,
      'leader-shadow': 200,
      giovanni: 30,
    };
    // Collector loses each DIRECT child's full raw count.
    expect(result(counts, 'collector').effectiveCount).toBe(
      100_000 - (20_000 + 3_000 + 4_000 + 1_000 + 2_000 + 5_000),
    );
    // Champion keeps only the tier 1-4 remainder.
    expect(result(counts, 'raid-champion').effectiveCount).toBe(2_000 - 500 - 100);
    // Hero keeps only the plain unboosted grunts.
    expect(result(counts, 'rocket-hero').effectiveCount).toBe(5_000 - 500 - 200 - 30);
    // Leaves keep their raw counts.
    expect(result(counts, 'raid-legend').effectiveCount).toBe(500);
    expect(result(counts, 'giovanni').effectiveCount).toBe(30);
    expect(validate(inputs(counts))).toHaveLength(0);
  });

  it('never double counts: total effective count equals the roots', () => {
    const counts = {
      collector: 60_000,
      'wild-weather': 10_000,
      'raid-champion': 1_000,
      'raid-legend': 300,
      'rocket-hero': 2_000,
      giovanni: 20,
      eggs: 800,
    };
    const total = computeSources(inputs(counts), 'mid')
      .filter((r) => r.def.kind !== 'trade')
      .reduce((a, r) => a + r.effectiveCount, 0);
    // Collector (60k) + Breeder (800). Everything else is carved out of Collector.
    expect(total).toBe(60_800);
  });
});

describe('trades are re-rolls, not new Pokémon', () => {
  it('never increases the shiny expected count', () => {
    const base = runModel(inputs({ collector: 50_000, 'raid-legend': 400 }), 'mid');
    const withTrades = runModel(
      inputs({
        collector: 50_000,
        'raid-legend': 400,
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

  it('is not carved out of any medal total', () => {
    // Trades re-roll Pokémon already counted; they must not reduce a parent.
    const withoutTrades = result({ collector: 10_000 }, 'collector').effectiveCount;
    const withTrades = result({ collector: 10_000, 'trade-lucky': 500 }, 'collector')
      .effectiveCount;
    expect(withTrades).toBe(withoutTrades);
  });
});

describe('shadows', () => {
  it('reports as-caught and purified hundo lambdas side by side', () => {
    const r = result({ giovanni: 1000 }, 'giovanni');
    expect(r.lambdaHundoAsCaught).toBeCloseTo(1000 * hundoProbability(6), 12);
    expect(r.lambdaHundoPurified).toBeCloseTo(1000 * purifiedHundoProbability(6), 12);
    // floor 6: 1/1000 as caught vs 27/1000 purified.
    expect(r.lambdaHundoAsCaught).toBeCloseTo(1, 12);
    expect(r.lambdaHundoPurified).toBeCloseTo(27, 12);
  });

  it('switches the active hundo path when purification is assumed', () => {
    const asCaught = result({ 'rocket-hero': 4096 }, 'rocket-hero');
    const purified = result({ 'rocket-hero': 4096 }, 'rocket-hero', { assumePurified: true });
    expect(asCaught.lambdaHundo).toBeCloseTo(1, 12);
    expect(purified.lambdaHundo).toBeCloseTo(27, 12);
  });

  it('leaves non-shadow sources untouched by the purification toggle', () => {
    const asCaught = result({ 'raid-legend': 500 }, 'raid-legend');
    const purified = result({ 'raid-legend': 500 }, 'raid-legend', { assumePurified: true });
    expect(purified.lambdaHundo).toBeCloseTo(asCaught.lambdaHundo, 12);
  });

  it('lets a shiny shadow purify into a shundo, but never trade into one', () => {
    const purified = result({ giovanni: 1000 }, 'giovanni', { assumePurified: true });
    expect(purified.lambdaShundo).toBeCloseTo(
      1000 * purified.shinyP * purifiedHundoProbability(6),
      12,
    );
    // No shadow source is a trade source, so none can gain a trade re-roll.
    for (const s of SOURCES.filter((x) => x.kind === 'shadow')) {
      expect(s.kind).not.toBe('trade');
    }
  });
});

describe('subset sources are subtracted, not added', () => {
  it('carves Community Day and weather-boosted catches out of the Collector total', () => {
    const counts = { collector: 10_000, 'community-day': 1_500, 'wild-weather': 2_000 };
    expect(result(counts, 'collector').effectiveCount).toBe(6_500);
    expect(result(counts, 'community-day').effectiveCount).toBe(1_500);
    expect(result(counts, 'wild-weather').effectiveCount).toBe(2_000);
  });

  it('carves weather-boosted shadows out of the Hero total', () => {
    const counts = { 'rocket-hero': 900, 'grunt-shadow-weather': 300 };
    expect(result(counts, 'rocket-hero').effectiveCount).toBe(600);
  });

  it('flags — and clamps rather than going negative on — an over-subscribed parent', () => {
    const bad = inputs({ collector: 100, 'community-day': 400 });
    const issues = validate(bad);
    expect(issues.some((i) => i.sourceId === 'collector' && i.severity === 'error')).toBe(true);
    expect(
      computeSources(bad, 'mid').find((r) => r.def.id === 'collector')!.effectiveCount,
    ).toBe(0);
  });

  it('names the offending medal in the validation message', () => {
    const issues = validate(
      inputs({ collector: 50_000, 'raid-champion': 10, 'raid-legend': 90 }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].sourceId).toBe('raid-champion');
    expect(issues[0].message).toContain('Champion');
  });

  it('stays quiet about a parent that has simply not been entered yet', () => {
    // Mid-entry: raids typed, Collector still blank. Not an error.
    expect(validate(inputs({ 'raid-champion': 1_000 }))).toHaveLength(0);
    // The children still contribute in full.
    expect(result({ 'raid-champion': 1_000 }, 'raid-champion').effectiveCount).toBe(1_000);
  });

  it('is silent when the subsets fit', () => {
    expect(validate(inputs({ collector: 10_000, 'community-day': 400 }))).toHaveLength(0);
  });
});

describe('independence of shiny and IV rolls', () => {
  it('gives P(shundo) = P(shiny) * P(hundo) per source', () => {
    const r = result({ 'raid-legend': 1 }, 'raid-legend');
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
    'raid-legend': 500,
    eggs: 1_200,
    'rocket-hero': 3_000,
  };

  it('orders shiny expectations low <= mid <= high', () => {
    const lo = runModel(inputs(counts), 'low');
    const mid = runModel(inputs(counts), 'mid');
    const hi = runModel(inputs(counts), 'high');
    expect(lo.lambdaShiny).toBeLessThanOrEqual(mid.lambdaShiny);
    expect(mid.lambdaShiny).toBeLessThanOrEqual(hi.lambdaShiny);
    expect(lo.lambdaShundo).toBeLessThanOrEqual(hi.lambdaShundo);
  });

  it('leaves the hundo count untouched by the shiny rate scenario', () => {
    // IV floors are exact game mechanics; only the shiny rates are estimates.
    const withTrades = { ...counts, 'trade-lucky': 90 };
    expect(runModel(inputs(withTrades), 'low').lambdaHundo).toBeCloseTo(
      runModel(inputs(withTrades), 'high').lambdaHundo,
      12,
    );
  });
});

describe('overrides', () => {
  it('honours a runtime shiny-rate override', () => {
    const out = computeSources(
      { ...emptyInputs(), counts: { collector: 1000 }, overrides: { collector: { mid: 0.5 } } },
      'mid',
    );
    expect(out.find((r) => r.def.id === 'collector')!.lambdaShiny).toBeCloseTo(500, 9);
  });

  it('honours a runtime IV floor override', () => {
    const out = computeSources(
      {
        ...emptyInputs(),
        counts: { 'raid-legend': 216 },
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
        'wild-weather': 45_000,
        'community-day': 6_000,
        'event-wild': 9_000,
        research: 3_000,
        'raid-champion': 2_700,
        'raid-legend': 900,
        'shadow-raid': 60,
        'rocket-hero': 6_600,
        'grunt-shadow-weather': 1_200,
        'leader-shadow': 400,
        giovanni: 30,
        eggs: 2_400,
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
    expect(out.validation).toHaveLength(0);
  });

  it('handles every medal sitting at exactly platinum', () => {
    // A maxed account: subsets must still fit inside their parents.
    const out = runModel(
      inputs({
        collector: MEDALS.collector.platinum,
        'raid-champion': MEDALS.champion.platinum,
        'raid-legend': MEDALS.battleLegend.platinum,
        'rocket-hero': MEDALS.hero.platinum,
        giovanni: MEDALS.ultraHero.platinum,
        research: MEDALS.ranger.platinum,
        eggs: MEDALS.breeder.platinum,
      }),
      'mid',
    );
    // Champion platinum == Battle Legend platinum, so the tier 1-4 remainder is 0.
    expect(out.sources.find((r) => r.def.id === 'raid-champion')!.effectiveCount).toBe(0);
    expect(out.validation).toHaveLength(0);
    expect(out.lambdaShiny).toBeGreaterThan(0);
  });

  it('returns an all-zero model for empty inputs', () => {
    const out = runModel(emptyInputs(), 'mid');
    expect(out.lambdaShiny).toBe(0);
    expect(out.shiny.exact[0]).toBe(1);
    expect(out.validation).toHaveLength(0);
  });
});
