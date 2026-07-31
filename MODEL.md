# MODEL.md — what the model assumes, and where it is knowingly wrong

This file exists so the numbers the app prints are never mistaken for more than
they are. The math is exact. The **inputs to the math are estimates**, and
several structural assumptions are convenient rather than true.

---

## 1. The model in one page

Every encounter source `i` contributes `count_i` independent trials, each with:

- a shiny probability `p_i` (a community estimate, editable at runtime), and
- an IV floor `F_i` (an exact, datamined game mechanic).

An IV floor `F` means each of the three stats rolls uniformly over `[F, 15]`, so
there are `(16 − F)` possible values per stat and

```
P(hundo | F) = 1 / (16 − F)³
```

Shiny and IV rolls are treated as **independent**, so

```
P(shundo | F) = p · 1 / (16 − F)³
```

Expected counts sum across sources:

```
λ_total = Σ count_i · p_i
```

and the app reports `P(k)` for `k = 0..6` two ways:

- the **Poisson approximation**, `P(k) = e^(−λ) λᵏ / k!`, and
- the **exact Poisson-binomial**, computed by convolving each source's binomial
  pmf. Each source is `Binomial(count_i, p_i)`; independent sources convolve.

They are shown side by side, and the UI flags any `k` where they differ by more
than one percentage point. In this app's regime — many trials, tiny per-trial
probabilities — they agree to within ~0.1%. The exact column is the one to
trust; the Poisson column exists to show that the approximation is behaving.

---

## 2. Independence assumptions

### 2.1 Shiny ⊥ IV — believed true

Nothing in the datamined encounter generation ties the shiny roll to the IV
roll. This is the assumption the community has always worked under and there is
no evidence against it. **This one is probably fine.**

### 2.2 Encounters are independent of each other — mostly true, with exceptions

The model assumes no encounter's outcome affects any other. Known violations:

- **Guaranteed-shiny encounters.** Some research rewards and ticketed-event
  encounters are 100% shiny. These are not trials at all; entering them as
  ordinary catches understates them badly. Enter them by overriding a source's
  rate to `1 in 1`, or just subtract them and add them to your observed total
  by hand.
- **Shiny-locked species.** Many species have never had a shiny release. Every
  catch of one is a guaranteed *non*-shiny — a trial with `p = 0`, not `p = 1/512`.
  See §4.1, which is the single largest source of error in this model.
- **Party Play / lobby effects and the "shiny check" of a Pokémon already seen
  as shiny** do not apply here, but nest-style spawns of a single species do
  mean your catches are not a random sample of the dex.

### 2.3 Rates are constant over your account's lifetime — false

The model applies one rate per source to your entire history. In reality:

- The base wild rate has been reported at 1/450, 1/500 and 1/512 in different
  eras of Silph Road data collection.
- Event-boosted rates have ranged from 1/256 to 1/10, and the *mix* of events
  has changed enormously since 2017.
- Shiny eligibility expands constantly — a species that was shiny-locked for
  your first three years is not now.

A single account-lifetime rate is a **blend** whose true value depends on when
you played. This is the main reason every headline number is a range.

---

## 3. Modelling choices that are deliberate

### 3.1 Trades are re-rolls, not new Pokémon

A traded Pokémon was already counted at whatever source it was caught from.
Trading re-rolls its **IVs only** — shininess is not re-rolled. So:

- Trade inputs are entered as **"number of shiny Pokémon traded."**
- They contribute **zero** to the shiny expected count.
- They contribute a fresh IV roll at the trade's floor, which — because the
  Pokémon is already shiny — lands in both the hundo and shundo columns.

**Known approximation.** Strictly, re-rolling a Pokémon's IVs should also
*remove* the hundo probability it carried at its original source. If you trade
a shiny caught at floor 10, the correct adjustment is `−1/216` and `+1/64`, not
just `+1/64`. The app only adds. The removal term is small (the largest case,
floor 10 → lucky, over-counts by about 0.5% of one hundo per trade), and the
app has no way to know which source each traded shiny came from. It is
documented here rather than silently absorbed.

Trade IV floors, by friendship level: Good 1, Great 2, Ultra 3, Best 5.
**Lucky overrides friendship entirely: floor 12.**

### 3.2 Shadows cannot be traded; purification is their only IV upgrade

Shadow Pokémon are untradeable. Purification adds +2 to each IV, capped at 15,
so a shadow needs **13/13/13 or better** to purify into a hundo:

```
P(purify-hundo | F) = (min(3, 16 − F) / (16 − F))³
```

