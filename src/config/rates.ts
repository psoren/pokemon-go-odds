/**
 * ALL RATE ESTIMATES LIVE HERE. No probability logic — just data.
 *
 * Niantic has never published shiny rates. Every number below is a community
 * estimate, mostly from The Silph Road's crowd-sourced tallies as aggregated
 * by Bulbapedia, and several of them are contested or drift between events.
 * That is why each entry carries a low/mid/high band and a confidence level,
 * and why every one of them is editable at runtime in the UI.
 *
 * Rates are stored as PROBABILITIES, not denominators: `low` is the
 * pessimistic (rarest) end and `high` the optimistic (most common) end.
 *
 * IV floors, by contrast, are exact game mechanics rather than estimates —
 * they are known from datamining and are consistent across sources.
 */

import type { SourceDef } from '../model/types';

/** Convenience: 1-in-n as a probability. */
export const oneIn = (n: number): number => 1 / n;

/** Build a rate band from denominators (rarest, mid, most common). */
const band = (rarest: number, mid: number, common: number) => ({
  low: oneIn(rarest),
  mid: oneIn(mid),
  high: oneIn(common),
});

const BULBAPEDIA =
  'Bulbapedia, "Shiny Pokémon (GO)" — aggregates The Silph Road community tallies. https://bulbapedia.bulbagarden.net/wiki/Shiny_Pok%C3%A9mon_(GO)';
const DITTOBASE_FLOORS =
  'Dittobase, "Pokémon GO IV Floors by Encounter Type". https://www.dittobase.com/pokemon-go/iv-floors';

export const CATEGORIES = [
  'Wild',
  'Eggs & Research',
  'Raids',
  'Team GO Rocket',
  'Trades (shiny re-rolls)',
] as const;

