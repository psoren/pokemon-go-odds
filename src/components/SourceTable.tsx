import type { ModelOutput } from '../model/types';
import { fmtInt, fmtLambda, fmtOneIn } from '../lib/format';
import { Panel } from './ui';

/**
 * Per-source λ breakdown. Shadows get a dedicated purification column, because
 * they cannot be traded and purification is their only route to a hundo upgrade.
 */
export function SourceTable({ model }: { model: ModelOutput }) {
  const rows = model.sources.filter(
    (r) => r.effectiveCount > 0 && r.def.kind !== 'reference',
  );
  const purified = model.purifiedFraction;

  return (
    <Panel
      title="λ per source"
      subtitle="Expected counts at the mid rate estimate. Counts shown are after subset subtraction."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing entered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-xs tabular-nums">
            <thead>
              <tr className="border-b border-edge text-[10px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 text-left font-medium">Source</th>
                <th className="py-2 px-2 text-right font-medium">Count</th>
                <th className="py-2 px-2 text-right font-medium">Floor</th>
                <th className="py-2 px-2 text-right font-medium">Shiny rate</th>
                <th className="py-2 px-2 text-right font-medium text-shiny">λ shiny</th>
                <th className="py-2 px-2 text-right font-medium text-hundo">λ hundo</th>
                <th className="py-2 px-2 text-right font-medium text-violet-300">
                  λ hundo (purified)
                </th>
                <th className="py-2 pl-2 text-right font-medium text-shundo">λ shundo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {rows.map((r) => (
                <tr key={r.def.id} className="text-slate-300">
                  <td className="py-1.5 pr-3 text-left">
                    <span className="text-slate-200">{r.def.label.replace(/^…of which /, '')}</span>
                    {r.def.kind === 'trade' && (
                      <span className="ml-2 rounded border border-amber-500/40 px-1 text-[9px] uppercase text-amber-300">
                        re-roll
                      </span>
                    )}
                    {r.def.kind === 'shadow' && (
                      <span className="ml-2 rounded border border-violet-500/40 px-1 text-[9px] uppercase text-violet-300">
                        no trade
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    {fmtInt(r.effectiveCount)}
                    {r.effectiveCount !== r.rawCount && (
                      <span className="ml-1 text-muted" title={`entered ${fmtInt(r.rawCount)}`}>
                        ({fmtInt(r.rawCount)})
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right text-muted">{r.ivFloor}</td>
                  <td className="py-1.5 px-2 text-right text-muted">
                    {r.def.kind === 'trade' ? '—' : fmtOneIn(r.shinyP)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-shiny">
                    {r.def.kind === 'trade' ? '0' : fmtLambda(r.lambdaShiny)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-hundo">
                    {fmtLambda(r.lambdaHundoAsCaught)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right ${
                      r.def.kind === 'shadow' ? 'text-violet-300/80' : 'text-edge'
                    }`}
                  >
                    {r.def.kind === 'shadow' ? fmtLambda(r.lambdaHundoPurified) : '—'}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-shundo">{fmtLambda(r.lambdaShundo)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-edge font-semibold text-slate-100">
                <td className="py-2 pr-3 text-left">Total</td>
                <td className="py-2 px-2 text-right">
                  {fmtInt(rows.reduce((a, r) => a + r.effectiveCount, 0))}
                </td>
                <td />
                <td />
                <td className="py-2 px-2 text-right text-shiny">{fmtLambda(model.lambdaShiny)}</td>
                <td className="py-2 px-2 text-right text-hundo">
                  {fmtLambda(rows.reduce((a, r) => a + r.lambdaHundoAsCaught, 0))}
                </td>
                <td className="py-2 px-2 text-right text-violet-200">
                  {fmtLambda(
                    rows
                      .filter((r) => r.def.kind === 'shadow')
                      .reduce((a, r) => a + r.lambdaHundoPurified, 0),
                  )}
                </td>
                <td className="py-2 pl-2 text-right text-shundo">{fmtLambda(model.lambdaShundo)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Shadows cannot be traded, so their only IV upgrade is purification (+2 per stat, capped at
        15) — a shadow needs 13/13/13 or better to purify into a hundo, which is 27× better odds.
        The two shadow columns are the pure endpoints: caught-and-kept versus caught-and-purified.{' '}
        {purified > 0
          ? `Your Purifier medal puts ${(purified * 100).toFixed(0)}% of your shadows on the purified path, and the λ hundo and λ shundo columns blend the two accordingly.`
          : 'Enter your Purifier medal to blend the two — with it at zero, every shadow is counted as caught and kept.'}
      </p>
    </Panel>
  );
}
