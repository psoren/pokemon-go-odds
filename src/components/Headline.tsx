import type { ReactNode } from 'react';
import type { ScenarioBundle } from '../model/forward';
import { fmtLambda, fmtRange } from '../lib/format';
import { PerfectIV, ShundoMark, Sparkle } from './art';
import { LuckLine, luckFor } from './LuckPanel';
import { NumberField } from './ui';
import type { Metric as ModelMetric, ModelInputs } from '../model/types';

type Metric = 'lambdaShiny' | 'lambdaHundo' | 'lambdaShundo';

const CARDS: {
  key: Metric;
  metric: ModelMetric;
  label: string;
  blurb: string;
  accent: string;
  glow: string;
  art: ReactNode;
}[] = [
  {
    key: 'lambdaShiny',
    metric: 'shiny',
    label: 'Shinies',
    blurb: 'Different colour, same stats',
    accent: 'text-shiny',
    glow: 'from-amber-400/20',
    art: <Sparkle className="h-full w-full text-shiny" />,
  },
  {
    key: 'lambdaHundo',
    metric: 'hundo',
    label: 'Hundos',
    blurb: 'Perfect 15/15/15 stats',
    accent: 'text-hundo',
    glow: 'from-sky-400/20',
    art: <PerfectIV className="h-full w-full text-hundo" />,
  },
  {
    key: 'lambdaShundo',
    metric: 'shundo',
    label: 'Shundos',
    blurb: 'Shiny and perfect at once',
    accent: 'text-shundo',
    glow: 'from-violet-400/25',
    art: <ShundoMark className="h-full w-full text-shundo" />,
  },
];

/**
 * The headline numbers. Range first, point estimate second — the rates feeding
 * this are community guesses and the display should not imply otherwise.
 */
export function Headline({
  bundle,
  inputs,
  setInputs,
}: {
  bundle: ScenarioBundle;
  inputs: ModelInputs;
  setInputs: (updater: (prev: ModelInputs) => ModelInputs) => void;
}) {
  const setObserved = (metric: ModelMetric, n: number | undefined) =>
    setInputs((prev) => {
      const observed = { ...prev.observed };
      if (n === undefined) delete observed[metric];
      else observed[metric] = n;
      return { ...prev, observed };
    });

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {CARDS.map((card) => {
        const lo = bundle.low[card.key];
        const mid = bundle.mid[card.key];
        const hi = bundle.high[card.key];
        const luck = luckFor(bundle, inputs, card.metric);
        return (
          <div
            key={card.key}
            className="relative overflow-hidden rounded-2xl border border-edge/70 bg-panel/70 px-5 py-4 shadow-lg shadow-black/20"
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glow} to-transparent`}
            />
            <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 opacity-[0.16]">
              {card.art}
            </div>
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4">{card.art}</span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
                  {card.label}
                </span>
              </div>
              <div className={`mt-1.5 text-3xl font-semibold tabular-nums ${card.accent}`}>
                {fmtRange(lo, hi)}
              </div>
              <div className="mt-1 text-xs text-muted">
                {mid === 0 ? (
                  <>waiting on your medal counts</>
                ) : lo === hi ? (
                  <>exact — no estimated rate affects this</>
                ) : (
                  <>
                    best guess{' '}
                    <span className="tabular-nums text-slate-300">{fmtLambda(mid)}</span>
                  </>
                )}
              </div>
              <div className="mt-2 border-t border-edge/50 pt-2">
                <label className="flex items-center gap-2">
                  <span className="text-[11px] whitespace-nowrap text-muted">I have</span>
                  <NumberField
                    ariaLabel={`Observed ${card.label}`}
                    value={inputs.observed[card.metric]}
                    onChange={(n) => setObserved(card.metric, n)}
                    placeholder="?"
                    className="w-20 py-1"
                  />
                  {!luck && (
                    <span className="text-[11px] leading-tight text-muted">
                      to see your percentile
                    </span>
                  )}
                </label>
                <div className="mt-1.5 text-[11px] leading-snug">
                  {luck ? <LuckLine luck={luck} metric={card.metric} /> : <span className="text-muted">{card.blurb}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