export const SOURCES: SourceDef[] = [
  // ---------------------------------------------------------------- Wild ---
  {
    id: 'wild',
    label: 'Wild catches (lifetime total)',
    category: 'Wild',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(700, 512, 400),
    confidence: 'high',
    note:
      'Enter your ALL-TIME total wild catches. Weather-boosted, Community Day and ' +
      'event catches below are subtracted from this number so nothing is double counted.',
    citation: `1/512 base rate. ${BULBAPEDIA} Older Silph Road estimates put it nearer 1/450–1/500, hence the band.`,
  },
  {
    id: 'wild-weather',
    label: '…of which weather-boosted',
    category: 'Wild',
    kind: 'catch',
    ivFloor: 4,
    shinyRate: band(700, 512, 400),
    subsetOf: 'wild',
    confidence: 'high',
    note:
      'Weather boost raises the IV floor to 4 but does NOT change the shiny rate. ' +
      'Subtracted from the wild total above.',
    citation: `Floor 4/4/4: ${DITTOBASE_FLOORS} Shiny rate identical to unboosted wild: ${BULBAPEDIA}`,
  },
  {
    id: 'community-day',
    label: '…of which Community Day featured species',
    category: 'Wild',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(30, 25, 20),
    subsetOf: 'wild',
    confidence: 'high',
    note: 'Featured species only, during the event window. Subtracted from the wild total.',
    citation: `~1/25 for the featured Pokémon during Community Days. ${BULBAPEDIA}`,
  },
  {
    id: 'event-wild',
    label: '…of which other event-boosted',
    category: 'Wild',
    kind: 'catch',
    ivFloor: 0,
    shinyRate: band(256, 128, 64),
    subsetOf: 'wild',
    confidence: 'low',
    note:
      'GO Fest, Safari Zones, Raid/Research/Hatch Days, ticketed events. The rate ' +
      'varies enormously by event (1/256 to 1/10), so this is the shakiest number ' +
      'in the model — override it if you know your own event mix.',
    citation: `Event tiers of 1/256, 1/128, 1/64, 1/25 and 1/10 are all documented. ${BULBAPEDIA}`,
  },

  // ----------------------------------------------------- Eggs & Research ---
  {
    id: 'eggs',
    label: 'Egg hatches',
    category: 'Eggs & Research',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(128, 64, 32),
    confidence: 'medium',
    note: 'Shiny-eligible species only. Floor 10 regardless of egg distance.',
    citation: `~1/64 from eggs; floor 10/10/10. ${BULBAPEDIA} / ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'research',
    label: 'Research encounters (field / special / timed)',
    category: 'Eggs & Research',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(512, 64, 32),
    confidence: 'low',
    note:
      'Field research baseline is ~1/64, but event research and breakthroughs run ' +
      'far hotter and non-event tasks far colder. Wide band on purpose.',
    citation: `~1/64 for Field Research tasks; floor 10/10/10. ${BULBAPEDIA} / ${DITTOBASE_FLOORS}`,
  },

  // --------------------------------------------------------------- Raids ---
  {
    id: 'raid-t14',
    label: 'Tier 1–4 raids',
    category: 'Raids',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(128, 64, 32),
    confidence: 'high',
    note: 'Non-5-star raid bosses, including mega raids.',
    citation: `1/64 for non-5-star raids; floor 10/10/10. ${BULBAPEDIA} / ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'raid-t5',
    label: 'Tier 5 legendary raids',
    category: 'Raids',
    kind: 'catch',
    ivFloor: 10,
    shinyRate: band(25, 20, 15),
    confidence: 'high',
    note: 'Legendary, Mythical and Ultra Beast 5-star raids. The single richest shiny source per encounter.',
    citation: `1/20 for 5-star raids; floor 10/10/10. ${BULBAPEDIA} / ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'shadow-raid',
    label: 'Shadow raids',
    category: 'Raids',
    kind: 'shadow',
    ivFloor: 6,
    shinyRate: band(64, 20, 10),
    confidence: 'low',
    note:
      'Shadow raid bosses cannot be traded, but can be purified (+2 IV). The shiny ' +
      'rate here is the least-settled number in the app — treat the band, not the point.',
    citation: `Floor 6/6/6 confirmed (${DITTOBASE_FLOORS}); shiny rate extrapolated from the 5-star raid rate of 1/20 (${BULBAPEDIA}) and is NOT independently verified.`,
  },

  // ------------------------------------------------------ Team GO Rocket ---
  {
    id: 'grunt-shadow',
    label: 'Rocket grunt shadows',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 0,
    shinyRate: band(512, 256, 128),
    confidence: 'medium',
    note: 'Shiny-eligible grunt shadows only. Floor 0 makes these terrible hundo odds — but purification triples each stat window.',
    citation: `1/256 for Team GO Rocket Grunts (${BULBAPEDIA}); floor 0/0/0 (${DITTOBASE_FLOORS}).`,
  },
  {
    id: 'grunt-shadow-weather',
    label: '…of which weather-boosted',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 4,
    shinyRate: band(512, 256, 128),
    subsetOf: 'grunt-shadow',
    confidence: 'medium',
    note: 'Weather boost raises the shadow IV floor to 4. Subtracted from the grunt total above.',
    citation: `Weather-boosted shadow floor 4/4/4. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'leader-shadow',
    label: 'Rocket leader shadows (Arlo / Cliff / Sierra)',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 0,
    shinyRate: band(128, 64, 32),
    confidence: 'medium',
    note: 'Leaders share the grunt IV floor of 0 but have a much higher shiny rate.',
    citation: `1/64 for Team GO Rocket Leaders (${BULBAPEDIA}); floor 0/0/0 for standard grunt/leader catches (${DITTOBASE_FLOORS}).`,
  },
  {
    id: 'giovanni',
    label: 'Giovanni shadow legendaries',
    category: 'Team GO Rocket',
    kind: 'shadow',
    ivFloor: 6,
    shinyRate: band(128, 64, 20),
    confidence: 'medium',
    note: 'Giovanni uses the raised 6/6/6 shadow floor, same as shadow raids.',
    citation: `1/64 for Giovanni (${BULBAPEDIA}); floor 6/6/6 (${DITTOBASE_FLOORS}).`,
  },

  // -------------------------------------------------------------- Trades ---
  // Trades carry no shiny rate: they re-roll IVs on a Pokémon that was already
  // counted (and already shiny) at its original source.
  {
    id: 'trade-good',
    label: 'Good Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 1,
    confidence: 'high',
    note: 'Count of SHINY Pokémon you traded at this friendship level.',
    citation: `Good Friend trade floor 1/1/1. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-great',
    label: 'Great Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 2,
    confidence: 'high',
    note: 'Count of SHINY Pokémon you traded at this friendship level.',
    citation: `Great Friend trade floor 2/2/2. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-ultra',
    label: 'Ultra Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 3,
    confidence: 'high',
    note: 'Count of SHINY Pokémon you traded at this friendship level.',
    citation: `Ultra Friend trade floor 3/3/3. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-best',
    label: 'Best Friend — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 5,
    confidence: 'high',
    note: 'Count of SHINY Pokémon you traded at this friendship level.',
    citation: `Best Friend trade floor 5/5/5. ${DITTOBASE_FLOORS}`,
  },
  {
    id: 'trade-lucky',
    label: 'Lucky trade — shinies traded',
    category: 'Trades (shiny re-rolls)',
    kind: 'trade',
    ivFloor: 12,
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

/** ids of sources that are subsets of `parentId`. */
export function childrenOf(parentId: string): SourceDef[] {
  return SOURCES.filter((s) => s.subsetOf === parentId);
}
