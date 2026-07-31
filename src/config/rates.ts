/**
 * ALL RATE ESTIMATES AND MEDAL MAPPINGS LIVE HERE. No probability logic.
 *
 * Two very different kinds of data are in this file, and they deserve very
 * different levels of trust:
 *
 *  - SHINY RATES are community estimates. Niantic has never published them.
 *    They come mostly from The Silph Road's crowd-sourced tallies as aggregated
 *    by Bulbapedia, several are contested, and they drift between events. Every
 *    one carries a low/mid/high band, a confidence level, and is editable at
 *    runtime in the UI.
 *
 *  - IV FLOORS and MEDAL THRESHOLDS are exact. IV floors are datamined game
 *    mechanics; medal names, descriptions and thresholds are in-game text.
 *
 * Rates are stored as PROBABILITIES, not denominators: `low` is the
 * pessimistic (rarest) end and `high` the optimistic (most common) end.
 *
 * ---------------------------------------------------------------------------
 * MEDAL NESTING — read this before changing `subsetOf`
 * ---------------------------------------------------------------------------
 * Every count in this app is meant to be read straight off the in-game Medals
 * screen. But medals overlap: the Collector medal counts EVERY Pokémon you have
 * caught, which includes the ones you caught from raids, from research and from
 * Team GO Rocket. Entering those separately and letting them add would double
 * count them badly.
 *
 * So sources form a tree, and every child's count is subtracted from its
 * parent. The assumed containments, and how confident each one is:
 *
 *   Collector "Catch ___ Pokémon"          [root — the medal text is unqualified,
 *   ├── weather-boosted wild                so every catch counts. CONFIDENT.]
 *   ├── Community Day
 *   ├── other event-boosted
 *   ├── Champion "Win ___ raids"           [CONFIDENT: raid bosses are caught]
 *   │   ├── Battle Legend "Win ___ Legendary raids"  [CONFIDENT: legendary
 *   │   └── Shadow raids                    raids are raids]
 *   ├── Pokémon Ranger "Complete ___ Field Research tasks"  [see note below]
 *   └── Hero "Defeat ___ Team GO Rocket members"   [CONFIDENT for leaders —
 *       ├── Rocket leaders                   they are Rocket members. Giovanni
 *       ├── Ultra Hero "Defeat Giovanni ___ time(s)"   is LESS certain, but the
 *       └── weather-boosted grunts           count is tiny either way.]
 *
 *   Breeder "Hatch ___ Eggs"               [root — hatching is not catching,
 *                                           so eggs are NOT inside Collector]
 *
 * If any of these containments is wrong for your account, the app will tell
 * you: entering subsets that sum to more than their parent is a hard validation
 * error in the UI. That check is the practical safety net for these assumptions.
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

const BULBAPEDIA_SHINY =
  'Bulbapedia, "Shiny Pokémon (GO)" — aggregates The Silph Road community tallies. https://bulbapedia.bulbagarden.net/wiki/Shiny_Pok%C3%A9mon_(GO)';
const DITTOBASE_FLOORS =
  'Dittobase, "Pokémon GO IV Floors by Encounter Type". https://www.dittobase.com/pokemon-go/iv-floors';

export const CATEGORIES = [
  'Catches (Collector medal)',
  'Raids (Champion medal)',
  'Team GO Rocket (Hero medal)',
  'Eggs (Breeder medal)',
  'Trades (shiny re-rolls)',
] as const;

export const SOURCES: SourceDef[] = [
  // ============================================================== Collector ==
  {
    id: 'collector',
    label: 'Pokémon caught — all time',
    category: 'Catches (Collector medal)',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(700, 512, 400),
    medal: MEDALS.collector,
    confidence: 'high',
    note:
      'Read this straight off your Collector medal. It counts every Pokémon you have ' +
      'ever caught — including raid, research and Team GO Rocket catches, which is why ' +
      'those are subtracted from it below. What is left over is treated as ordinary ' +
      'unboosted wild catches.',
    citation: `Shiny rate 1/512 base. ${BULBAPEDIA_SHINY} Older Silph Road estimates put it nearer 1/450–1/500, hence the band. Floor 0/0/0 for wild catches: ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'wild-weather',
    label: '…of which weather-boosted',
    category: 'Catches (Collector medal)',
    kind: 'catch',
    ivFloor: 4,
    shinyRate: band(700, 512, 400),
    subsetOf: 'collector',
    medal: null,
    medalNote:
      'No medal tracks weather-boosted catches. Estimate it — a third to a half of ' +
      'wild catches is typical if you play in varied weather.',
    confidence: 'high',
    note:
      'Weather boost raises the IV floor from 0 to 4. It does NOT change the shiny rate.',
    citation: `Floor 4/4/4: ${DITTOBASE_FLOORS} Shiny rate identical to unboosted wild: ${BULBAPEDIA_SHINY}`,
  },
  {
    id: 'community-day',
    label: '…of which Community Day featured species',
    category: 'Catches (Collector medal)',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(30, 25, 20),
    subsetOf: 'collector',
    medal: null,
    medalNote:
      'No medal tracks Community Day catches. Estimate it: roughly (number of ' +
      'Community Days you played) × (featured species caught per event).',
    confidence: 'high',
    note: 'Featured species only, during the event window.',
    citation: `~1/25 for the featured Pokémon during Community Days. ${BULBAPEDIA_SHINY}`,
  },
  {
    id: 'event-wild',
    label: '…of which other event-boosted',
    category: 'Catches (Collector medal)',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(256, 128, 64),
    subsetOf: 'collector',
    medal: null,
    medalNote: 'No medal tracks event catches. Estimate it.',
    confidence: 'low',
    note:
      'GO Fest, Safari Zones, Raid/Research/Hatch Days, ticketed events. The rate ' +
      'varies enormously by event (1/256 to 1/10), so this is the shakiest number ' +
      'in the model — override it if you know your own event mix.',
    citation: `Event tiers of 1/256, 1/128, 1/64, 1/25 and 1/10 are all documented. ${BULBAPEDIA_SHINY}`,
  },
  {
    id: 'research',
    label: '…of which research encounters',
    category: 'Catches (Collector medal)',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(512, 64, 32),
    subsetOf: 'collector',
    medal: MEDALS.ranger,
    confidence: 'low',
    note:
      'The Pokémon Ranger medal counts Field Research tasks COMPLETED, not encounters ' +
      'caught — many tasks reward items rather than a Pokémon, and Special/Timed ' +
      'Research is not counted at all. Treat the medal as an upper bound on field ' +
      'research encounters and add your Special/Timed encounters by hand.',
    citation: `~1/64 for Field Research tasks; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS}`,
  },

  // ================================================================= Raids ==
  {
    id: 'raid-champion',
    label: 'Raids won — all tiers',
    category: 'Raids (Champion medal)',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(128, 64, 32),
    subsetOf: 'collector',
    medal: MEDALS.champion,
    confidence: 'high',
    note:
      'Read this off your Champion medal, which counts raids of every tier. Legendary ' +
      'and shadow raids are subtracted below; what is left is treated as tier 1–4. ' +
      'The medal counts raids WON, not bosses caught — if you have fled bosses, your ' +
      'true catch count is a little lower.',
    citation: `1/64 for non-5-star raids; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'raid-legend',
    label: '…of which Legendary (tier 5)',
    category: 'Raids (Champion medal)',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(25, 20, 15),
    subsetOf: 'raid-champion',
    medal: MEDALS.battleLegend,
    confidence: 'high',
    note:
      'Read this off your Battle Legend medal. Legendary, Mythical and Ultra Beast ' +
      '5-star raids — the single richest shiny source per encounter in the game.',
    citation: `1/20 for 5-star raids; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'shadow-raid',
    label: '…of which Shadow raids',
    category: 'Raids (Champion medal)',
    kind: 'shadow',
    ivFloor: 6,
    shinyRate: band(64, 20, 10),
    subsetOf: 'raid-champion',
    medal: null,
    medalNote:
      'No medal tracks shadow raids specifically. They do count toward Champion, so ' +
      'enter them here to carve them out of your tier 1–4 remainder.',
    confidence: 'low',
    note:
      'Shadow raid bosses cannot be traded, but can be purified (+2 IV). The shiny ' +
      'rate here is the least-settled number in the app — treat the band, not the point.',
    citation: `Floor 6/6/6 confirmed (${DITTOBASE_FLOORS}); shiny rate extrapolated from the 5-star raid rate of 1/20 (${BULBAPEDIA_SHINY}) and is NOT independently verified.`,
  },

  // ======================================================== Team GO Rocket ==
  {
    id: 'rocket-hero',
    label: 'Team GO Rocket members defeated',
    category: 'Team GO Rocket (Hero medal)',
    kind: 'shadow',
    ivFloor: 0,
    shinyRate: band(512, 256, 128),
    subsetOf: 'collector',
    medal: MEDALS.hero,
    confidence: 'medium',
    note:
      'Read this off your Hero medal, which counts every Team GO Rocket member you ' +
      'have beaten. Leaders and Giovanni are subtracted below; the remainder is ' +
      'treated as ordinary grunts. Note the medal counts battles WON, not shadows ' +
      'caught — and not every grunt shadow is shiny-eligible.',
    citation: `1/256 for Team GO Rocket Grunts (${BULBAPEDIA_SHINY}); floor 0/0/0 for standard grunt catches (${DITTOBASE_FLOORS}).`,
  },
  {
    id: 'grunt-shadow-weather',
    label: '…of which weather-boosted grunts',
    category: 'Team GO Rocket (Hero medal)',
    kind: 'shadow',
    ivFloor: 4,
    shinyRate: band(512, 256, 128),
    subsetOf: 'rocket-hero',
    medal: null,
    medalNote: 'No medal tracks weather-boosted shadows. Estimate it.',
    confidence: 'medium',
    note: 'Weather boost raises the shadow IV floor from 0 to 4.',
    citation: `Weather-boosted shadow floor 4/4/4. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'leader-shadow',
    label: '…of which Leaders (Arlo / Cliff / Sierra)',
    category: 'Team GO Rocket (Hero medal)',
    kind: 'shadow',
    ivFloor: 0,
    shinyRate: band(128, 64, 32),
    subsetOf: 'rocket-hero',
    medal: null,
    medalNote:
      'No medal counts Leader defeats separately. Estimate it — roughly the number of ' +
      'Rocket Radars you have used.',
    confidence: 'medium',
    note: 'Leaders share the grunt IV floor of 0 but have a much higher shiny rate.',
    citation: `1/64 for Team GO Rocket Leaders (${BULBAPEDIA_SHINY}); floor 0/0/0 for standard grunt/leader catches (${DITTOBASE_FLOORS}).`,
  },
  {
    id: 'giovanni',
    label: '…of which Giovanni',
    category: 'Team GO Rocket (Hero medal)',
    kind: 'shadow',
    ivFloor: 6,
    shinyRate: band(128, 64, 20),
    subsetOf: 'rocket-hero',
    medal: MEDALS.ultraHero,
    confidence: 'medium',
    note:
      'Read this off your Ultra Hero medal. Giovanni uses the raised 6/6/6 shadow ' +
      'floor, same as shadow raids. Whether Giovanni also counts toward the Hero ' +
      'medal is not firmly established — but at these counts it barely moves the answer.',
    citation: `1/64 for Giovanni (${BULBAPEDIA_SHINY}); floor 6/6/6 (${DITTOBASE_FLOORS}).`,
  },

  // ================================================================== Eggs ==
  {
    id: 'eggs',
    label: 'Eggs hatched',
    category: 'Eggs (Breeder medal)',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(128, 64, 32),
    medal: MEDALS.breeder,
    confidence: 'medium',
    note:
      'Read this off your Breeder medal. Hatching is not catching, so eggs are NOT ' +
      'inside your Collector total and are not subtracted from it. Floor 10 regardless ' +
      'of egg distance.',
    citation: `~1/64 from eggs; floor 10/10/10. ${BULBAPEDIA_SHINY} / ${DITTOBASE_FLOORS}`,
  },

  // ================================================================ Trades ==
  // Trades carry no shiny rate: they re-roll IVs on a Pokémon that was already
  // counted (and already shiny) at its original source.
  {
    id: 'trade-good',
    label: 'Good Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 1,
    medal: null,
    medalNote:
      'The Gentleman medal counts ALL trades, not shiny ones, so it cannot be used ' +
      'here. Count your shiny trades by hand.',
    confidence: 'high',
    note: 'Number of SHINY Pokémon you traded at this friendship level.',
    citation: `Good Friend trade floor 1/1/1. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-great',
    label: 'Great Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 2,
    medal: null,
    medalNote: 'No medal tracks shiny trades. Count them by hand.',
    confidence: 'high',
    note: 'Number of SHINY Pokémon you traded at this friendship level.',
    citation: `Great Friend trade floor 2/2/2. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-ultra',
    label: 'Ultra Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 3,
    medal: null,
    medalNote: 'No medal tracks shiny trades. Count them by hand.',
    confidence: 'high',
    note: 'Number of SHINY Pokémon you traded at this friendship level.',
    citation: `Ultra Friend trade floor 3/3/3. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-best',
    label: 'Best Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 5,
    medal: null,
    medalNote: 'No medal tracks shiny trades. Count them by hand.',
    confidence: 'high',
    note: 'Number of SHINY Pokémon you traded at this friendship level.',
    citation: `Best Friend trade floor 5/5/5. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-lucky',
    label: 'Lucky trade — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 12,
    medal: null,
    medalNote:
      'No medal tracks lucky trades. Your Lucky Friends count is not the same thing — ' +
      'count the shiny Pokémon that actually came out of a lucky trade.',
    confidence: 'high',
    note:
      'Lucky overrides friendship level: floor 12 regardless. A 1-in-64 shundo per ' +
      'shiny traded — pound for pound the best shundo source in the game.',
    citation: `Lucky trade floor 12/12/12, overrides friendship. ${DITTOBASE_FLOORS}`,
  },
];

export const SOURCES_BY_ID: Record<string, SourceDef> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
);

/** Direct children of a source (sources whose counts are carved out of it). */
export function childrenOf(parentId: string): SourceDef[] {
  return SOURCES.filter((s) => s.subsetOf === parentId);
}

/** How deeply nested a source is, for indentation in the UI. */
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
