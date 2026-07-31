import { useState } from 'react';
import type { ModelOutput } from '../model/types';
import { fmtLambda, fmtPercent } from '../lib/format';
import { Panel } from './ui';

type Metric = 'lambdaShundo' | 'lambdaShiny' | 'lambdaHundo';

const METRICS: { key: Metric; label: string; bar: string }[] = [
  { key: 'lambdaShundo', label: 'Shundos', bar: 'bg-shundo' },
  { key: 'lambdaHundo', label: 'Hundos', bar: 'bg-hundo' },
  { key: 'lambdaShiny', label: 'Shinies', bar: 'bg-shiny' },
];

/**
 * The headline insight: a handful of raids and lucky trades usually out-produce
 * tens of thousands of wild catches. Sorted descending, bars scaled to the top
 * contributor.
 */
export function ContributionChart({ model }: { model: ModelOutput }) {
  const [metric, setMetric] = useState<Metric>('lambdaShundo');
  const active = METRICS.find((m) => m.key === metric)!;

  const rows = model.sources
    .map((r) => ({ label: r.def.label.replace(/^…of which /, ''), value: r[metric], def: r.def }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((a, r) => a + r.value, 0);
  const max = rows.length > 0 ? rows[0].value : 0;

  return (
    <Panel
      title="Where your rarities actually come from"
      subtitle={`Each source's share of expected ${active.label.toLowerCase()}, largest first. Evaluated at the mid rate estimate.`}
      right={
        <div className="flex shrink-0 rounded-lg border border-edge p-0.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                metric === m.key ? 'bg-panel2 text-slate-100' : 'text-muted hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Enter some counts on the left to see contributions.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.def.id} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3">
              <div className="truncate text-xs text-slate-300" title={r.label}>
                {r.label}
              </div>
              <div className="h-5 overflow-hidden rounded-md bg-ink/60">
                <div
                  className={`h-full rounded-md ${active.bar} transition-[width] duration-300`}
                  style={{ width: `${max > 0 ? Math.max(1.5, (r.value / max) * 100) : 0}%` }}
                />
              </div>
              <div className="w-28 text-right text-xs tabular-nums text-slate-300">
                {fmtLambda(r.value)}
                <span className="ml-1.5 text-muted">{fmtPercent(r.value / total, 1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
