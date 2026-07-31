import type { ReactNode } from 'react';
import type { ScenarioBundle } from '../model/forward';
import { fmtLambda, fmtRange } from '../lib/format';
import { PerfectIV, ShundoMark, Sparkle } from './art';

type Metric = 'lambdaShiny' | 'lambdaHundo' | 'lambdaShundo';

const CARDS: {
  key: Metric;
  label: string;
  blurb: string;
  accent: string;
  glow: string;
  art: ReactNode;
}[] = [
  {
    key: 'lambdaShiny',
    label: 'Shinies',
    blurb: 'Different colour, same stats',
    accent: 'text-shiny',
    glow: 'from-amber-400/20',
    art: <Sparkle className="h-full w-full text-shiny" />,
  },
  {
    key: 'lambdaHundo',
    label: 'Hundos',
    blurb: 'Perfect 15/15/15 stats',
    accent: 'text-hundo',
    glow: 'from-sky-400/20',
    art: <PerfectIV className="h-full w-full text-hundo" />,
  },
  {
    key: 'lambdaShundo',
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
export function Headline({ bundle }: { bundle: ScenarioBundle }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {CARDS.map((card) => {
        const lo = bundle.low[card.key];
        const mid = bundle.mid[card.key];
        const hi = bundle.high[card.key];
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
              <div className="mt-2 border-t border-edge/50 pt-2 text-[11px] text-muted">
                {card.blurb}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
