/**
 * Core types for the rarity model.
 *
 * The model treats every encounter source as an independent binomial trial
 * with its own shiny rate and IV floor. Nothing here knows about React.
 */

/** How a source contributes to the outputs. */
export type SourceKind =
  /** A normal encounter: contributes shinies, hundos and shundos. */
  | 'catch'
  /** A shadow encounter: same as `catch`, plus a purification IV path. Cannot be traded. */
  | 'shadow'
  /**
   * A trade of an ALREADY-SHINY Pokémon. Re-rolls IVs only. Contributes
   * hundos/shundos but NEVER shinies — the shiny was counted at its origin.
   */
  | 'trade'
  /**
   * Not an encounter source at all: a medal read purely to drive derived
   * counts below it (Gentleman → shiny trades) or to parameterise the model
   * (Purifier → what fraction of your shadows are purified). Contributes zero
   * to every output on its own.
   */
  | 'reference';

export type Confidence = 'high' | 'medium' | 'low';

export type { Medal } from '../config/medals';
import type { Medal } from '../config/medals';

/**
 * A community-estimated shiny rate, as a probability (not a denominator).
 * `low` < `mid` < `high` as probabilities, so `low` is the pessimistic case.
 */
export interface RateEstimate {
  low: number;
  mid: number;
  high: number;
}

/** Which end of the rate estimates to evaluate the model at. */
export type Scenario = 'low' | 'mid' | 'high';

/**
 * A count that no medal tracks, expressed as a fraction of a medal-backed
 * parent so it scales with whatever the user actually enters.
 *
 * These fractions are ROUGH DEFAULTS, not sourced data — nothing in the game
 * or the community datasets tells you what share of your catches were
 * weather-boosted. They exist so that entering nothing but medals still yields
 * a usable answer, they are all editable, and their low/high spread feeds the
 * headline range so the uncertainty they add is visible rather than hidden.
 */
export interface DerivedFrom {
  /** Source id whose resolved count this is a fraction of. */
  parentId: string;
  /** Fraction of the parent, per scenario. */
  fraction: RateEstimate;
  /** Shown in the assumptions UI. */
  rationale: string;
}

export interface SourceDef {
  id: string;
  label: string;
  category: string;
  kind: SourceKind;
  /** IV floor F: each stat rolls uniformly over [F, 15]. */
  ivFloor: number;
  /** Absent for `trade` sources, which carry no shiny roll of their own. */
  shinyRate?: RateEstimate;
  /**
   * The in-game medal this count is read from, or `null` when no medal tracks
   * it (in which case `medalNote` says what to do instead).
   */
  medal: Medal | null;
  /** Guidance for sources with no medal. Required in spirit when `medal` is null. */
  medalNote?: string;
  /**
   * Present when no medal tracks this count, so it is derived as a fraction of
   * a medal-backed parent instead of being typed in. Mutually exclusive with
   * `medal`: a source is either read off a medal or assumed from one.
   */
  derivedFrom?: DerivedFrom;
  /**
   * If set, this source's count is a SUBSET of the referenced source's count
   * and is subtracted from it so catches are not double counted.
   */
  subsetOf?: string;
  confidence: Confidence;
  /** Shown in the UI next to the rate. */
  note: string;
  /** Where the default rate came from. Rendered in the rate editor and README. */
  citation: string;
}

/** User-editable overrides, persisted to localStorage. */
export interface RateOverride {
  low?: number;
  mid?: number;
  high?: number;
  ivFloor?: number;
}

export interface ModelInputs {
  /** sourceId -> raw count entered by the user. Medal-backed sources only. */
  counts: Record<string, number>;
  /** sourceId -> rate/floor overrides. */
  overrides: Record<string, RateOverride>;
  /** sourceId -> overridden derived fraction, for sources no medal tracks. */
  assumptions: Record<string, Partial<RateEstimate>>;
  /**
   * Reverse mode: what you ACTUALLY have. Strictly read-only against the
   * forward model — nothing here feeds back into counts, rates or assumptions.
   */
  observed: Partial<Record<Metric, number>>;
}

/** The three things the model predicts. */
export type Metric = 'shiny' | 'hundo' | 'shundo';

export interface SourceResult {
  def: SourceDef;
  /** Count after subtracting any child sources that are subsets of this one. */
  effectiveCount: number;
  /** Resolved count before subset subtraction: typed for medals, derived otherwise. */
  rawCount: number;
  /** Share of this source's shadows assumed purified, from the Purifier medal. */
  purifiedFraction: number;
  ivFloor: number;
  /** P(shiny) for this source. 0 for trades. */
  shinyP: number;
  /** P(hundo) from a fresh IV roll at this floor: 1 / (16 - F)^3. */
  hundoP: number;
  /** P(hundo after purification): (min(3, 16-F) / (16 - F))^3. Shadows only. */
  purifiedHundoP: number;
  /** Expected counts. `hundo`/`shundo` respect the assumePurified toggle. */
  lambdaShiny: number;
  lambdaHundo: number;
  lambdaShundo: number;
  /** Always the as-caught values, regardless of the purification toggle. */
  lambdaHundoAsCaught: number;
  /** Always the purified values (shadows only; equals as-caught elsewhere). */
  lambdaHundoPurified: number;
}

export interface Trial {
  n: number;
  p: number;
}

/** A distribution over k = 0..maxK, plus the leftover mass above maxK. */
export interface Distribution {
  /** Poisson approximation, P(k) for k = 0..maxK. */
  poisson: number[];
  /** Exact Poisson-binomial via DP convolution, P(k) for k = 0..maxK. */
  exact: number[];
  /** 1 - sum(exact), i.e. P(X > maxK). */
  tail: number;
  lambda: number;
  /** max_k |poisson[k] - exact[k]|. */
  maxAbsDivergence: number;
  /** True when maxAbsDivergence > 0.01. */
  diverges: boolean;
}

export interface ModelOutput {
  sources: SourceResult[];
  lambdaShiny: number;
  lambdaHundo: number;
  lambdaShundo: number;
  shiny: Distribution;
  hundo: Distribution;
  shundo: Distribution;
  /** Non-fatal problems with the inputs (e.g. subsets exceeding their parent). */
  validation: ValidationIssue[];
  /** Share of all shadows assumed purified (Purifier medal ÷ shadows caught). */
  purifiedFraction: number;
  /** The per-Pokémon Bernoulli trials behind each distribution, for reverse mode. */
  trials: Record<Metric, Trial[]>;
}

export interface ValidationIssue {
  sourceId: string;
  severity: 'error' | 'warning';
  message: string;
}
