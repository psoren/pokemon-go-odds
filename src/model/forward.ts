/**
 * The forward model: medal counts in, expected values and distributions out.
 *
 * Four rules drive everything here:
 *
 *  1. Shiny and IV rolls are INDEPENDENT, so P(shundo) = P(shiny) * P(hundo).
 *  2. TRADES ARE RE-ROLLS, NOT NEW POKÉMON. A traded Pokémon was already
 *     counted at its original source, so trade sources contribute zero shinies
 *     and only a fresh IV roll at the trade's floor.
 *  3. MEDALS CONTAIN EACH OTHER, so every child source is subtracted from its
 *     parent rather than added on top.
 *  4. COUNTS NO MEDAL TRACKS ARE DERIVED as a fraction of a medal-backed
 *     parent, so entering nothing but medals still produces an answer. Those
 *     fractions are rough defaults, not data — see `src/config/rates.ts`.
 */

import { SOURCES, SOURCES_BY_ID, depthOf } from '../config/rates';
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

/** The medal whose count sets how many shadows carry the purification bonus. */
const PURIFIER_ID = 'purifier';

export function emptyInputs(): ModelInputs {
  return { counts: {}, overrides: {}, assumptions: {} };
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
  if (def.kind === 'trade' || def.kind === 'reference' || !def.shinyRate) return 0;
  const override = inputs.overrides[def.id]?.[scenario];
  if (override !== undefined && Number.isFinite(override) && override >= 0) return override;
  return def.shinyRate[scenario];
}

/** The derived fraction in effect for a source, honouring any user override. */
export function effectiveFraction(
  def: SourceDef,
  inputs: ModelInputs,
  scenario: Scenario,
): number {
  if (!def.derivedFrom) return 0;
  const override = inputs.assumptions[def.id]?.[scenario];
  if (override !== undefined && Number.isFinite(override) && override >= 0) {
    return Math.min(1, override);
  }
  return def.derivedFrom.fraction[scenario];
}

function typedCount(id: string, inputs: ModelInputs): number {
  const raw = inputs.counts[id];
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.round(raw));
}

/**
 * A source with a parent but neither a medal nor a derived fraction takes
 * whatever is left of its parent after its siblings. Currently just Best
 * Friend trades, which soak up every shiny trade not assigned elsewhere.
 */
function isRemainder(def: SourceDef): boolean {
  return def.subsetOf !== undefined && def.medal === null && def.derivedFrom === undefined;
}

/**
 * Resolve every source's raw count, before subset subtraction.
 *
 * Medal-backed sources take what the user typed. Derived sources take a
 * fraction of their already-resolved parent, so resolution happens in
 * ascending depth order.
 */
export function resolveCounts(
  inputs: ModelInputs,
  scenario: Scenario,
): Record<string, number> {
  const resolved: Record<string, number> = {};
  const byDepth = [...SOURCES].sort((a, b) => depthOf(a.id) - depthOf(b.id));

  for (const def of byDepth) {
    if (def.derivedFrom) {
      const parent = resolved[def.derivedFrom.parentId] ?? 0;
      resolved[def.id] = Math.round(parent * effectiveFraction(def, inputs, scenario));
    } else if (isRemainder(def)) {
      const parent = resolved[def.subsetOf!] ?? 0;
      const siblings = SOURCES.filter(
        (s) => s.subsetOf === def.subsetOf && s.id !== def.id,
      ).reduce((acc, s) => acc + (resolved[s.id] ?? 0), 0);
      resolved[def.id] = Math.max(0, parent - siblings);
    } else {
      resolved[def.id] = typedCount(def.id, inputs);
    }
  }
  return resolved;
}

/**
 * Validate the input set. Subset sources must not exceed the parent they are
 * carved out of. A parent left at zero just means it has not been filled in
 * yet — flagging that would fire constantly while someone is mid-entry.
 */
export function validate(inputs: ModelInputs, scenario: Scenario = 'mid'): ValidationIssue[] {
  const resolved = resolveCounts(inputs, scenario);
  const issues: ValidationIssue[] = [];
  const parents = new Set(SOURCES.map((s) => s.subsetOf).filter(Boolean) as string[]);

  for (const parentId of parents) {
    const parent = SOURCES_BY_ID[parentId];
    // Remainder children absorb slack; they can never push a parent over.
    const children = SOURCES.filter((s) => s.subsetOf === parentId && !isRemainder(s));
    const childTotal = children.reduce((acc, c) => acc + (resolved[c.id] ?? 0), 0);
    const parentTotal = resolved[parentId] ?? 0;
    if (parentTotal > 0 && childTotal > parentTotal) {
      const parentName = parent.medal ? parent.medal.name : parent.label;
      const derived = children.filter((c) => c.derivedFrom);
      const medalChildren = children.filter((c) => c.medal);
      issues.push({
        sourceId: parentId,
        severity: 'error',
        message:
          `${children.map((c) => c.label).join(' + ')} = ${childTotal.toLocaleString()}, ` +
          `which is more than your ${parentName} total of ${parentTotal.toLocaleString()}. ` +
          (medalChildren.length > 0
            ? `If those medal numbers are what the game shows you, then they are ` +
              `independent counters rather than nested ones, and this app has the ` +
              `relationship wrong — that is a bug here, not a mistake by you. `
            : '') +
          (derived.length > 0
            ? `Otherwise the assumed split is too high for how you play; adjust it under ` +
              `Assumptions. `
            : '') +
          `The excess is being ignored for now.`,
      });
    }
  }
  return issues;
}

