import type { ScenarioBundle } from '../model/forward';
import type { Scenario } from '../model/types';
import { fmtLambda, fmtPercent } from '../lib/format';
import { Panel } from './ui';

const METRICS = [
  { key: 'lambdaShiny', label: 'Shinies', accent: 'text-shiny' },
  { key: 'lambdaHundo', label: 'Hundos', accent: 'text-hundo' },
  { key: 'lambdaShundo', label: 'Shundos', accent: 'text-shundo' },
] as const;

const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: 'low', label: 'Low (rates rarest)' },
  { key: 'mid', label: 'Mid (point estimate)' },
  { key: 'high', label: 'High (rates commonest)' },
];

/**
 * Recomputes the whole model at the low and high ends of every rate band.
 *
 * This is a deliberately CONSERVATIVE range: it moves every rate to the same
 * end at once, which assumes the community estimates are wrong in a correlated
 * direction. Independent errors would give a tighter band — but we do not know
 * that they are independent, so the wide version is the honest one.
 */
export function SensitivityView({ bundle }: { bundle: ScenarioBundle }) {
  const spreadRows = bundle.mid.sources
    .map((mid) => {
      const lo = bundle.low.sources.find((s) => s.def.id === mid.def.id)!;
      const hi = bundle.high.sources.find((s) => s.def.id === mid.def.id)!;
      return {
        def: mid.def,
        spread: hi.lambdaShundo - lo.lambdaShundo,
      };
    })
    .filter((r) => r.spread > 0)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 5);

  const totalSpread = spreadRows.reduce((a, r) => a + r.spread, 0);

  return (
    <Panel
      title="Sensitivity to the rate estimates"
      subtitle="The same inputs run at the low and high end of every rate band at once. If two rows are far apart, the answer is the range — not the middle of it."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-xs tabular-nums">
          <thead>
            <tr className="border-b border-edge text-[10px] uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 text-left font-medium">Scenario</th>
              {METRICS.map((m) => (
                <th key={m.key} className={`py-2 px-2 text-right font-medium ${m.accent}`}>
                  {m.label}
                </th>
              ))}
              <th className="py-2 pl-2 text-right font-medium">P(0 shundos)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/40">
            {SCENARIOS.map((s) => (
              <tr key={s.key} className={s.key === 'mid' ? 'text-slate-200' : 'text-slate-400'}>
                <td className="py-2 pr-3 text-left">{s.label}</td>
                {METRICS.map((m) => (
                  <td key={m.key} className="py-2 px-2 text-right">
                    {fmtLambda(bundle[s.key][m.key])}
                  </td>
                ))}
                <td className="py-2 pl-2 text-right">
                  {fmtPercent(bundle[s.key].shundo.exact[0])}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-edge text-slate-100">
              <td className="py-2 pr-3 text-left font-semibold">Spread (high ÷ low)</td>
              {METRICS.map((m) => {
                const lo = bundle.low[m.key];
                const hi = bundle.high[m.key];
                return (
                  <td key={m.key} className="py-2 px-2 text-right">
                    {lo > 0 ? `${(hi / lo).toFixed(2)}×` : '—'}
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {spreadRows.length > 0 && (
        <div className="mt-4 border-t border-edge/60 pt-3">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            What drives the shundo uncertainty
          </h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {spreadRows.map((r) => (
              <div key={r.def.id} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-xs text-slate-300" title={r.def.label}>
                  {r.def.label.replace(/^…of which /, '')}
                </span>
                <span className="h-4 overflow-hidden rounded bg-ink/60">
                  <span
                    className="block h-full rounded bg-amber-400/70"
                    style={{ width: `${(r.spread / spreadRows[0].spread) * 100}%` }}
                  />
                </span>
                <span className="w-24 text-right text-xs tabular-nums text-muted">
                  ±{fmtLambda(r.spread / 2)}
                  <span className="ml-1.5">{fmtPercent(r.spread / totalSpread, 0)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Width of each source's shundo band. Tightening the top row's rate estimate buys more
            accuracy than tightening everything below it combined.
          </p>
        </div>
      )}
    </Panel>
  );
}
