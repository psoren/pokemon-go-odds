# Pokémon GO rarity calculator

**Type in your medals. See where you're at.**

Nine numbers off your in-game Medals screen, and the app returns the expected
number — and full probability distribution — of **shinies**, **hundos** and
**shundos** you should have.

Every encounter source is treated as an independent binomial trial with its own
shiny rate and IV floor. The app sums expected values across sources, reports
`P(k)` for `k = 0..6` both as a Poisson approximation and as an exact
Poisson-binomial convolution, and shows which sources actually drive your
rarities. (Spoiler: for most accounts it is lucky trades and legendary raids,
not tens of thousands of wild catches.)

No backend, no API calls, no telemetry. Inputs persist to `localStorage`.

## Run it

```sh
npm install
npm run dev
```

That's the whole setup. Other scripts:

```sh
npm test          # vitest
npm run build     # typecheck + production build
npm run preview   # serve the production build
```

## How to read the output

**Every headline number is a range by default, with the point estimate
secondary.** The shiny rates feeding this model are contested community
estimates, and the UI is deliberately built not to imply more precision than
the inputs support.

The hundo range is always narrower than the shiny range, and if you pin the
assumptions it collapses to a single number. That is not a bug: IV floors are
exact, datamined game mechanics, so no shiny rate can move a hundo count. All
that remains is uncertainty about *which* bucket your catches fell into — how
many were weather-boosted, how many of your trades were lucky.

The `P(k)` panel shows two columns per distribution:

- **Poisson** — the `e^(−λ) λᵏ / k!` approximation.
- **Exact** — the true Poisson-binomial, computed by convolving each source's
  binomial pmf.

They should agree closely; the app flags any `k` where they diverge by more
than one percentage point. Trust the exact column.

## The nine medals you enter

Open Pokémon GO → tap your trainer avatar → scroll to **Medals**. Each medal
shows your exact progress (“47,312 / 50,000”) — type that number. That is the
entire required input.

| Input | Medal | In-game text | Platinum |
|---|---|---|---|
| Pokémon caught — all time | **Collector** | “Catch ___ Pokémon” | 50,000 |
| Field Research tasks completed | **Pokémon Ranger** | “Complete ___ Field Research tasks” | 2,500 |
| Raids won (non-Legendary) | **Champion** | “Win ___ raids” | 2,000 |
| Legendary raids won | **Battle Legend** | “Win ___ Legendary raids” | 2,000 |
| Team GO Rocket members defeated | **Hero** | “Defeat ___ Team GO Rocket members” | 2,000 |
| Giovanni defeated | **Ultra Hero** | “Defeat Giovanni ___ time(s)” | 50 |
| Eggs hatched | **Breeder** | “Hatch ___ Eggs” | 2,500 |
| Pokémon traded — all time | **Gentleman** | “Trade ___ Pokémon” | 2,500 |
| Shadow Pokémon purified | **Purifier** | “Purify ___ Shadow Pokémon” | 1,000 |

