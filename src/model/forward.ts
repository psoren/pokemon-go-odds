/**
 * The forward model: counts in, expected values and distributions out.
 *
 * Three rules drive everything here:
 *
 *  1. Shiny and IV rolls are INDEPENDENT, so P(shundo) = P(shiny) * P(hundo).
 *  2. TRADES ARE RE-ROLLS, NOT NEW POKÉMON. A traded Pokémon was already
 *     counted at its original source, so trade inputs contribute zero shinies
 *     and only a fresh IV roll at the trade's floor.
 *  3. SUBSET SOURCES ARE SUBTRACTED from their parent, so a Community Day
 *     catch is not also counted as a plain wild catch.
 */

import { SOURCES, SOURCES_BY_ID } from '../config/rates';
import {
  buildDistribution,
  hundoProbability,
  purifiedHundoProbability,
} from './math';
import type {
  ModelInputs,
  ModelOutput,
  Scenario,
  SourceDef,
  SourceResult,
  Trial,
  ValidationIssue,
} from './types';

/** We report P(k) for k = 0..6, per spec. */
export const MAX_K = 6;

export function emptyInputs(): ModelInputs {
  return { counts: {}, overrides: {}, assumePurified: false };
}

/** The IV floor in effect for a source, honouring any user override. */
export function effectiveFloor(def: SourceDef, inputs: ModelInputs): number {
  const override = inputs.overrides[def.id]?.ivFloor;
  return override === undefined || !Number.isFinite(override) ? def.ivFloor : override;
}

/** The shiny probability in effect for a source at a given scenario. */
export function effectiveShinyRate(
  def: SourceDef,
  inputs: ModelInputs,
  scenario: Scenario,
): number {
  if (def.kind === 'trade' || !def.shinyRate) return 0;
  const override = inputs.overrides[def.id]?.[scenario];
  if (override !== undefined && Number.isFinite(override) && override >= 0) return override;
  return def.shinyRate[scenario];
}

function rawCount(def: SourceDef, inputs: ModelInputs): number {
  const raw = inputs.counts[def.id];
  if (!Number.isFinite(raw) || raw === undefined) return 0;
  return Math.max(0, Math.round(raw));
}

/**
 * Validate the input set. Subset sources (Community Day, weather-boosted, …)
 * must not exceed the parent they are carved out of.
 */
export function validate(inputs: ModelInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parents = new Set(SOURCES.map((s) => s.subsetOf).filter(Boolean) as string[]);
  for (const parentId of parents) {
    const parent = SOURCES_BY_ID[parentId];
    const children = SOURCES.filter((s) => s.subsetOf === parentId);
    const childTotal = children.reduce((acc, c) => acc + rawCount(c, inputs), 0);
    const parentTotal = rawCount(parent, inputs);
    if (childTotal > parentTotal) {
      issues.push({
        sourceId: parentId,
        severity: 'error',
        message:
          `${children.map((c) => c.label.replace(/^…of which /, '')).join(' + ')} = ` +
          `${childTotal.toLocaleString()}, which is more than the ${parent.label.toLowerCase()} ` +
          `total of ${parentTotal.toLocaleString()}. These are subsets, not extra catches — ` +
          `raise the total or lower the subsets. The excess is being ignored.`,
      });
    }
  }
  return issues;
}

/** Per-source expected values at one scenario. */
export function computeSources(inputs: ModelInputs, scenario: Scenario): SourceResult[] {
  return SOURCES.map((def) => {
    const raw = rawCount(def, inputs);
    const children = SOURCES.filter((s) => s.subsetOf === def.id);
    const childTotal = children.reduce((acc, c) => acc + rawCount(c, inputs), 0);
    // Clamp at 0: an over-subscribed parent is reported as a validation error
    // rather than being allowed to produce a negative count.
    const effectiveCount = children.length > 0 ? Math.max(0, raw - childTotal) : raw;

    const floor = effectiveFloor(def, inputs);
    const shinyP = effectiveShinyRate(def, inputs, scenario);
    const hundoP = hundoProbability(floor);
    const purifiedHundoP =
      def.kind === 'shadow' ? purifiedHundoProbability(floor) : hundoP;

    // The purification toggle only moves shadow sources.
    const activeHundoP =
      def.kind === 'shadow' && inputs.assumePurified ? purifiedHundoP : hundoP;

    // Rule 2: trades never contribute shinies.
    const lambdaShiny = def.kind === 'trade' ? 0 : effectiveCount * shinyP;

    const lambdaHundo = effectiveCount * activeHundoP;
    // A traded Pokémon is already shiny, so every hundo re-roll it lands is a
    // shundo — there is no extra shiny factor to apply.
    const lambdaShundo =
      def.kind === 'trade' ? effectiveCount * activeHundoP : lambdaShiny * activeHundoP;

    return {
      def,
      rawCount: raw,
      effectiveCount,
      ivFloor: floor,
      shinyP,
      hundoP,
      purifiedHundoP,
      lambdaShiny,
      lambdaHundo,
      lambdaShundo,
      lambdaHundoAsCaught: effectiveCount * hundoP,
      lambdaHundoPurified: effectiveCount * purifiedHundoP,
    };
  });
}

/** The Bernoulli probability each individual Pokémon from a source carries. */
function trialsFor(
  results: SourceResult[],
  which: 'shiny' | 'hundo' | 'shundo',
  assumePurified: boolean,
): Trial[] {
  const trials: Trial[] = [];
  for (const r of results) {
    if (r.effectiveCount <= 0) continue;
    const activeHundoP =
      r.def.kind === 'shadow' && assumePurified ? r.purifiedHundoP : r.hundoP;
    let p: number;
    if (which === 'shiny') {
      p = r.def.kind === 'trade' ? 0 : r.shinyP;
    } else if (which === 'hundo') {
      p = activeHundoP;
    } else {
      p = r.def.kind === 'trade' ? activeHundoP : r.shinyP * activeHundoP;
    }
    if (p > 0) trials.push({ n: r.effectiveCount, p });
  }
  return trials;
}

export function runModel(inputs: ModelInputs, scenario: Scenario): ModelOutput {
  const sources = computeSources(inputs, scenario);
  const sum = (pick: (r: SourceResult) => number) =>
    sources.reduce((acc, r) => acc + pick(r), 0);

  return {
    sources,
    lambdaShiny: sum((r) => r.lambdaShiny),
    lambdaHundo: sum((r) => r.lambdaHundo),
    lambdaShundo: sum((r) => r.lambdaShundo),
    shiny: buildDistribution(trialsFor(sources, 'shiny', inputs.assumePurified), MAX_K),
    hundo: buildDistribution(trialsFor(sources, 'hundo', inputs.assumePurified), MAX_K),
    shundo: buildDistribution(trialsFor(sources, 'shundo', inputs.assumePurified), MAX_K),
    validation: validate(inputs),
  };
}

export interface ScenarioBundle {
  low: ModelOutput;
  mid: ModelOutput;
  high: ModelOutput;
}

/** Run the model at all three rate estimates for the sensitivity view. */
export function runAllScenarios(inputs: ModelInputs): ScenarioBundle {
  return {
    low: runModel(inputs, 'low'),
    mid: runModel(inputs, 'mid'),
    high: runModel(inputs, 'high'),
  };
}