which is exactly 27× the un-purified odds for any floor `F ≤ 12`. Floor 6 gives
27/1000; floor 0 gives 27/4096.

The app shows the purified path as its own column and never lets shadows
contribute to shundos-via-trade. The "count shadows as purified" toggle decides
whether the purified path feeds the totals and distributions.

**Note on the shiny case.** A *shiny* shadow that purifies into a hundo is a
shundo. The app models this: with the toggle on, shadow sources contribute
`count · p_shiny · P(purify-hundo)` to the shundo column. This is a real path to
a shundo that does not involve a trade.

**Known approximation.** Purification is all-or-nothing here. In practice you
purify selectively — usually only the shadows that are already close — and a
purified shadow loses the shadow damage bonus, so most players do not purify
everything. Treat the toggle as the two ends of a range, not a prediction.

### 3.3 Subset sources are subtracted, not added

Community Day catches, weather-boosted catches and event catches are all also
wild catches. Entering them separately and letting them add would double count.
The app subtracts every child source from its parent:

- `wild-weather`, `community-day`, `event-wild` are subtracted from `wild`.
- `grunt-shadow-weather` is subtracted from `grunt-shadow`.

An over-subscribed parent (subsets summing to more than the total) is reported
as a validation error in the UI and the parent is clamped to zero rather than
going negative.

**Known approximation.** The subsets are treated as mutually exclusive. A
weather-boosted Community Day catch is genuinely both, and the model has no cell
for it — you have to decide which bucket it goes in. Put it in Community Day:
the shiny rate difference (1/25 vs 1/512) dwarfs the IV floor difference
(0 vs 4).

---

## 4. Where the model is most likely to be wrong

Ranked by how much damage each does.

### 4.1 Shiny eligibility — the big one

The base rate of ~1/512 applies **only to shiny-eligible species**. Your
lifetime catch total includes an enormous number of catches of species that
were shiny-locked at the time — every Pidgey before its shiny release, every
species that still has no shiny.

The app takes your raw catch count at face value. **It therefore overestimates
expected shinies from wild catches, probably substantially.** If your observed
shiny count comes in far below the model's prediction, this is the first thing
to suspect — not bad luck.

The honest fix is to override the wild shiny rate downward to a *blended*
effective rate that accounts for your eligible fraction. If roughly half your
lifetime catches were of shiny-eligible species at the time, override the wild
rate to about 1 in 1000.

### 4.2 Your event mix is not the community average

The `event-wild` rate spans 1/256 to 1/10 depending on which events they were.
It is marked low-confidence for good reason. If events are a large share of your
catches, this term alone can dominate the uncertainty — check the "what drives
the shundo uncertainty" panel.

### 4.3 The shadow raid shiny rate is not independently established

The default of 1/20 is extrapolated from the 5-star raid rate. The IV floor of 6
is confirmed; the shiny rate is not. Unless you have done many shadow raids it
will not matter, but it is the weakest citation in `src/config/rates.ts`.

### 4.4 Counts you enter are not what the model thinks they are

- **Raid counts** are raids *completed*; the model treats them as *catches*. If
  you have fled a boss, your effective count is lower.
- **Rocket grunt counts** should be shiny-*eligible* shadow encounters, and only
  the ones you actually caught.
- **Medal counts** conflate things: the Collector medal counts catches, not
  encounters, which is what you want — but Breeder counts eggs hatched
  including non-shiny-eligible species.

### 4.5 Ditto, Smeargle, and species with bespoke rates

A handful of species have their own rates (Ditto's disguise mechanic, Smeargle
photobombs, permaboosted species at ~1/64, the lake trio at ~1/20). None of
these are modelled separately. If they are a meaningful share of your play,
add them by overriding a source rate.

---

## 5. What the model gets exactly right

To be clear about the other side of the ledger:

- **IV floors** are datamined game mechanics, not estimates. `P(hundo | F)` and
  `P(purify-hundo | F)` are exact. This is why the hundo headline number has no
  range — it does not depend on any contested rate.
- **The Poisson-binomial convolution** is exact given the inputs, not an
  approximation. It is tested to sum to 1 within 1e-9.
- **The trade logic** — zero shiny contribution, fresh IV roll at the trade
  floor — is a correct reading of the game mechanic, and is unit tested.
- **Subset subtraction** correctly prevents the most common double-counting
  error in calculators like this one.

The model's uncertainty lives almost entirely in the shiny rates and in what
your entered counts actually represent. Neither is a math problem.
