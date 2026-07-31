/**
 * ALL RATE ESTIMATES, MEDAL MAPPINGS AND DERIVED-COUNT ASSUMPTIONS. No logic.
 *
 * Three kinds of data live here, and they deserve very different trust:
 *
 *  1. IV FLOORS and MEDAL THRESHOLDS are EXACT. IV floors are datamined game
 *     mechanics; medal names, in-game descriptions and tier thresholds are
 *     in-game text.
 *
 *  2. SHINY RATES are community estimates. Niantic has never published them.
 *     Mostly from The Silph Road's crowd-sourced tallies via Bulbapedia.
 *     Several are contested and they drift between events. Each carries a
 *     low/mid/high band and is editable at runtime.
 *
 *  3. DERIVED-COUNT FRACTIONS are ROUGH DEFAULTS AND NOTHING MORE. No medal
 *     tracks what share of your catches were weather-boosted, or how many of
 *     your trades were shiny. These fractions are here only so that entering
 *     nothing but your medals still produces a usable answer. They are not
 *     sourced, they are not measured, and they are deliberately given wide
 *     low/high bands so the uncertainty they inject shows up in the headline
 *     range instead of hiding.
 *
 * Rates are stored as PROBABILITIES, not denominators: `low` is the
 * pessimistic (rarest) end and `high` the optimistic (most common) end.
 *
 * ---------------------------------------------------------------------------
 * MEDAL NESTING — read this before changing `subsetOf`
 * ---------------------------------------------------------------------------
 * Medals contain each other. The Collector medal's text is an unqualified
 * "Catch ___ Pokémon", so it already includes the Pokémon you caught from
 * raids, from research and from Team GO Rocket. Sources therefore form a tree
 * and every child's count is subtracted from its parent:
 *
 *   Collector "Catch ___ Pokémon"                        [MEDAL]
 *   ├── weather-boosted / Community Day / other events   [derived]
 *   ├── Champion "Win ___ raids"                         [MEDAL]
 *   │   └── Shadow raids                                 [derived]
 *   ├── Battle Legend "Win ___ Legendary raids"          [MEDAL]
 *   ├── Ultra Hero "Defeat Giovanni ___ time(s)"         [MEDAL]
 *   ├── research encounters                             [derived from Ranger]
 *   └── Hero "Defeat ___ Team GO Rocket members"         [MEDAL]
 *       └── Leaders / weather-boosted grunts             [derived]
 *
 * INDEPENDENT COUNTERS — Battle Legend is NOT inside Champion, and Ultra Hero
 * is NOT inside Hero. Both were originally modelled as nested, on the reading
 * that "Win ___ raids" is unqualified. Real account data disproved it: a player
 * with Champion 530 and Battle Legend 664 is impossible if Champion contained
 * the Legendary wins. Niantic Support acknowledged Legendary raids not counting
 * toward Champion back in 2017 (x.com/NianticHelp/status/896014879294881794),
 * and the identical 2,000 platinum thresholds only make sense for independent
 * counters. They are therefore siblings under Collector, and both are entered
 * exactly as the game shows them.
 *
 *   Pokémon Ranger "Complete ___ Field Research tasks"   [MEDAL, own root]
 *   └── research encounters   (a share of tasks reward items, not a Pokémon)
 *   Breeder "Hatch ___ Eggs"                             [MEDAL, own root]
 *   Gentleman "Trade ___ Pokémon"                        [MEDAL, own root]
 *   └── shiny trades                                     [derived]
 *       ├── lucky / ultra / great / good                 [derived]
 *       └── best friend                                  [remainder]
 *   Purifier "Purify ___ Shadow Pokémon"                 [MEDAL, parameter]
 *
 * If a containment is wrong for your account the app will say so: subsets
 * summing to more than their parent is a hard validation error.
 */

import { MEDALS } from './medals';
import type { SourceDef } from '../model/types';

