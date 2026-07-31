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
  | 'trade';

export type Confidence = 'high' | 'medium' | 'low';

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
  /** sourceId -> raw count entered by the user. */
  counts: Record<string, number>;
  /** sourceId -> rate/floor overrides. */
  overrides: Record<string, RateOverride>;
  /** Treat shadow Pokémon as purified (+2 to each IV, capped at 15). */
  assumePurified: boolean;
}

export interface SourceResult {
  def: SourceDef;
  /** Count after subtracting any child sources that are subsets of this one. */
  effectiveCount: number;
  /** Count as the user typed it, before subset subtraction. */
  rawCount: number;
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
}

export interface ValidationIssue {
  sourceId: string;
  severity: 'error' | 'warning';
  message: string;
}