Medal names, in-game descriptions and all four tier thresholds are from
[Bulbapedia's medal list](https://bulbapedia.bulbagarden.net/wiki/Medal_(GO))
and live in [`src/config/medals.ts`](src/config/medals.ts). Tapping a tier chip
in the UI fills in that threshold, for when you have already maxed a medal out.

Three of these are not encounter counts. **Gentleman** is the denominator the
shiny-trade estimate is built on, **Purifier** sets what share of your shadows
get the purification IV bonus, and **Pokémon Ranger** counts tasks *completed* —
a large share of which reward items rather than a Pokémon, so the encounter
count is derived from it rather than equal to it.

## Everything else is derived, and you can ignore it

Eleven of the model's counts have no medal at all — nothing in the game tracks
what share of your catches were weather-boosted, or how many of your trades
were shiny. Rather than making you guess at eleven extra fields, the app
derives each one as a **fraction of a medal you did enter**, and puts them all
behind a collapsed **Assumptions** panel:

| Derived | As a share of | Default |
|---|---|---|
| Weather-boosted catches | Collector | 30% |
| Community Day featured species | Collector | 3% |
| Other event-boosted catches | Collector | 8% |
| Research encounters | Pokémon Ranger | 60% |
| Shadow raids | Champion | 1% |
| Rocket Leaders | Hero | 12% |
| Weather-boosted grunt shadows | Hero | 25% |
| Shiny trades | Gentleman | 12% |
| Lucky / Good / Great / Ultra trades | shiny trades | 15% / 2% / 3% / 5% |
| Best Friend trades | shiny trades | the remainder |

**These defaults are rough guesses, not data.** No community dataset measures
them. They exist so that entering medals alone produces a usable answer, they
are all editable as percentages, and each carries a low/mid/high band that
feeds the headline range — so an assumption you are unsure about *widens* the
answer rather than quietly biasing it.

One of them matters far more than the rest: **shiny trades**. Lucky trades
usually dominate expected shundos, and nothing in the game counts them. If you
replace one number in that panel, replace that one.

### Medals overlap — so the app subtracts

This is the part most calculators get wrong. The Collector medal counts
**every** Pokémon you have caught, which already includes your raid, research
and Team GO Rocket catches. Entering those separately and letting them add
would double count them.

So the inputs form a tree, and every child is subtracted from its parent:

```
Collector  "Catch ___ Pokémon"                          [medal]
├── weather-boosted / Community Day / other events      [derived]
├── Champion  "Win ___ raids"                           [medal]
│   └── Shadow raids                                    [derived]
├── Battle Legend  "Win ___ Legendary raids"            [medal]
├── Ultra Hero  "Defeat Giovanni ___ time(s)"           [medal]
├── Pokémon Ranger  "Complete ___ Field Research tasks" [medal]
└── Hero  "Defeat ___ Team GO Rocket members"           [medal]
    └── Leaders / weather-boosted grunts                [derived]

Breeder  "Hatch ___ Eggs"          (hatching is not catching — its own root)
Gentleman  "Trade ___ Pokémon"     (re-rolls, not new Pokémon — its own root)
└── shiny trades → lucky / good / great / ultra, remainder to Best Friend
Purifier  "Purify ___ Shadow Pokémon"   (a parameter, not a source)
```

**Some medals that look nested are not.** Battle Legend is *not* inside
Champion, and Ultra Hero is *not* inside Hero — they are independent counters.
This app originally assumed otherwise, on the reading that "Win ___ raids" is
unqualified, and it was wrong: a real account with Champion 530 and Battle
Legend 664 is arithmetically impossible under that assumption. Niantic Support
[acknowledged Legendary raids not counting toward Champion](https://x.com/NianticHelp/status/896014879294881794)
back in 2017, and the identical 2,000 platinum thresholds only make sense for
separate counters. Enter both medals exactly as the game shows them.

What is left over after subtraction is the remainder: plain unboosted wild
catches, tier 1–4 raids, ordinary grunts. The λ table shows both numbers — e.g.
`107,700 (180,000)` means 180,000 entered, 107,700 left after carving out the
subsets.

**These containments are assumptions**, taken from the unqualified in-game
medal text. If one is wrong for your account the app will tell you: subsets
summing to more than their parent is a hard validation error. See
[MODEL.md](MODEL.md) for how confident each containment is.

## Reverse mode — how lucky have you been?

Enter what you actually have and the app tells you where that lands in the
predicted distribution: the percentile, plus `P(X ≤ observed)` and
`P(X ≥ observed)`.

This is **far** more sensitive to rate error than the forward model. A 20% error
in the wild shiny rate barely moves "expected shinies" as a headline, but it can
move a percentile from the 40th to the 90th. So it carries guardrails the
forward model does not:

1. **The percentile is always a range**, computed under the low and high rate
   estimates. If those differ by more than **20 percentile points**, the point
   estimate is suppressed entirely and the app says only "somewhere between Xth
   and Yth — rates too uncertain to say more". With the default bands this fires
   constantly, which is the honest outcome, not a defect.
2. **A calibration warning** replaces the percentile whenever the observation
   falls outside the 1st–99th percentile band under *every* scenario. At that
   point the correct inference is almost always "a rate assumption is wrong",
   not "you got lucky", and the app says so instead of reporting a percentile of
   99.97.
3. **An inverse-solve helper** backs out the λ at which your count would be the
   exact median — the λ solving `P(X ≤ observed) = 0.5` — and converts it to the
   blended shiny rate that would imply. Comparing that to the configured rate is
   the real diagnostic: it tells you whether the model or your luck is the
   outlier.

Reverse mode is **strictly read-only**. It never writes back to your medal
counts, never touches the rate config, and never auto-tunes anything.

Percentiles use the **mid-P convention**, `P(X < obs) + ½·P(X = obs)`. Without
the half-mass term a discrete distribution reports a systematically inflated
percentile — at λ = 0.9, "0 shundos" would read as the 41st percentile when it
is really the single most likely outcome.

## Rates and their sources

All rates live in [`src/config/rates.ts`](src/config/rates.ts), fully separated
from the math, each with a source comment and a low/mid/high band. **Every one
of them is editable at runtime** — open the `info` disclosure next to any medal
in the app. Overrides persist with your inputs.

Niantic has never published shiny rates. Everything below is community-estimated,
principally from The Silph Road's crowd-sourced tallies as aggregated by
Bulbapedia. IV floors, by contrast, are datamined and exact.

| Source | Shiny rate (low / **mid** / high) | IV floor | Confidence | Basis |
|---|---|---|---|---|
| Pokémon caught (remainder = plain wild) | 1/700 · **1/512** · 1/400 | 0 | high | Bulbapedia base rate 1/512; older Silph estimates nearer 1/450–1/500 |
| …weather-boosted | 1/700 · **1/512** · 1/400 | 4 | high | Weather boost changes the IV floor, not the shiny rate |
| …Community Day | 1/30 · **1/25** · 1/20 | 0 | high | Bulbapedia: ~1/25 for the featured species |
| …other event-boosted | 1/256 · **1/128** · 1/64 | 0 | low | Documented event tiers span 1/256 → 1/10; varies enormously by event |
| …research encounters | 1/512 · **1/64** · 1/32 | 10 | low | ~1/64 for field research; event research runs much hotter |
| Raids won, non-Legendary (tier 1–4) | 1/128 · **1/64** · 1/32 | 10 | high | Bulbapedia: 1/64 for non-5-star raids |
| Legendary raids (tier 5, counted separately) | 1/25 · **1/20** · 1/15 | 10 | high | Bulbapedia: 1/20 for 5-star raids |
| …Shadow raids | 1/64 · **1/20** · 1/10 | 6 | low | Floor 6 confirmed; **shiny rate extrapolated, not verified** |
| Rocket defeated (remainder = grunts) | 1/512 · **1/256** · 1/128 | 0 | medium | Bulbapedia: 1/256 for grunts |
| …weather-boosted grunts | 1/512 · **1/256** · 1/128 | 4 | medium | Weather-boosted shadow floor is 4 |
| …Leaders (Arlo / Cliff / Sierra) | 1/128 · **1/64** · 1/32 | 0 | medium | Bulbapedia: 1/64 for Rocket Leaders |
| Giovanni (counted separately) | 1/128 · **1/64** · 1/20 | 6 | medium | Bulbapedia: 1/64 for Giovanni; floor 6 |
| Eggs hatched | 1/128 · **1/64** · 1/32 | 10 | medium | Bulbapedia: ~1/64 from eggs |
| Good Friend trade | — | 1 | high | Trade floors are exact |
| Great Friend trade | — | 2 | high | " |
| Ultra Friend trade | — | 3 | high | " |
| Best Friend trade | — | 5 | high | " |
| **Lucky trade** | — | **12** | high | Lucky overrides friendship level entirely |

Primary sources:

- Bulbapedia, *Shiny Pokémon (GO)* — https://bulbapedia.bulbagarden.net/wiki/Shiny_Pok%C3%A9mon_(GO)
- Dittobase, *Pokémon GO IV Floors by Encounter Type* — https://www.dittobase.com/pokemon-go/iv-floors

Rates are stored as **probabilities**, not denominators: `low` is the
pessimistic (rarest) end, `high` the optimistic end.

## The three subtleties this app gets right

Most calculators of this shape get at least one of these wrong.

**1. Trades are re-rolls, not new Pokémon.** A traded Pokémon was already
counted at its original source. Trading re-rolls its *IVs only* — not its
shininess. So trades contribute **zero** to the shiny count, and contribute only
a fresh IV roll at the trade's floor to the hundo/shundo counts. This is why
your Gentleman medal cannot simply be added to your Collector medal, and it is
explicitly unit tested.

**2. Shadows cannot be traded.** Purification adds +2 to each IV (capped at 15),
so a shadow needs 13/13/13 or better to purify into a hundo:
`P = (3 / (16 − F))³`, exactly 27× the un-purified odds. Your **Purifier** medal
divided by the shadows you caught sets what share of them take that path; the λ
table shows both pure endpoints side by side regardless.

**3. Medals overlap, so counts are subtracted rather than added.** Community
Day and event catches are a subset of your Collector total — and so are raids,
research and Team GO Rocket catches. All of them are subtracted from their
parent medal rather than added on top. Entering subsets that exceed their
parent is flagged as a validation error in the UI.

## Testing

```sh
npm test
```

The math module is tested against known values:

| Case | Expected |
|---|---|
| floor 10 hundo | 1/216 |
| floor 12 hundo | 1/64 |
| floor 6 hundo | 1/1000 |
| floor 6 purified | 27/1000 |
| floor 0 purified | 27/4096 |
| λ = 0.71 | P(0)=0.4916, P(1)=0.3491, P(2)=0.1239 |
| Poisson-binomial DP | sums to 1.0 within 1e-9 |

Plus 60-odd model tests: medal threshold and mapping integrity, that every
source is exactly one of medal-backed / derived / remainder, an acyclic subset
graph, two-level subtraction, a no-double-count invariant, trade inputs never
increasing the shiny expected count, Purifier-driven purification blending
(including that it divides by *effective* shadow counts), derived counts scaling
with their parent medal, scenario ordering, rate/floor/assumption overrides, the
all-medals-at-platinum case, and the large-`n` small-`p` numerics (the pmf is
computed in log space so 200 000 catches at 1/512 does not underflow to
garbage).

## Structure

```
src/
  config/medals.ts       in-game medals: names, descriptions, tier thresholds
  config/rates.ts        all rate estimates + citations + medal nesting — no logic
  model/
    types.ts             shared types
    math.ts              pure probability: IV floors, Poisson, Poisson-binomial DP
    forward.ts           the forward model: counts -> λ and distributions
    math.test.ts
    forward.test.ts
  components/
    MedalForm.tsx        the nine medal inputs — the whole primary surface
    AssumptionsPanel.tsx the derived counts, collapsed by default
    ...                  results panels, charts, tables
  hooks/                 localStorage persistence
  lib/format.ts          display formatting
MODEL.md                 assumptions and known approximations
```

## Caveats

Read [MODEL.md](MODEL.md). The short version: the math is exact, the rates are
community estimates, and the derived splits are guesses. Three things bias the
answer in known directions:

1. **Your Collector total includes species that were shiny-locked at the time.**
   The model takes the count at face value, so it overestimates expected wild
   shinies — probably substantially. Override the Collector shiny rate downward
   to a blended effective rate if you want a fair comparison.
2. **Champion, Hero and Pokémon Ranger count battles won and tasks completed,
   not Pokémon caught.** All three run high.
3. **Shiny trades are a pure guess** and usually dominate expected shundos.

None of these is a math problem. They are all questions about what your numbers
actually mean.
