import type { ScenarioBundle } from '../model/forward';
import { fmtLambda, fmtRange } from '../lib/format';

type Metric = 'lambdaShiny' | 'lambdaHundo' | 'lambdaShundo';

const CARDS: { key: Metric; label: string; blurb: string; accent: string }[] = [
  {
    key: 'lambdaShiny',
    label: 'Shinies',
    blurb: 'Expected shiny encounters across every source',
    accent: 'text-shiny',
  },
  {
    key: 'lambdaHundo',
    label: 'Hundos',
    blurb: 'Expected 15/15/15 Pokémon, including trade re-rolls',
    accent: 'text-hundo',
  },
  {
    key: 'lambdaShundo',
    label: 'Shundos',
    blurb: 'Shiny AND perfect — the intersection of two independent rolls',
    accent: 'text-shundo',
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
        const exact = lo === hi;
        return (
          <div
            key={card.key}
            className="rounded-2xl border border-edge/70 bg-panel/70 px-4 py-4 shadow-lg shadow-black/20"
          >
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
              {card.label}
            </div>
            <div className={`mt-1 text-3xl font-semibold tabular-nums ${card.accent}`}>
              {fmtRange(lo, hi)}
            </div>
            <div className="mt-1 text-xs text-muted">
              {mid === 0 ? (
                <>waiting on your medal counts</>
              ) : exact ? (
                <>exact — IV floors are known mechanics, not estimates</>
              ) : (
                <>
                  point estimate <span className="tabular-nums text-slate-300">{fmtLambda(mid)}</span>
                </>
              )}
            </div>
            <div className="mt-2 border-t border-edge/50 pt-2 text-[11px] leading-relaxed text-muted">
              {card.blurb}
            </div>
          </div>
        );
      })}
    </div>
  );
}
