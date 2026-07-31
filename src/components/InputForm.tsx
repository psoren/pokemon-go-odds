import { useState } from 'react';
import { CATEGORIES, SOURCES } from '../config/rates';
import { effectiveFloor } from '../model/forward';
import type { ModelInputs, Scenario, SourceDef, ValidationIssue } from '../model/types';
import { fmtOneIn, toDenominator } from '../lib/format';
import { hundoProbability, purifiedHundoProbability } from '../model/math';
import { Callout, ConfidenceBadge, NumberField, Panel } from './ui';

interface Props {
  inputs: ModelInputs;
  setInputs: (updater: (prev: ModelInputs) => ModelInputs) => void;
  issues: ValidationIssue[];
}

const SCENARIOS: Scenario[] = ['low', 'mid', 'high'];

export function InputForm({ inputs, setInputs, issues }: Props) {
  const setCount = (id: string, n: number | undefined) =>
    setInputs((prev) => ({ ...prev, counts: { ...prev.counts, [id]: n ?? 0 } }));

  const setOverride = (id: string, key: Scenario | 'ivFloor', n: number | undefined) =>
    setInputs((prev) => {
      const next = { ...(prev.overrides[id] ?? {}) };
      if (n === undefined) delete next[key];
      else next[key] = n;
      const overrides = { ...prev.overrides };
      if (Object.keys(next).length === 0) delete overrides[id];
      else overrides[id] = next;
      return { ...prev, overrides };
    });

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="warn" title="Trades are re-rolls, not new Pokémon">
        A traded Pokémon was already counted at whatever source you caught it from. Trading
        re-rolls its <strong>IVs only</strong> — it does not re-roll shininess and it does not
        create a new Pokémon. So the trade fields below ask for the number of{' '}
        <strong>shiny Pokémon you traded</strong>, and they contribute to your hundo/shundo
        expectations without adding a single shiny to the count.
      </Callout>

      {issues.map((issue) => (
        <Callout key={issue.sourceId} tone="error" title="Double-counted catches">
          {issue.message}
        </Callout>
      ))}

      {CATEGORIES.map((category) => (
        <Panel key={category} title={category}>
          <div className="flex flex-col divide-y divide-edge/40">
            {SOURCES.filter((s) => s.category === category).map((def) => (
              <SourceRow
                key={def.id}
                def={def}
                inputs={inputs}
                setCount={setCount}
                setOverride={setOverride}
              />
            ))}
          </div>
        </Panel>
      ))}

      <Panel title="Model options">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={inputs.assumePurified}
            onChange={(e) =>
              setInputs((prev) => ({ ...prev, assumePurified: e.target.checked }))
            }
            className="mt-1 size-4 accent-violet-400"
          />
          <span>
            <span className="font-medium text-slate-100">Count shadows as purified</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              Purification adds +2 to each IV (capped at 15), so a shadow only needs 13/13/13 to
              purify into a hundo — 27× better odds. Off by default, because a purified shadow is
              no longer a shadow. Either way the per-source table shows both paths.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => {
            if (confirm('Clear all counts and rate overrides?')) {
              setInputs(() => ({ counts: {}, overrides: {}, assumePurified: false }));
            }
          }}
          className="mt-4 rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:border-rose-500/50 hover:text-rose-200"
        >
          Reset everything
        </button>
      </Panel>
    </div>
  );
}

function SourceRow({
  def,
  inputs,
  setCount,
  setOverride,
}: {
  def: SourceDef;
  inputs: ModelInputs;
  setCount: (id: string, n: number | undefined) => void;
  setOverride: (id: string, key: Scenario | 'ivFloor', n: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const override = inputs.overrides[def.id];
  const isOverridden = override !== undefined && Object.keys(override).length > 0;
  const floor = effectiveFloor(def, inputs);
  const count = inputs.counts[def.id];

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug text-slate-200" title={def.label}>
            {def.subsetOf && <span className="mr-1 text-muted">↳</span>}
            {def.label}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
            <span>floor {floor}</span>
            <span className="text-edge">·</span>
            <span>hundo {fmtOneIn(hundoProbability(floor))}</span>
            {def.kind === 'shadow' && (
              <>
                <span className="text-edge">·</span>
                <span className="text-violet-300">
                  purified {fmtOneIn(purifiedHundoProbability(floor))}
                </span>
              </>
            )}
            {def.kind === 'trade' && (
              <>
                <span className="text-edge">·</span>
                <span className="text-amber-300">shiny count unaffected</span>
              </>
            )}
          </div>
        </div>
        <NumberField
          ariaLabel={def.label}
          value={count}
          onChange={(n) => setCount(def.id, n)}
          placeholder="0"
          className="w-28"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`shrink-0 rounded-lg border px-2 py-1.5 text-[11px] transition ${
            isOverridden
              ? 'border-violet-500/60 bg-violet-500/10 text-violet-200'
              : 'border-edge text-muted hover:border-sky-400/50 hover:text-sky-200'
          }`}
          title="Edit the rate estimates and IV floor for this source"
        >
          {isOverridden ? 'edited' : 'rate'} {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-edge/70 bg-panel2/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <ConfidenceBadge level={def.confidence} />
            <span className="text-[11px] text-muted">{def.kind} source</span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted">{def.note}</p>

          {def.shinyRate ? (
            <div className="grid grid-cols-3 gap-2">
              {SCENARIOS.map((s) => (
                <label key={s} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {s === 'low' ? 'low (rarest)' : s === 'high' ? 'high (commonest)' : 'mid'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[11px] text-muted">1 in</span>
                    <NumberField
                      ariaLabel={`${def.label} ${s} shiny rate denominator`}
                      value={
                        override?.[s] !== undefined
                          ? Number(toDenominator(override[s]!))
                          : Number(toDenominator(def.shinyRate![s]))
                      }
                      onChange={(n) =>
                        setOverride(def.id, s, n === undefined || n <= 0 ? undefined : 1 / n)
                      }
                      className="w-full"
                    />
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted">
              No shiny rate: this source re-rolls IVs on an already-shiny Pokémon.
            </p>
          )}

          <label className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted">IV floor</span>
            <NumberField
              ariaLabel={`${def.label} IV floor`}
              value={floor}
              onChange={(n) =>
                setOverride(
                  def.id,
                  'ivFloor',
                  n === undefined ? undefined : Math.min(15, Math.max(0, Math.round(n))),
                )
              }
              className="w-16"
            />
            <span className="text-[11px] text-muted">
              (game mechanic, not an estimate — default {def.ivFloor})
            </span>
          </label>

          <p className="mt-3 border-t border-edge/60 pt-2 text-[10px] leading-relaxed text-muted">
            <span className="font-medium text-slate-400">Source:</span> {def.citation}
          </p>

          {isOverridden && (
            <button
              type="button"
              onClick={() => {
                SCENARIOS.forEach((s) => setOverride(def.id, s, undefined));
                setOverride(def.id, 'ivFloor', undefined);
              }}
              className="mt-2 text-[11px] text-muted underline underline-offset-2 hover:text-slate-200"
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}
