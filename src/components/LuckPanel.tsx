import type { ScenarioBundle } from '../model/forward';
import {
  UNCERTAIN_SPREAD_POINTS,
  assessLuckRange,
  ordinal,
  type LuckRange,
} from '../model/percentile';
import type { Metric, ModelInputs } from '../model/types';
import { fmtLambda, fmtOneIn, fmtPercent } from '../lib/format';
import { Callout, Panel } from './ui';
import { PerfectIV, ShundoMark, Sparkle } from './art';

const METRICS: {
  key: Metric;
  label: string;
  lambdaKey: 'lambdaShiny' | 'lambdaHundo' | 'lambdaShundo';
  accent: string;
  art: React.ReactNode;
}[] = [
  {
    key: 'shiny',
    label: 'Shinies',
    lambdaKey: 'lambdaShiny',
    accent: 'text-shiny',
    art: <Sparkle className="h-full w-full text-shiny" />,
  },
  {
    key: 'hundo',
    label: 'Hundos',
    lambdaKey: 'lambdaHundo',
    accent: 'text-hundo',
    art: <PerfectIV className="h-full w-full text-hundo" />,
  },
  {
    key: 'shundo',
    label: 'Shundos',
    lambdaKey: 'lambdaShundo',
    accent: 'text-shundo',
    art: <ShundoMark className="h-full w-full text-shundo" />,
  },
];

/** Build the luck assessment for one metric, or null if nothing observed. */
export function luckFor(
  bundle: ScenarioBundle,
  inputs: ModelInputs,
  metric: Metric,
): LuckRange | null {
  const observed = inputs.observed[metric];
  if (observed === undefined || !Number.isFinite(observed)) return null;
  return assessLuckRange(
    {
      low: bundle.low.trials[metric],
      mid: bundle.mid.trials[metric],
      high: bundle.high.trials[metric],
    },
    observed,
  );
}

/**
 * One-line percentile summary for the headline cards.
 *
 * The luck verdict is deliberately withheld for hundos. Your hundo tally only
 * contains the ones you still hold AND have appraised, so it is a systematic
 * undercount of what the model predicts — calling a low hundo percentile
 * "unlucky" would contradict the very explanation shown underneath it.
 */
export function LuckLine({ luck, metric }: { luck: LuckRange; metric?: Metric }) {
  if (luck.outOfBand) {
    return (
      <span className="text-rose-300">
        outside the 1st–99th percentile — likely a rate problem
      </span>
    );
  }
  if (luck.tooUncertain) {
    // Deliberately no point estimate: at this width it would be invented.
    const useless = luck.percentileLow < 2 && luck.percentileHigh > 98;
    return (
      <span className="text-amber-200">
        {useless ? (
          <>the rate estimates can&rsquo;t place this at all</>
        ) : (
          <>
            somewhere between the {ordinal(luck.percentileLow)} and{' '}
            {ordinal(luck.percentileHigh)} percentile
          </>
        )}
        <span className="ml-1 text-muted">— rates too uncertain to say more</span>
      </span>
    );
  }
  const below = luck.percentileHigh < 40;
  const above = luck.percentileLow > 60;
  const verdict =
    metric === 'hundo'
      ? below
        ? 'below the model — expected, see below'
        : above
          ? 'above the model'
          : 'matches the model'
      : below
        ? 'unlucky'
        : above
          ? 'lucky'
          : 'about par';
  return (
    <span className="text-slate-300">
      {ordinal(luck.percentileLow)}–{ordinal(luck.percentileHigh)} percentile
      <span className="ml-1.5 text-muted">{verdict}</span>
    </span>
  );
}

/**
 * Reverse mode. Strictly read-only against the forward model: it never writes
 * back to the medal counts, the rate config or the assumptions.
 */
