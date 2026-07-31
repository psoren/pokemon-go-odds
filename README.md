# Pokémon GO rarity calculator

A local web app that takes your lifetime account stats and returns the expected
number — and the full probability distribution — of **shinies**, **hundos** and
**shundos** you should have.

Every encounter source is treated as an independent binomial trial with its own
shiny rate and IV floor. The app sums expected values across sources, reports
`P(k)` for `k = 0..6` both as a Poisson approximation and as an exact
Poisson-binomial convolution, and shows which sources actually drive your
rarities. (Spoiler: for most accounts it is a handful of lucky trades and
legendary raids, not tens of thousands of wild catches.)

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

The hundo number has no range. That is not a bug — IV floors are exact,
datamined game mechanics rather than estimates, so nothing in the rate config
moves them.

The `P(k)` panel shows two columns per distribution:

- **Poisson** — the `e^(−λ) λᵏ / k!` approximation.
- **Exact** — the true Poisson-binomial, computed by convolving each source's
  binomial pmf.

They should agree closely; the app flags any `k` where they diverge by more
than one percentage point. Trust the exact column.

## Rates and their sources

All rates live in [`src/config/rates.ts`](src/config/rates.ts), fully separated
from the math, each with a source comment and a low/mid/high band. **Every one
of them is editable at runtime** — open the `rate` disclosure next to any source
in the app. Overrides persist with your inputs.

Niantic has never published shiny rates. Everything below is community-estimated,
principally from The Silph Road's crowd-sourced tallies as aggregated by
Bulbapedia. IV floors, by contrast, are datamined and exact.

| Source | Shiny rate (low / **mid** / high) | IV floor | Confidence | Basis |
|---|---|---|---|---|
| Wild catches | 1/700 · **1/512** · 1/400 | 0 | high | Bulbapedia base rate 1/512; older Silph estimates nearer 1/450–1/500 |
| …weather-boosted | 1/700 · **1/512** · 1/400 | 4 | high | Weather boost changes the IV floor, not the shiny rate |
| …Community Day | 1/30 · **1/25** · 1/20 | 0 | high | Bulbapedia: ~1/25 for the featured species |
| …other event-boosted | 1/256 · **1/128** · 1/64 | 0 | low | Documented event tiers span 1/256 → 1/10; varies enormously by event |
| Egg hatches | 1/128 · **1/64** · 1/32 | 10 | medium | Bulbapedia: ~1/64 from eggs |
| Research encounters | 1/512 · **1/64** · 1/32 | 10 | low | ~1/64 for field research; event research runs much hotter |
| Tier 1–4 raids | 1/128 · **1/64** · 1/32 | 10 | high | Bulbapedia: 1/64 for non-5-star raids |
| Tier 5 legendary raids | 1/25 · **1/20** · 1/15 | 10 | high | Bulbapedia: 1/20 for 5-star raids |
| Shadow raids | 1/64 · **1/20** · 1/10 | 6 | low | Floor 6 confirmed; **shiny rate extrapolated, not verified** |
| Rocket grunt shadows | 1/512 · **1/256** · 1/128 | 0 | medium | Bulbapedia: 1/256 for grunts |
| …weather-boosted | 1/512 · **1/256** · 1/128 | 4 | medium | Weather-boosted shadow floor is 4 |
| Rocket leader shadows | 1/128 · **1/64** · 1/32 | 0 | medium | Bulbapedia: 1/64 for Arlo / Cliff / Sierra |
| Giovanni shadows | 1/128 · **1/64** · 1/20 | 6 | medium | Bulbapedia: 1/64 for Giovanni; floor 6 |
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
shininess. So the trade fields ask for the number of **shiny Pokémon you
traded**, they contribute **zero** to the shiny count, and they contribute a
fresh IV roll at the trade's floor to the hundo/shundo counts. This is
explicitly unit tested.

**2. Shadows cannot be traded.** Purification adds +2 to each IV (capped at 15),
so a shadow needs 13/13/13 or better to purify into a hundo:
`P = (3 / (16 − F))³`, exactly 27× the un-purified odds. Shadows get their own
purification column and never contribute to shundos-via-trade.

**3. Community Day and event catches are a subset of wild catches.** They are
subtracted from the wild total, not added to it. Entering subsets that exceed
their parent is flagged as a validation error in the UI.

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

Plus: trade inputs never increase the shiny expected count, subset subtraction,
scenario ordering, rate/floor overrides, and the large-`n` small-`p` numerics
(the pmf is computed in log space so 200 000 catches at 1/512 does not underflow
to garbage).

## Structure

```
src/
  config/rates.ts        all rate estimates + citations — no logic
  model/
    types.ts             shared types
    math.ts              pure probability: IV floors, Poisson, Poisson-binomial DP
    forward.ts           the forward model: counts -> λ and distributions
    math.test.ts
    forward.test.ts
  components/            React UI
  hooks/                 localStorage persistence
  lib/format.ts          display formatting
MODEL.md                 assumptions and known approximations
```

## Caveats

Read [MODEL.md](MODEL.md). The short version: the math is exact, the rates are
estimates, and the single biggest source of error is that **your lifetime catch
total includes many species that were shiny-locked at the time** — so the model
will tend to overestimate expected wild shinies unless you override the wild
rate downward to a blended effective rate.
