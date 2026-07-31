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

- The Gentleman medal ("Trade ___ Pokémon") is a **separate root**, never added
  to or subtracted from Collector. Trading does not create a Pokémon.
- Trade sources contribute **zero** to the shiny expected count.
- They contribute a fresh IV roll at the trade's floor, which — because the
  Pokémon is already shiny — lands in both the hundo and shundo columns.
- What the model actually needs is the *shiny* trades, which no medal counts.
  That is derived from Gentleman as a fraction (§3.4) and split across
  friendship levels, with Best Friend taking the remainder.

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

**How much of your collection takes that path is read off the Purifier medal**
("Purify ___ Shadow Pokémon"), divided by the shadows you actually caught:

```
f = min(1, Purifier ÷ (effective shadow counts))
```

Each shadow source then splits into two genuinely different trial groups — the
purified share at the purified probability, and the rest at the plain one. They
are not averaged into a single fudged probability. The λ table still shows both
pure endpoints side by side regardless of `f`.

Note the divisor is the **effective** shadow count, not the raw one: the Hero
medal already contains the Leaders carved out of it, so summing raw counts would
double-count them, inflate the denominator, and understate how purified your
collection is. (Giovanni is *not* inside Hero — see §3.3.1 — so it is added
separately.)

**Known approximations.**

- Purification is applied uniformly across shadow sources. In practice you
  purify selectively — usually the ones already close to perfect — so a real
  account's purified shadows are better than a random sample. This makes the
  model *understate* purified hundos for a careful player.
- A *shiny* shadow that purifies into a hundo is a shundo, and the app models
  that: shadow sources contribute `count · p_shiny · P(purify-hundo)` to the
  shundo column for the purified share. This is a real path to a shundo that
  does not involve a trade.
- Purifying costs stardust and candy and removes the shadow damage bonus, so
  most players never purify everything. The medal tells the truth about what you
  did, which is the whole point of using it.

### 3.3 Counts come from medals, and medals overlap

Every count in the app is meant to be read off the in-game Medals screen rather
than estimated. That is a real accuracy win — the medal screen shows exact
progress — but it forces the model to deal with the fact that **medals contain
each other**. The Collector medal's in-game text is an unqualified "Catch ___
Pokémon", so it already includes the Pokémon you caught from raids, from
research and from Team GO Rocket.

So sources form a tree and every child's count is subtracted from its parent:

```
Collector          "Catch ___ Pokémon"                          50,000
├── weather-boosted / Community Day / other event catches       [derived]
├── Champion       "Win ___ raids"                               2,000
│   └── Shadow raids                                            [derived]
├── Battle Legend  "Win ___ Legendary raids"                     2,000
├── Ultra Hero     "Defeat Giovanni ___ time(s)"                    50
├── Pokémon Ranger "Complete ___ Field Research tasks"           2,500
└── Hero           "Defeat ___ Team GO Rocket members"           2,000
    └── Leaders / weather-boosted grunts                        [derived]

Breeder            "Hatch ___ Eggs"                              2,500
Gentleman          "Trade ___ Pokémon"                           2,500
└── shiny trades → lucky / good / great / ultra                 [derived]
    └── Best Friend trades                                      [remainder]
Purifier           "Purify ___ Shadow Pokémon"                   1,000
```

A parent's *remainder* after subtraction is what gets its own rate: the
Collector remainder is plain unboosted wild catches, the Champion remainder is
tier 1–4 raids, the Hero remainder is ordinary grunts.

**How confident is each containment?**

| Containment | Confidence | Why |
|---|---|---|
| Raid catches ⊂ Collector | high | Raid bosses are caught, and the medal text is unqualified |
| Research catches ⊂ Collector | high | Same |
| Rocket catches ⊂ Collector | high | Same |
| Legendary raids ⊂ Champion | **DISPROVEN** | Modelled as nested until a real account reported Champion 530 with Battle Legend 664 — impossible if Champion contained it. Now independent counters. See §3.3.1 |
| Shadow raids ⊂ Champion | high | Shadow raids are raids |
| Leaders ⊂ Hero | high | Leaders are Team GO Rocket members; the medal was renamed from "Grunts" to "members" |
| Giovanni ⊂ Hero | **rejected** | Same independent-counter pattern as Champion/Battle Legend, and sources say Giovanni feeds Ultra Hero specifically. Immaterial either way — at platinum it is 50 battles against 2,000 |
| Eggs ⊄ Collector | medium | Hatching is not catching, and Breeder tracks it separately |

#### 3.3.1 The containment that turned out to be wrong

The first version of this model treated Battle Legend as a subset of Champion,
reasoning that the in-game text "Win ___ raids" is unqualified so it must
include Legendary wins. That was a plausible reading of the medal text and it
was wrong.

A real account reported **Champion 530, Battle Legend 664**. Under the nested
model that is arithmetically impossible, and the app duly accused the player of
entering bad numbers. The player was right and the model was wrong. Corroborating
evidence: Niantic Support publicly acknowledged in 2017 that Legendary raids
were not counting toward the Champion medal, and Champion and Battle Legend
share an identical 2,000 platinum threshold, which is a strange design unless
they count different things.

Two lessons are baked into the app as a result:

1. **Battle Legend and Ultra Hero are independent counters**, entered exactly
   as the game shows them, and never subtracted from Champion or Hero.
2. **A containment conflict is reported as a possible bug in the model, not as
   user error.** When the conflict is between two medal numbers — things the
   player read off a screen rather than estimated — the message now says so
   directly, because the medals are the ground truth and the assumed
   relationship between them is the guess.