/** Convenience: 1-in-n as a probability. */
export const oneIn = (n: number): number => 1 / n;

/** Build a rate band from denominators (rarest, mid, most common). */
const band = (rarest: number, mid: number, common: number) => ({
  low: oneIn(rarest),
  mid: oneIn(mid),
  high: oneIn(common),
});

/** Build a derived-count fraction band from percentages. */
const pct = (low: number, mid: number, high: number) => ({
  low: low / 100,
  mid: mid / 100,
  high: high / 100,
});

const BULBAPEDIA_SHINY =
  'Bulbapedia, "Shiny Pokémon (GO)" — aggregates The Silph Road community tallies. https://bulbapedia.bulbagarden.net/wiki/Shiny_Pok%C3%A9mon_(GO)';
const DITTOBASE_FLOORS =
  'Dittobase, "Pokémon GO IV Floors by Encounter Type". https://www.dittobase.com/pokemon-go/iv-floors';
const NOT_SOURCED =
  'Not a sourced figure — no medal or community dataset tracks this. A rough default with a deliberately wide band; edit it if you know better.';

export const CATEGORIES = [
  'Catches',
  'Raids',
  'Team GO Rocket',
  'Eggs',
  'Trades',
] as const;

export const SOURCES: SourceDef[] = [
  // ============================================================== Collector ==
  {
    id: 'collector',
    label: 'Pokémon caught — all time',
    category: 'Catches',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(700, 512, 400),
    medal: MEDALS.collector,
    confidence: 'high',
    note:
      'Counts every Pokémon you have ever caught — including raid, research and ' +
      'Team GO Rocket catches, which is why those are subtracted from it. What is ' +
      'left over is treated as ordinary unboosted wild catches.',
    citation: `Shiny rate 1/512 base. ${BULBAPEDIA_SHINY} Silph Road's own estimates cluster around 1/450–1/512, so the MEASUREMENT uncertainty is much tighter than the band used here. The band is deliberately wider because it is also standing in for the shiny-ELIGIBLE share of your catches, which the model does not track separately: a catch of a species that had no shiny release at the time is a trial with p = 0, not p = 1/512, and on a long-lived account those are a large fraction of the total. See MODEL.md §4.1. Floor 0/0/0 for wild catches: ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'wild-weather',
    label: 'Weather-boosted catches',
    category: 'Catches',
    kind: 'catch',
    ivFloor: 4,
    shinyRate: band(700, 512, 400),
    subsetOf: 'collector',
    medal: null,
    medalNote: 'No medal tracks weather-boosted catches.',
    derivedFrom: {
      parentId: 'collector',
      fraction: pct(20, 30, 45),
      rationale:
        'Share of your catches made in boosted weather. Depends entirely on your ' +
        'climate and how much you play in the rain.',
    },
    confidence: 'high',
    note: 'Weather boost raises the IV floor from 0 to 4. It does NOT change the shiny rate.',
    citation: `Floor 4/4/4: ${DITTOBASE_FLOORS} Shiny rate identical to unboosted wild: ${BULBAPEDIA_SHINY} Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'community-day',
    label: 'Community Day featured species',
    category: 'Catches',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(30, 25, 20),
    subsetOf: 'collector',
    medal: null,
    medalNote:
      'No medal tracks Community Day catches — but the events themselves are a matter ' +
      'of record, so tick the ones you played rather than guessing a percentage.',
    derivedFromEvents: {
      per: { low: 40, mid: 120, high: 250 },
      rationale:
        'Featured-species catches per Community Day you attended. Three hours with a ' +
        'lure or incense puts a dedicated player in the low hundreds; a casual hour is ' +
        'well under one hundred.',
    },
    confidence: 'high',
    note:
      'Featured species only, during the event window. At ~1-in-25 shiny these are the ' +
      'richest ordinary source in the game, which is why the app asks which events you ' +
      'actually played instead of assuming a share of your catches.',
    citation: `~1/25 for the featured Pokémon during Community Days. ${BULBAPEDIA_SHINY} Event list from Bulbapedia and Nintendo Life (see src/config/communityDays.ts). Catches per event: ${NOT_SOURCED}`,
  },
  {
    id: 'event-wild',
    label: 'Other event-boosted catches',
    category: 'Catches',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(256, 128, 64),
    subsetOf: 'collector',
    medal: null,
    medalNote: 'No medal tracks event catches.',
    derivedFrom: {
      parentId: 'collector',
      fraction: pct(3, 8, 15),
      rationale:
        'GO Fest, Safari Zones, Raid/Research/Hatch Days, ticketed events. Both the ' +
        'share and the rate are guesses, so this term is doubly uncertain.',
    },
    confidence: 'low',
    note:
      'The shiny rate varies enormously by event (1/256 to 1/10), so this is the ' +
      'shakiest term in the model — override it if you know your own event mix.',
    citation: `Event tiers of 1/256, 1/128, 1/64, 1/25 and 1/10 are all documented. ${BULBAPEDIA_SHINY} Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'research',
    label: 'Field Research tasks completed',
    category: 'Catches',
    kind: 'reference',
    ivFloor: 0,
    medal: MEDALS.ranger,
    confidence: 'high',
    note:
      'Counts tasks COMPLETED, not Pokémon caught — a large share of tasks reward ' +
      'items or Stardust instead of an encounter. This is the denominator; the ' +
      'encounter count is derived from it below. Special and Timed Research are not ' +
      'counted by this medal at all.',
    citation:
      'Pokémon Ranger medal, "Complete ___ Field Research tasks". Bulbapedia, "Medal (GO)".',
  },
  {
    id: 'research-encounter',
    label: 'Research encounters',
    category: 'Catches',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(512, 64, 32),
    subsetOf: 'collector',
    medal: null,
    medalNote:
      'No medal counts research ENCOUNTERS — only tasks completed. Derived from your ' +
      'Pokémon Ranger medal.',
    derivedFrom: {
      parentId: 'research',
      fraction: pct(40, 60, 75),
      rationale:
        'Share of completed Field Research tasks that rewarded a Pokémon rather than ' +
        'items or Stardust. Leek Duck\u2019s task list runs about 70% encounter-rewarding, ' +
        'but a dozen tasks can give either, the pool rotates monthly, and you do not ' +
        'complete a random sample of it — so the band is deliberately wide.',
    },
    confidence: 'low',
    note:
      'Field research baseline is ~1/64 shiny, but event research runs far hotter and ' +
      'ordinary tasks colder.',
    citation: `~1/64 for Field Research tasks; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS} Encounter share counted from Leek Duck's current Field Research list (https://leekduck.com/research/): 87 tasks, 61 rewarding an encounter, though 12 of those can reward items instead. Not a stable figure — the pool rotates monthly.`,
  },

  // ================================================================= Raids ==
  {
    id: 'raid-champion',
    label: 'Raids won (non-Legendary)',
    category: 'Raids',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(128, 64, 32),
    subsetOf: 'collector',
    medal: MEDALS.champion,
    confidence: 'high',
    note:
      'Treated as tier 1–4 raids. Legendary raids are counted separately by Battle ' +
      'Legend and are NOT subtracted from this — the two medals are independent ' +
      'counters. The medal counts raids WON, not bosses caught, so if you have fled ' +
      'bosses your true catch count is a little lower.',
    citation: `1/64 for non-5-star raids; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'raid-legend',
    label: 'Legendary raids won',
    category: 'Raids',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(25, 20, 15),
    // NOT a subset of Champion — see INDEPENDENT COUNTERS in the header comment.
    subsetOf: 'collector',
    medal: MEDALS.battleLegend,
    confidence: 'high',
    note:
      'Legendary, Mythical and Ultra Beast 5-star raids — the richest shiny source ' +
      'per encounter in the game. Counted independently of Champion, not carved out ' +
      'of it, so enter both medals exactly as the game shows them.',
    citation: `1/20 for 5-star raids; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS} Independence of Champion and Battle Legend: Niantic Support confirmed Legendary raids were not counting toward Champion (https://x.com/NianticHelp/status/896014879294881794), and real accounts show Battle Legend exceeding Champion, which is impossible if Champion contained it.`,
  },
  {
    id: 'shadow-raid',
    label: 'Shadow raids',
    category: 'Raids',
    kind: 'shadow',
    ivFloor: 6,
    shinyRate: band(64, 20, 10),
    subsetOf: 'raid-champion',
    medal: null,
    medalNote: 'No medal tracks shadow raids. They do count toward Champion.',
    derivedFrom: {
      parentId: 'raid-champion',
      fraction: pct(0, 1, 4),
      rationale:
        'Share of your raids that were shadow raids. Most accounts have done very few, ' +
        'so the default is deliberately near zero.',
    },
    confidence: 'low',
    note:
      'Shadow raid bosses cannot be traded, but can be purified (+2 IV). The shiny ' +
      'rate here is the least-settled number in the app — treat the band, not the point.',
    citation: `Floor 6/6/6 confirmed (${DITTOBASE_FLOORS}); shiny rate extrapolated from the 5-star raid rate of 1/20 (${BULBAPEDIA_SHINY}) and is NOT independently verified. Fraction: ${NOT_SOURCED}`,
  },

  // ======================================================== Team GO Rocket ==
  {
    id: 'rocket-hero',
    label: 'Team GO Rocket members defeated',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 0,
    shinyRate: band(512, 256, 128),
    subsetOf: 'collector',
    medal: MEDALS.hero,
    confidence: 'medium',
    note:
      'Counts every Team GO Rocket member you have beaten. Leaders and Giovanni are ' +
      'subtracted; the remainder is treated as ordinary grunts. The medal counts ' +
      'battles WON, not shadows caught.',
    citation: `1/256 for Team GO Rocket Grunts (${BULBAPEDIA_SHINY}); floor 0/0/0 for standard grunt catches (${DITTOBASE_FLOORS}).`,
  },
  {
    id: 'giovanni',
    label: 'Giovanni defeated',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 6,
    shinyRate: band(128, 64, 20),
    // NOT a subset of Hero — Giovanni feeds Ultra Hero, the same independent-counter
    // pattern as Champion/Battle Legend. At these counts it barely moves the answer.
    subsetOf: 'collector',
    medal: MEDALS.ultraHero,
    confidence: 'medium',
    note:
      'Giovanni uses the raised 6/6/6 shadow floor, same as shadow raids. Counted ' +
      'independently of the Hero medal, so enter both exactly as the game shows them.',
    citation: `1/64 for Giovanni (${BULBAPEDIA_SHINY}); floor 6/6/6 (${DITTOBASE_FLOORS}).`,
  },
  {
    id: 'leader-shadow',
    label: 'Rocket Leaders (Arlo / Cliff / Sierra)',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 0,
    shinyRate: band(128, 64, 32),
    subsetOf: 'rocket-hero',
    medal: null,
    medalNote: 'No medal counts Leader defeats separately.',
    derivedFrom: {
      parentId: 'rocket-hero',
      fraction: pct(5, 12, 20),
      rationale:
        'Share of your Rocket battles that were Leaders. Roughly one Leader per six ' +
        'grunts if you use every Rocket Radar you build.',
    },
    confidence: 'medium',
    note: 'Leaders share the grunt IV floor of 0 but have a much higher shiny rate.',
    citation: `1/64 for Team GO Rocket Leaders (${BULBAPEDIA_SHINY}); floor 0/0/0 (${DITTOBASE_FLOORS}). Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'grunt-shadow-weather',
    label: 'Weather-boosted grunt shadows',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 4,
    shinyRate: band(512, 256, 128),
    subsetOf: 'rocket-hero',
    medal: null,
    medalNote: 'No medal tracks weather-boosted shadows.',
    derivedFrom: {
      parentId: 'rocket-hero',
      fraction: pct(15, 25, 40),
      rationale: 'Same idea as weather-boosted wild catches, applied to Rocket battles.',
    },
    confidence: 'medium',
    note: 'Weather boost raises the shadow IV floor from 0 to 4.',
    citation: `Weather-boosted shadow floor 4/4/4. ${DITTOBASE_FLOORS} Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'purifier',
    label: 'Shadow Pokémon purified',
    category: 'Team GO Rocket',
    kind: 'reference',
    ivFloor: 0,
    medal: MEDALS.purifier,
    confidence: 'high',
    note:
      'Not an encounter source — this sets what share of your shadows get the ' +
      'purification IV bonus (+2 per stat, capped at 15). A shadow needs 13/13/13 to ' +
      'purify into a hundo, which is 27× better odds than catching one outright. ' +
      'The app blends the two paths by Purifier ÷ shadows caught.',
    citation: 'Purification adds +2 to each IV, capped at 15. Medal thresholds from Bulbapedia, "Medal (GO)".',
  },

  // ================================================================== Eggs ==
  {
    id: 'eggs',
    label: 'Eggs hatched',
    category: 'Eggs',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(128, 64, 32),
    medal: MEDALS.breeder,
    confidence: 'medium',
    note:
      'Hatching is not catching, so eggs are NOT inside your Collector total and are ' +
      'not subtracted from it. Floor 10 regardless of egg distance.',
    citation: `~1/64 from eggs; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS}`,
  },

  // ================================================================ Trades ==
  // Trades re-roll IVs on a Pokémon that was already counted (and already
  // shiny) at its original source, so they carry no shiny rate of their own.
  {
    id: 'gentleman',
    label: 'Pokémon traded — all time',
    category: 'Trades',
    kind: 'reference',
    ivFloor: 0,
    medal: MEDALS.gentleman,
    confidence: 'high',
    note:
      'Counts ALL trades, not shiny ones — so it cannot be used directly. It is the ' +
      'denominator the shiny-trade estimate below is built on.',
    citation: 'Gentleman medal, "Trade ___ Pokémon". Bulbapedia, "Medal (GO)".',
  },
  {
    id: 'trades-shiny',
    label: '…of which were shiny',
    category: 'Trades',
    kind: 'reference',
    ivFloor: 0,
    subsetOf: 'gentleman',
    medal: null,
    medalNote: 'No medal tracks shiny trades.',
    derivedFrom: {
      parentId: 'gentleman',
      fraction: pct(4, 12, 25),
      rationale:
        'Share of your trades that involved a shiny. This is the single most ' +
        'load-bearing guess in the app: shiny trades usually dominate expected ' +
        'shundos, and nothing in the game counts them. Worth replacing with a real ' +
        'number if you can.',
    },
    confidence: 'low',
    note:
      'A staging value only — it is split across friendship levels below. Contributes ' +
      'nothing on its own.',
    citation: NOT_SOURCED,
  },
  {
    id: 'trade-lucky',
    label: 'Lucky trades',
    category: 'Trades',
    kind: 'trade',
    ivFloor: 12,
    subsetOf: 'trades-shiny',
    medal: null,
    medalNote: 'No medal tracks lucky trades.',
    derivedFrom: {
      parentId: 'trades-shiny',
      fraction: pct(5, 15, 35),
      rationale:
        'Share of your shiny trades that were lucky. Floor 12 makes each one a 1-in-64 ' +
        'shundo, so this fraction moves the shundo number more than anything else here.',
    },
    confidence: 'high',
    note:
      'Lucky overrides friendship level: floor 12 regardless. Pound for pound the best ' +
      'shundo source in the game.',
    citation: `Lucky trade floor 12/12/12, overrides friendship. ${DITTOBASE_FLOORS} Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'trade-good',
    label: 'Good Friend trades',
    category: 'Trades',
    kind: 'trade',
    ivFloor: 1,
    subsetOf: 'trades-shiny',
    medal: null,
    medalNote: 'No medal tracks shiny trades by friendship level.',
    derivedFrom: {
      parentId: 'trades-shiny',
      fraction: pct(0, 2, 8),
      rationale: 'Few people trade shinies below Best Friend, so this defaults near zero.',
    },
    confidence: 'high',
    note: 'Floor 1 — barely better than a wild catch.',
    citation: `Good Friend trade floor 1/1/1. ${DITTOBASE_FLOORS} Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'trade-great',
    label: 'Great Friend trades',
    category: 'Trades',
    kind: 'trade',
    ivFloor: 2,
    subsetOf: 'trades-shiny',
    medal: null,
    medalNote: 'No medal tracks shiny trades by friendship level.',
    derivedFrom: {
      parentId: 'trades-shiny',
      fraction: pct(0, 3, 10),
      rationale: 'Few people trade shinies below Best Friend, so this defaults near zero.',
    },
    confidence: 'high',
    note: 'Floor 2.',
    citation: `Great Friend trade floor 2/2/2. ${DITTOBASE_FLOORS} Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'trade-ultra',
    label: 'Ultra Friend trades',
    category: 'Trades',
    kind: 'trade',
    ivFloor: 3,
    subsetOf: 'trades-shiny',
    medal: null,
    medalNote: 'No medal tracks shiny trades by friendship level.',
    derivedFrom: {
      parentId: 'trades-shiny',
      fraction: pct(0, 5, 15),
      rationale: 'Few people trade shinies below Best Friend, so this defaults low.',
    },
    confidence: 'high',
    note: 'Floor 3.',
    citation: `Ultra Friend trade floor 3/3/3. ${DITTOBASE_FLOORS} Fraction: ${NOT_SOURCED}`,
  },
  {
    id: 'trade-best',
    label: 'Best Friend trades',
    category: 'Trades',
    kind: 'trade',
    ivFloor: 5,
    subsetOf: 'trades-shiny',
    medal: null,
    medalNote:
      'No medal tracks shiny trades. This is the REMAINDER: every shiny trade not ' +
      'assigned to another friendship level above.',
    confidence: 'high',
    note:
      'Floor 5. The remainder of your shiny trades — most people do the overwhelming ' +
      'majority of their shiny trading at Best Friend.',
    citation: `Best Friend trade floor 5/5/5. ${DITTOBASE_FLOORS}`,
  },
];

export const SOURCES_BY_ID: Record<string, SourceDef> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
);

/** Sources the user types in directly, because a medal tracks them. */
export const MEDAL_SOURCES = SOURCES.filter((s) => s.medal !== null);

/** Sources whose count is assumed rather than read off a medal. */
export const DERIVED_SOURCES = SOURCES.filter(
  (s) => s.derivedFrom !== undefined || s.derivedFromEvents !== undefined,
);

/** Of those, the ones expressed as a share of a parent count. */
export const FRACTION_SOURCES = SOURCES.filter((s) => s.derivedFrom !== undefined);

/** Direct children of a source (sources whose counts are carved out of it). */
export function childrenOf(parentId: string): SourceDef[] {
  return SOURCES.filter((s) => s.subsetOf === parentId);
}

/** How deeply nested a source is, for indentation and resolution order. */
export function depthOf(id: string): number {
  let depth = 0;
  let cur = SOURCES_BY_ID[id];
  while (cur?.subsetOf) {
    depth++;
    cur = SOURCES_BY_ID[cur.subsetOf];
    if (depth > 8) break; // cycle guard
  }
  return depth;
}
