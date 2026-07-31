/**
 * Every Community Day, so you can tick the ones you actually played instead of
 * guessing at "what percentage of my catches happened on a Community Day".
 *
 * This replaces the single worst assumption in the app. Community Day catches
 * are ~1-in-25 shiny — twenty times the base rate — so a 1%-to-6% guess about
 * their share swung the shiny prediction by more than 250. The NUMBER of
 * Community Days is a hard fact; only your attendance and catch rate are not.
 *
 * Sources:
 *   2018–2023: Bulbapedia, "Community Day" — https://bulbapedia.bulbagarden.net/wiki/Community_Day
 *   2024–2026: Nintendo Life, "All Previous Community Day Pokémon"
 *
 * The list runs to June 2026. Anything newer, plus the handful of Classic
 * events that are patchily documented, is covered by the "others not listed"
 * field in the picker rather than being silently missing.
 */

export interface CommunityDayEvent {
  /** Stable id, `YYYY-MM` plus `-classic` for the Classic variant. */
  id: string;
  year: number;
  month: number;
  /** Featured Pokémon, as shown in-game. */
  featured: string;
  classic?: boolean;
}

const cd = (
  year: number,
  month: number,
  featured: string,
  classic = false,
): CommunityDayEvent => ({
  id: `${year}-${String(month).padStart(2, '0')}${classic ? '-classic' : ''}`,
  year,
  month,
  featured,
  ...(classic ? { classic: true } : {}),
});