export function LuckPanel({
  bundle,
  inputs,
}: {
  bundle: ScenarioBundle;
  inputs: ModelInputs;
}) {
  const anyObserved = METRICS.some((m) => inputs.observed[m.key] !== undefined);

  return (
    <Panel
      title="How lucky have you been?"
      subtitle="Fill in the “I have” boxes on the cards above. Read-only — this never changes your medal numbers or the rates."
    >
      {!anyObserved ? (
        <p className="text-xs leading-relaxed text-muted">
          Nothing entered yet. Count your shinies, hundos and shundos in-game and type them into
          the cards at the top of the page.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {METRICS.map((m) => {
            const luck = luckFor(bundle, inputs, m.key);
            if (!luck) return null;
            return (
              <LuckDetail
                key={m.key}
                label={m.label}
                accent={m.accent}
                luck={luck}
                predicted={bundle.mid[m.lambdaKey]}
                metric={m.key}
                encounters={bundle.mid.trials[m.key].reduce((a, t) => a + t.n, 0)}
              />
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function LuckDetail({
  label,
  accent,
  luck,
  predicted,
  metric,
  encounters,
}: {
  label: string;
  accent: string;
  luck: LuckRange;
  predicted: number;
  metric: Metric;
  /** Total Bernoulli trials behind this metric, for converting λ to a rate. */
  encounters: number;
}) {
  const ratio = luck.lambdaRatio;
  const ratioKnown = Number.isFinite(ratio) && ratio > 0;

  return (
    <div className="rounded-xl border border-edge/70 bg-panel2/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`text-sm font-medium ${accent}`}>
          {luck.observed.toLocaleString()} {label.toLowerCase()}
        </span>
        <span className="text-[11px] text-muted">
          model predicted <span className="tabular-nums text-slate-300">{fmtLambda(predicted)}</span>
        </span>
      </div>

      <div className="mt-1.5 text-xs">
        <LuckLine luck={luck} metric={metric} />
      </div>

      {luck.outOfBand ? (
        <Callout tone="error" title="This is a calibration warning, not a brag">
          Your {label.toLowerCase()} count falls outside the 1st–99th percentile under{' '}
          <em>every</em> rate scenario. When a model is this far off, the overwhelmingly likely
          explanation is that one of its rate assumptions is wrong — not that you got
          astronomically {luck.direction === 'above' ? 'lucky' : 'unlucky'}. Reporting a
          percentile here would be false precision, so the app declines to.
          {ratioKnown && (
            <>
              {' '}
              For this to be an ordinary result, the true blended rate would have to be{' '}
              <strong>{ratio.toFixed(2)}×</strong> what is configured.
            </>
          )}
        </Callout>
      ) : (
        <>
          {luck.tooUncertain && (
            <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-100">
              The rate estimates alone move this percentile by{' '}
              {Math.round(luck.spread)} points — more than the{' '}
              {UNCERTAIN_SPREAD_POINTS}-point limit — so no point estimate is shown. The honest
              answer is the range.
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] tabular-nums">
            <div className="rounded-lg bg-ink/40 px-2 py-1.5">
              <div className="text-muted">P(you have this many or fewer)</div>
              <div className="mt-0.5 text-slate-200">
                {fmtPercent(luck.byScenario.mid.pAtMost, 1)}
              </div>
            </div>
            <div className="rounded-lg bg-ink/40 px-2 py-1.5">
              <div className="text-muted">P(this many or more)</div>
              <div className="mt-0.5 text-slate-200">
                {fmtPercent(luck.byScenario.mid.pAtLeast, 1)}
              </div>
            </div>
          </div>
        </>
      )}

      {ratioKnown && (
        <p className="mt-2 border-t border-edge/60 pt-2 text-[11px] leading-relaxed text-muted">
          <span className="text-slate-400">Inverse check:</span> your count would be the exact
          median if the model expected{' '}
          <span className="tabular-nums text-slate-300">{fmtLambda(luck.impliedLambda)}</span>{' '}
          instead of {fmtLambda(predicted)} — a{' '}
          <span className="text-slate-300">{ratio.toFixed(2)}×</span> difference.
          {metric === 'shiny' &&
            (() => {
              const rates = blendedRates(luck.byScenario.mid.lambda, ratio, encounters);
              if (!rates) return null;
              return (
                <>
                  {' '}
                  If your medal counts are right, your true blended shiny rate would have to be{' '}
                  <span className="text-slate-300">{rates.implied}</span> rather than the
                  configured <span className="text-slate-300">{rates.configured}</span>.
                  Comparing those two is the real diagnostic — it tells you whether the model or
                  your luck is the outlier.
                </>
              );
            })()}
          {metric === 'hundo' && (
            <>
              {' '}
              IV floors are exact, so a ratio far from 1.00 points at the counts, not at a rate.
              {ratio < 0.95 && (
                <>
                  {' '}
                  <span className="text-slate-300">
                    Below 1.00 is expected, and does not mean you were unlucky.
                  </span>{' '}
                  The model counts hundos you <em>encountered</em>; you can only count the ones
                  you still have and have appraised. Anything transferred before you checked it,
                  or never appraised at all, is invisible to your tally but not to the model.
                  Champion, Hero and Pokémon Ranger also count battles won and tasks completed
                  rather than Pokémon caught, which pushes the prediction up further.
                </>
              )}
              {ratio >= 0.95 && ratio <= 1.05 && <> The model and your collection agree.</>}
              {ratio > 1.05 && (
                <>
                  {' '}
                  Above 1.00 is the surprising direction — the usual suspects (un-appraised or
                  transferred Pokémon) all push the other way. Worth checking your weather-boosted
                  and lucky-trade assumptions, which drive hundos hardest.
                </>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * λ = encounters × blended per-encounter rate, so scaling λ scales the rate.
 * Returns [configured, implied] as "1 in N" strings.
 */
function blendedRates(
  lambda: number,
  ratio: number,
  encounters: number,
): { configured: string; implied: string } | null {
  if (!(encounters > 0) || !(lambda > 0)) return null;
  return {
    configured: fmtOneIn(lambda / encounters),
    implied: fmtOneIn((lambda * ratio) / encounters),
  };
}
