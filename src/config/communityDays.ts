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
  /**
   * National Pokédex number, for the sprite. Null for the multi-species December
   * events. Regional forms use their base species number — the sprite set is
   * keyed by species, so an Alolan Geodude shows a Geodude.
   */
  dex: number | null;
  classic?: boolean;
}

const cd = (
  year: number,
  month: number,
  featured: string,
  dex: number | null,
  classic = false,
): CommunityDayEvent => ({
  id: `${year}-${String(month).padStart(2, '0')}${classic ? '-classic' : ''}`,
  year,
  month,
  featured,
  dex,
  ...(classic ? { classic: true } : {}),
});

export const COMMUNITY_DAYS: CommunityDayEvent[] = [
  // 2018 — the first Community Day was Pikachu, January 2018.
  cd(2018, 1, 'Pikachu', 25),
  cd(2018, 2, 'Dratini', 147),
  cd(2018, 3, 'Bulbasaur', 1),
  cd(2018, 4, 'Mareep', 179),
  cd(2018, 5, 'Charmander', 4),
  cd(2018, 6, 'Larvitar', 246),
  cd(2018, 7, 'Squirtle', 7),
  cd(2018, 8, 'Eevee', 133),
  cd(2018, 9, 'Chikorita', 152),
  cd(2018, 10, 'Beldum', 374),
  cd(2018, 11, 'Cyndaquil', 155),
  cd(2018, 12, 'December Celebration', null),

  // 2019
  cd(2019, 1, 'Totodile', 158),
  cd(2019, 2, 'Swinub', 220),
  cd(2019, 3, 'Treecko', 252),
  cd(2019, 4, 'Bagon', 371),
  cd(2019, 5, 'Torchic', 255),
  cd(2019, 6, 'Slakoth', 287),
  cd(2019, 7, 'Mudkip', 258),
  cd(2019, 8, 'Ralts', 280),
  cd(2019, 9, 'Turtwig', 387),
  cd(2019, 10, 'Trapinch', 328),
  cd(2019, 11, 'Chimchar', 390),
  cd(2019, 12, 'December Celebration', null),

  // 2020 — no March event; the Abra day was postponed into April.
  cd(2020, 1, 'Piplup', 393),
  cd(2020, 2, 'Rhyhorn', 111),
  cd(2020, 4, 'Abra', 63),
  cd(2020, 5, 'Seedot', 273),
  cd(2020, 6, 'Weedle', 13),
  cd(2020, 7, 'Gastly', 92),
  cd(2020, 8, 'Magikarp', 129),
  cd(2020, 9, 'Porygon', 137),
  cd(2020, 10, 'Charmander', 4),
  cd(2020, 11, 'Electabuzz & Magmar', 125),
  cd(2020, 12, 'December Celebration', null),

  // 2021
  cd(2021, 1, 'Machop', 66),
  cd(2021, 2, 'Roselia', 315),
  cd(2021, 3, 'Fletchling', 661),
  cd(2021, 4, 'Snivy', 495),
  cd(2021, 5, 'Swablu', 333),
  cd(2021, 6, 'Gible', 443),
  cd(2021, 7, 'Tepig', 498),
  cd(2021, 8, 'Eevee', 133),
  cd(2021, 9, 'Oshawott', 501),
  cd(2021, 10, 'Duskull', 355),
  cd(2021, 11, 'Shinx', 403),
  cd(2021, 12, 'December Celebration', null),

  // 2022 — Community Day Classic events begin.
  cd(2022, 1, 'Spheal', 363),
  cd(2022, 1, 'Bulbasaur', 1, true),
  cd(2022, 2, 'Hoppip', 187),
  cd(2022, 3, 'Sandshrew', 27),
  cd(2022, 4, 'Stufful', 759),
  cd(2022, 4, 'Mudkip', 258, true),
  cd(2022, 5, 'Alolan Geodude', 74),
  cd(2022, 6, 'Deino', 633),
  cd(2022, 7, 'Starly', 396),
  cd(2022, 8, 'Galarian Zigzagoon', 263),
  cd(2022, 9, 'Roggenrola', 524),
  cd(2022, 10, 'Litwick', 607),
  cd(2022, 11, 'Teddiursa', 216),
  cd(2022, 11, 'Dratini', 147, true),
  cd(2022, 12, 'December Celebration', null),

  // 2023
  cd(2023, 1, 'Chespin', 650),
  cd(2023, 2, 'Noibat', 714),
  cd(2023, 3, 'Slowpoke', 79),
  cd(2023, 4, 'Togetic', 176),
  cd(2023, 5, 'Fennekin', 653),
  cd(2023, 6, 'Axew', 610),
  cd(2023, 7, 'Poliwag', 60),
  cd(2023, 8, 'Froakie', 656),
  cd(2023, 9, 'Grubbin', 736),
  cd(2023, 10, 'Timburr', 532),
  cd(2023, 11, 'Wooper', 194),
  cd(2023, 12, 'December Celebration', null),

  // 2024
  cd(2024, 1, 'Rowlet', 722),
  cd(2024, 1, 'Porygon', 137, true),
  cd(2024, 2, 'Chansey', 113),
  cd(2024, 3, 'Litten', 725),
  cd(2024, 4, 'Bellsprout', 69),
  cd(2024, 4, 'Bagon', 371, true),
  cd(2024, 5, 'Bounsweet', 761),
  cd(2024, 6, 'Goomy', 704),
  cd(2024, 6, 'Cyndaquil', 155, true),
  cd(2024, 7, 'Tynamo', 602),
  cd(2024, 8, 'Popplio', 728),
  cd(2024, 9, 'Ponyta & Galarian Ponyta', 77),
  cd(2024, 10, 'Sewaddle', 540),
  cd(2024, 11, 'Mankey', 56),
  cd(2024, 12, 'December Celebration', null),

  // 2025
  cd(2025, 1, 'Sprigatito', 906),
  cd(2025, 1, 'Ralts', 280, true),
  cd(2025, 2, 'Karrablast & Shelmet', 588),
  cd(2025, 3, 'Fuecoco', 909),
  cd(2025, 3, 'Totodile', 158, true),
  cd(2025, 4, 'Vanillite', 582),
  cd(2025, 5, 'Pawmi', 921),
  cd(2025, 5, 'Machop', 66, true),
  cd(2025, 6, 'Jangmo-o', 782),
  cd(2025, 7, 'Quaxly', 912),
  cd(2025, 7, 'Eevee', 133, true),
  cd(2025, 8, 'Rookidee', 821),
  cd(2025, 9, 'Flabébé', 669),
  cd(2025, 10, 'Solosis', 577),
  cd(2025, 11, 'Pikipek', 731),
  cd(2025, 12, 'December Celebration', null),

  // 2026 — list runs to June; later events go in "others not listed".
  cd(2026, 1, 'Grookey', 810),
  cd(2026, 1, 'Piplup', 393, true),
  cd(2026, 2, 'Vulpix & Alolan Vulpix', 37),
  cd(2026, 3, 'Scorbunny', 813),
  cd(2026, 4, 'Tinkatink', 957),
  cd(2026, 5, 'Lechonk', 915),
  cd(2026, 5, 'Deino', 633, true),
  cd(2026, 6, 'Frigibax', 996),
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
