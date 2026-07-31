/**
 * In-game medals, so every count in this app can be read straight off the
 * Trainer profile → Medals screen instead of guessed at.
 *
 * The medal screen shows your EXACT progress (e.g. "47,312 / 50,000"), so the
 * tier thresholds below are only there to help you locate yourself if you have
 * already maxed a medal out or only remember which tier you are on.
 *
 * Source for all names, in-game descriptions and thresholds:
 *   Bulbapedia, "Medal (GO)" — https://bulbapedia.bulbagarden.net/wiki/Medal_(GO)
 */

export interface Medal {
  /** In-game medal name. */
  name: string;
  /** The in-game description text, with ___ where the number goes. */
  description: string;
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export const MEDALS = {
  collector: {
    name: 'Collector',
    description: 'Catch ___ Pokémon',
    bronze: 30,
    silver: 500,
    gold: 2_000,
    platinum: 50_000,
  },
  breeder: {
    name: 'Breeder',
    description: 'Hatch ___ Eggs',
    bronze: 10,
    silver: 100,
    gold: 500,
    platinum: 2_500,
  },
  ranger: {
    name: 'Pokémon Ranger',
    description: 'Complete ___ Field Research tasks',
    bronze: 10,
    silver: 100,
    gold: 1_000,
    platinum: 2_500,
  },
  champion: {
    name: 'Champion',
    description: 'Win ___ raids',
    bronze: 10,
    silver: 100,
    gold: 1_000,
    platinum: 2_000,
  },
  battleLegend: {
    name: 'Battle Legend',
    description: 'Win ___ Legendary raids',
    bronze: 10,
    silver: 100,
    gold: 1_000,
    platinum: 2_000,
  },
  hero: {
    name: 'Hero',
    description: 'Defeat ___ Team GO Rocket members',
    bronze: 10,
    silver: 100,
    gold: 1_000,
    platinum: 2_000,
  },
  ultraHero: {
    name: 'Ultra Hero',
    description: 'Defeat Giovanni ___ time(s)',
    bronze: 1,
    silver: 5,
    gold: 20,
    platinum: 50,
  },
  purifier: {
    name: 'Purifier',
    description: 'Purify ___ Shadow Pokémon',
    bronze: 5,
    silver: 50,
    gold: 500,
    platinum: 1_000,
  },
  gentleman: {
    name: 'Gentleman',
    description: 'Trade ___ Pokémon',
    bronze: 10,
    silver: 100,
    gold: 1_000,
    platinum: 2_500,
  },
} as const satisfies Record<string, Medal>;

export type MedalKey = keyof typeof MEDALS;

export const TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_STYLE: Record<Tier, string> = {
  bronze: 'border-amber-300 bg-amber-100 text-amber-800',
  silver: 'border-slate-300 bg-slate-100 text-slate-600',
  gold: 'border-yellow-300 bg-yellow-100 text-yellow-800',
  platinum: 'border-cyan-300 bg-cyan-100 text-cyan-800',
};