export const COMMUNITY_DAYS: CommunityDayEvent[] = [
  // 2018 — the first Community Day was Pikachu, January 2018.
  cd(2018, 1, 'Pikachu'),
  cd(2018, 2, 'Dratini'),
  cd(2018, 3, 'Bulbasaur'),
  cd(2018, 4, 'Mareep'),
  cd(2018, 5, 'Charmander'),
  cd(2018, 6, 'Larvitar'),
  cd(2018, 7, 'Squirtle'),
  cd(2018, 8, 'Eevee'),
  cd(2018, 9, 'Chikorita'),
  cd(2018, 10, 'Beldum'),
  cd(2018, 11, 'Cyndaquil'),
  cd(2018, 12, 'December Celebration'),

  // 2019
  cd(2019, 1, 'Totodile'),
  cd(2019, 2, 'Swinub'),
  cd(2019, 3, 'Treecko'),
  cd(2019, 4, 'Bagon'),
  cd(2019, 5, 'Torchic'),
  cd(2019, 6, 'Slakoth'),
  cd(2019, 7, 'Mudkip'),
  cd(2019, 8, 'Ralts'),
  cd(2019, 9, 'Turtwig'),
  cd(2019, 10, 'Trapinch'),
  cd(2019, 11, 'Chimchar'),
  cd(2019, 12, 'December Celebration'),

  // 2020 — no March event; the Abra day was postponed into April.
  cd(2020, 1, 'Piplup'),
  cd(2020, 2, 'Rhyhorn'),
  cd(2020, 4, 'Abra'),
  cd(2020, 5, 'Seedot'),
  cd(2020, 6, 'Weedle'),
  cd(2020, 7, 'Gastly'),
  cd(2020, 8, 'Magikarp'),
  cd(2020, 9, 'Porygon'),
  cd(2020, 10, 'Charmander'),
  cd(2020, 11, 'Electabuzz & Magmar'),
  cd(2020, 12, 'December Celebration'),

  // 2021
  cd(2021, 1, 'Machop'),
  cd(2021, 2, 'Roselia'),
  cd(2021, 3, 'Fletchling'),
  cd(2021, 4, 'Snivy'),
  cd(2021, 5, 'Swablu'),
  cd(2021, 6, 'Gible'),
  cd(2021, 7, 'Tepig'),
  cd(2021, 8, 'Eevee'),
  cd(2021, 9, 'Oshawott'),
  cd(2021, 10, 'Duskull'),
  cd(2021, 11, 'Shinx'),
  cd(2021, 12, 'December Celebration'),

  // 2022 — Community Day Classic events begin.
  cd(2022, 1, 'Spheal'),
  cd(2022, 1, 'Bulbasaur', true),
  cd(2022, 2, 'Hoppip'),
  cd(2022, 3, 'Sandshrew'),
  cd(2022, 4, 'Stufful'),
  cd(2022, 4, 'Mudkip', true),
  cd(2022, 5, 'Alolan Geodude'),
  cd(2022, 6, 'Deino'),
  cd(2022, 7, 'Starly'),
  cd(2022, 8, 'Galarian Zigzagoon'),
  cd(2022, 9, 'Roggenrola'),
  cd(2022, 10, 'Litwick'),
  cd(2022, 11, 'Teddiursa'),
  cd(2022, 11, 'Dratini', true),
  cd(2022, 12, 'December Celebration'),

  // 2023
  cd(2023, 1, 'Chespin'),
  cd(2023, 2, 'Noibat'),
  cd(2023, 3, 'Slowpoke'),
  cd(2023, 4, 'Togetic'),
  cd(2023, 5, 'Fennekin'),
  cd(2023, 6, 'Axew'),
  cd(2023, 7, 'Poliwag'),
  cd(2023, 8, 'Froakie'),
  cd(2023, 9, 'Grubbin'),
  cd(2023, 10, 'Timburr'),
  cd(2023, 11, 'Wooper'),
  cd(2023, 12, 'December Celebration'),

  // 2024
  cd(2024, 1, 'Rowlet'),
  cd(2024, 1, 'Porygon', true),
  cd(2024, 2, 'Chansey'),
  cd(2024, 3, 'Litten'),
  cd(2024, 4, 'Bellsprout'),
  cd(2024, 4, 'Bagon', true),
  cd(2024, 5, 'Bounsweet'),
  cd(2024, 6, 'Goomy'),
  cd(2024, 6, 'Cyndaquil', true),
  cd(2024, 7, 'Tynamo'),
  cd(2024, 8, 'Popplio'),
  cd(2024, 9, 'Ponyta & Galarian Ponyta'),
  cd(2024, 10, 'Sewaddle'),
  cd(2024, 11, 'Mankey'),
  cd(2024, 12, 'December Celebration'),

  // 2025
  cd(2025, 1, 'Sprigatito'),
  cd(2025, 1, 'Ralts', true),
  cd(2025, 2, 'Karrablast & Shelmet'),
  cd(2025, 3, 'Fuecoco'),
  cd(2025, 3, 'Totodile', true),
  cd(2025, 4, 'Vanillite'),
  cd(2025, 5, 'Pawmi'),
  cd(2025, 5, 'Machop', true),
  cd(2025, 6, 'Jangmo-o'),
  cd(2025, 7, 'Quaxly'),
  cd(2025, 7, 'Eevee', true),
  cd(2025, 8, 'Rookidee'),
  cd(2025, 9, 'Flabébé'),
  cd(2025, 10, 'Solosis'),
  cd(2025, 11, 'Pikipek'),
  cd(2025, 12, 'December Celebration'),

  // 2026 — list runs to June; later events go in "others not listed".
  cd(2026, 1, 'Grookey'),
  cd(2026, 1, 'Piplup', true),
  cd(2026, 2, 'Vulpix & Alolan Vulpix'),
  cd(2026, 3, 'Scorbunny'),
  cd(2026, 4, 'Tinkatink'),
  cd(2026, 5, 'Lechonk'),
  cd(2026, 5, 'Deino', true),
  cd(2026, 6, 'Frigibax'),
];

export const COMMUNITY_DAY_YEARS: number[] = [
  ...new Set(COMMUNITY_DAYS.map((e) => e.year)),
].sort((a, b) => b - a);

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function eventsInYear(year: number): CommunityDayEvent[] {
  return COMMUNITY_DAYS.filter((e) => e.year === year);
}