**The validator is the safety net.** If any of these is wrong for your account,
your real medal numbers will not fit: subsets summing to more than their parent
is a hard error in the UI. That check is what makes these assumptions
falsifiable rather than silent.

**Known approximations here:**

- **A parent left at zero is treated as "not filled in yet", not as an error.**
  The children still contribute in full; only the remainder is empty. Without
  this the app would scream at you the whole time you were typing.
- **The medals count the wrong verb.** Champion counts raids *won*, not bosses
  *caught*; Hero counts Rocket members *defeated*, not shadows *caught*;
  Pokémon Ranger counts field research tasks *completed*, a large share of which
  reward items rather than an encounter. Each makes the app **overestimate**
  encounters from that source.

  Pokémon Ranger was the worst offender, and is now handled properly: it is a
  reference denominator, and the encounter count is derived from it at 40/60/75%
  (see §3.4). This was found from a real account reporting 57 hundos against a
  predicted 76 — treating all 5,400 completed tasks as floor-10 encounters was
  inflating the hundo prediction by roughly 10. Champion and Hero still count
  the wrong verb and are still not corrected for it, because unlike research
  there is no published base rate for how often you flee a raid boss.
- **Special and Timed Research encounters are not counted by any medal.**
  Pokémon Ranger covers Field Research only. Add them by hand.
- **Subsets are treated as mutually exclusive.** A weather-boosted Community
  Day catch is genuinely both, and the model has no cell for it. Put it in
  Community Day: the shiny rate difference (1/25 vs 1/512) dwarfs the IV floor
  difference (0 vs 4).
- **No medal exists for shiny trades.** The Gentleman medal counts all trades,
  so the shiny share is derived (§3.4) rather than known. That derived number is
  the least reliable input in the app — and, per the contribution chart, usually
  the most important one. That is an uncomfortable combination and worth knowing.

### 3.4 Counts no medal tracks are derived, not invented silently

Eleven of the model's counts have no medal behind them. Rather than demand
eleven extra guesses from the user, each is derived as a fraction of a
medal-backed parent:

| Derived | Share of | low / mid / high |
|---|---|---|
| Weather-boosted catches | Collector | 20 / 30 / 45 % |
| Community Day featured species | Collector | 1 / 3 / 6 % |
| Other event-boosted catches | Collector | 3 / 8 / 15 % |
| Shadow raids | Champion | 0 / 1 / 4 % |
| Rocket Leaders | Hero | 5 / 12 / 20 % |
| Weather-boosted grunt shadows | Hero | 15 / 25 / 40 % |
| Research encounters | Pokémon Ranger | 40 / 60 / 75 % |
| Shiny trades | Gentleman | 4 / 12 / 25 % |
| Lucky trades | shiny trades | 5 / 15 / 35 % |
| Good / Great / Ultra trades | shiny trades | 0-8 / 0-10 / 0-15 % |
| Best Friend trades | shiny trades | the remainder |

**These fractions are not sourced and not measured.** No medal, no datamine and
no community study tells you what share of your catches happened in boosted
weather. They are plausible defaults, nothing more.

Three things keep that honest rather than misleading:

1. **They are visible and editable.** The Assumptions panel shows each derived
   count, what it is a share of, and why the default is what it is.
2. **They move with the scenarios.** The low and high runs use the low and high
   fractions, so the headline range covers "my assumed splits are wrong"
   alongside "the community rates are wrong". An assumption you are unsure about
   *widens* the answer instead of quietly biasing it. This is why the shundo
   range is much wider than it was when these were typed in by hand — that width
   was always real, it was just hidden before.
3. **The dominant one is called out.** Shiny trades usually drive most of the
   expected shundos, so the UI says so directly rather than burying it.

The honest summary: the medals are exact, the shiny rates are contested
estimates, and these splits are guesses. The app tries never to let those three
look like the same kind of number.

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

**Where this is hiding.** The wild rate band is 1/700 · 1/512 · 1/400, which is
much wider than the measurement uncertainty warrants — Silph Road's estimates
cluster around 1/450–1/512. The extra width is standing in for the eligible
share. That is a defensible way to carry the uncertainty, but it is worth being
explicit that the band is doing two jobs, only one of which is a "rate".

The honest fix if you want a sharper answer is to override the wild shiny rate
downward to a *blended* effective rate that accounts for your eligible fraction.
If roughly half your lifetime catches were of shiny-eligible species at the
time, override the wild rate to about 1 in 1000 and narrow the band around it.

### 4.2 Your event mix is not the community average

The `event-wild` rate spans 1/256 to 1/10 depending on which events they were.
It is marked low-confidence for good reason. If events are a large share of your
catches, this term alone can dominate the uncertainty — check the "what drives
the shundo uncertainty" panel.

### 4.3 The shadow raid shiny rate is not independently established

The default of 1/20 is extrapolated from the 5-star raid rate. The IV floor of 6
is confirmed; the shiny rate is not. Unless you have done many shadow raids it
will not matter, but it is the weakest citation in `src/config/rates.ts`.

### 4.4 The medals count a slightly different thing than the model wants

Covered in detail in §3.3, but to summarise the direction of the error: the
medals count *battles won* and *tasks completed*, while the model wants
*Pokémon caught*. Champion counts raids won even if you fled the boss; Hero
counts Rocket members defeated, not shadows caught; Pokémon Ranger counts field
research tasks completed, most of which reward items rather than an encounter.
All three run high, and every one of them therefore **overestimates** expected
shinies.

Going the other way, no medal counts Special or Timed Research encounters, and
no medal counts shiny trades, so those inputs start at zero unless you fill them
in by hand. The trade fields being both hand-counted and (per the contribution
chart) usually dominant is the single most uncomfortable fact about this model.

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