/** Resolved counts minus each source's children — what actually carries a rate. */
function effectiveCounts(resolved: Record<string, number>): Record<string, number> {
  const effective: Record<string, number> = {};
  for (const def of SOURCES) {
    const raw = resolved[def.id] ?? 0;
    const children = SOURCES.filter((s) => s.subsetOf === def.id);
    const childTotal = children.reduce((acc, c) => acc + (resolved[c.id] ?? 0), 0);
    // Clamp at 0: an over-subscribed parent is reported as a validation error
    // rather than being allowed to produce a negative count.
    effective[def.id] = children.length > 0 ? Math.max(0, raw - childTotal) : raw;
  }
  return effective;
}

/**
 * What share of shadows carry the purification bonus: the Purifier medal
 * divided by the shadows you actually caught. Clamped to [0, 1].
 *
 * Divides by EFFECTIVE counts — the raw Hero total already contains Leaders
 * and Giovanni, so using it would inflate the denominator and understate how
 * much of your collection is purified.
 */
function purifiedFractionOf(
  effective: Record<string, number>,
  inputs: ModelInputs,
): number {
  const shadows = SOURCES.filter((s) => s.kind === 'shadow').reduce(
    (acc, s) => acc + (effective[s.id] ?? 0),
    0,
  );
  if (shadows <= 0) return 0;
  return Math.min(1, typedCount(PURIFIER_ID, inputs) / shadows);
}

/** Per-source expected values at one scenario. */
export function computeSources(inputs: ModelInputs, scenario: Scenario): SourceResult[] {
  const resolved = resolveCounts(inputs, scenario);
  const effective = effectiveCounts(resolved);
  const purifiedFraction = purifiedFractionOf(effective, inputs);

  return SOURCES.map((def) => {
    const raw = resolved[def.id] ?? 0;
    const effectiveCount = effective[def.id] ?? 0;

    const floor = effectiveFloor(def, inputs);
    const shinyP = effectiveShinyRate(def, inputs, scenario);
    const hundoP = hundoProbability(floor);
    const purifiedHundoP =
      def.kind === 'shadow' ? purifiedHundoProbability(floor) : hundoP;

    // Only shadows can be purified, and only the share the Purifier medal says.
    const f = def.kind === 'shadow' ? purifiedFraction : 0;
    const activeHundoP = (1 - f) * hundoP + f * purifiedHundoP;

    const isSource = def.kind !== 'reference';
    // Rule 2: trades never contribute shinies. Reference medals contribute nothing.
    const lambdaShiny = def.kind === 'catch' || def.kind === 'shadow'
      ? effectiveCount * shinyP
      : 0;

    const lambdaHundo = isSource ? effectiveCount * activeHundoP : 0;
    // A traded Pokémon is already shiny, so every hundo re-roll it lands is a
    // shundo — there is no extra shiny factor to apply.
    const lambdaShundo = !isSource
      ? 0
      : def.kind === 'trade'
        ? effectiveCount * activeHundoP
        : lambdaShiny * activeHundoP;

    return {
      def,
      rawCount: raw,
      effectiveCount,
      purifiedFraction: f,
      ivFloor: floor,
      shinyP,
      hundoP,
      purifiedHundoP,
      lambdaShiny,
      lambdaHundo,
      lambdaShundo,
      lambdaHundoAsCaught: isSource ? effectiveCount * hundoP : 0,
      lambdaHundoPurified: isSource ? effectiveCount * purifiedHundoP : 0,
    };
  });
}

/**
 * The Bernoulli probability each individual Pokémon from a source carries.
 *
 * A partly-purified shadow source splits into two trial groups — the purified
 * share and the rest — because they are genuinely two different probabilities,
 * not one averaged one.
 */
function trialsFor(
  results: SourceResult[],
  which: 'shiny' | 'hundo' | 'shundo',
): Trial[] {
  const trials: Trial[] = [];

  const push = (n: number, hundoP: number, r: SourceResult) => {
    if (n <= 0) return;
    let p: number;
    if (which === 'shiny') {
      p = r.def.kind === 'catch' || r.def.kind === 'shadow' ? r.shinyP : 0;
    } else if (which === 'hundo') {
      p = hundoP;
    } else {
      p = r.def.kind === 'trade' ? hundoP : r.shinyP * hundoP;
    }
    if (p > 0) trials.push({ n, p });
  };

  for (const r of results) {
    if (r.def.kind === 'reference' || r.effectiveCount <= 0) continue;
    const f = r.purifiedFraction;
    if (f <= 0) {
      push(r.effectiveCount, r.hundoP, r);
    } else if (f >= 1) {
      push(r.effectiveCount, r.purifiedHundoP, r);
    } else {
      const purified = Math.round(r.effectiveCount * f);
      push(r.effectiveCount - purified, r.hundoP, r);
      push(purified, r.purifiedHundoP, r);
    }
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
    shiny: buildDistribution(trialsFor(sources, 'shiny'), MAX_K),
    hundo: buildDistribution(trialsFor(sources, 'hundo'), MAX_K),
    shundo: buildDistribution(trialsFor(sources, 'shundo'), MAX_K),
    validation: validate(inputs, scenario),
    purifiedFraction: sources.find((r) => r.def.kind === 'shadow')?.purifiedFraction ?? 0,
  };
}

export interface ScenarioBundle {
  low: ModelOutput;
  mid: ModelOutput;
  high: ModelOutput;
}

/**
 * Run the model at all three estimates. Both the shiny rates AND the derived
 * count fractions move together, so the resulting range covers "the community
 * rates are wrong" and "my assumed splits are wrong" at once.
 */
export function runAllScenarios(inputs: ModelInputs): ScenarioBundle {
  return {
    low: runModel(inputs, 'low'),
    mid: runModel(inputs, 'mid'),
    high: runModel(inputs, 'high'),
  };
}
