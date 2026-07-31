import { MAX_K } from '../model/forward';
import { DIVERGENCE_THRESHOLD } from '../model/math';
import type { Distribution, ModelOutput } from '../model/types';
import { fmtLambda, fmtPercent } from '../lib/format';
import { Callout, Panel } from './ui';

const TABS: { key: 'shiny' | 'hundo' | 'shundo'; label: string; accent: string }[] = [
  { key: 'shiny', label: 'Shiny', accent: 'text-shiny' },
  { key: 'hundo', label: 'Hundo', accent: 'text-hundo' },
  { key: 'shundo', label: 'Shundo', accent: 'text-shundo' },
];

/**
 * P(k) for k = 0..6, computed two ways: the Poisson approximation and the exact
 * Poisson-binomial DP convolution over sources. They are shown side by side
 * precisely so a disagreement is visible rather than hidden.
 */
export function DistributionTables({ model }: { model: ModelOutput }) {
  const anyDiverges = TABS.some((t) => model[t.key].diverges);

  return (
    <Panel
      title="Probability of exactly k"
      subtitle="Poisson approximation vs the exact Poisson-binomial convolution. Identical numbers are the expected outcome — every individual probability in this model is tiny."
    >
      {anyDiverges && (
        <div className="mb-3">
          <Callout tone="warn" title="Poisson approximation is off here">
            At least one distribution disagrees with the exact convolution by more than{' '}
            {fmtPercent(DIVERGENCE_THRESHOLD, 0)} on some k. That happens when a single source
            carries a large per-Pokémon probability, which breaks the rare-event assumption behind
            the Poisson approximation. <strong>Trust the exact column.</strong>
          </Callout>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {TABS.map((tab) => (
          <DistributionTable
            key={tab.key}
            title={tab.label}
            accent={tab.accent}
            dist={model[tab.key]}
          />
        ))}
      </div>
    </Panel>
  );
}

function DistributionTable({
  title,
  accent,
  dist,
}: {
  title: string;
  accent: string;
  dist: Distribution;
}) {
  return (
    <div className="rounded-xl border border-edge/70 bg-panel2/40 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${accent}`}>{title}</span>
        <span className="text-[11px] text-muted">
          λ = <span className="tabular-nums text-slate-300">{fmtLambda(dist.lambda)}</span>
        </span>
      </div>
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="text-muted">
            <th className="pb-1 text-left font-medium">k</th>
            <th className="pb-1 text-right font-medium">Poisson</th>
            <th className="pb-1 text-right font-medium" title="Exact Poisson-binomial DP">
              Exact
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge/40">
          {Array.from({ length: MAX_K + 1 }, (_, k) => {
            const delta = Math.abs(dist.poisson[k] - dist.exact[k]);
            return (
              <tr key={k}>
                <td className="py-1 text-left text-slate-400">{k}</td>
                <td className="py-1 text-right text-muted">{fmtPercent(dist.poisson[k])}</td>
                <td
                  className={`py-1 text-right ${
                    delta > DIVERGENCE_THRESHOLD ? 'text-amber-300' : 'text-slate-200'
                  }`}
                >
                  {fmtPercent(dist.exact[k])}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-edge">
            <td className="py-1 text-left text-slate-400">7+</td>
            <td className="py-1 text-right text-muted">
              {fmtPercent(Math.max(0, 1 - dist.poisson.reduce((a, b) => a + b, 0)))}
            </td>
            <td className="py-1 text-right text-slate-200">{fmtPercent(dist.tail)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        max |Poisson − exact| = {fmtPercent(dist.maxAbsDivergence, 3)}
      </p>
    </div>
  );
}
