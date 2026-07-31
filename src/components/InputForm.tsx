import { useState } from 'react';
import { CATEGORIES, SOURCES, SOURCES_BY_ID, depthOf } from '../config/rates';
import { TIERS, TIER_STYLE } from '../config/medals';
import { effectiveFloor } from '../model/forward';
import type { ModelInputs, Scenario, SourceDef, ValidationIssue } from '../model/types';
import { fmtInt, fmtOneIn, toDenominator } from '../lib/format';
import { hundoProbability, purifiedHundoProbability } from '../model/math';
import { Callout, ConfidenceBadge, NumberField, Panel } from './ui';

interface Props {
  inputs: ModelInputs;
  setInputs: (updater: (prev: ModelInputs) => ModelInputs) => void;
  issues: ValidationIssue[];
}

const SCENARIOS: Scenario[] = ['low', 'mid', 'high'];

/** Indentation depth within a category, so the shallowest row sits flush left. */
function localDepths(category: string): Record<string, number> {
  const inCat = SOURCES.filter((s) => s.category === category);
  const base = Math.min(...inCat.map((s) => depthOf(s.id)));
  return Object.fromEntries(inCat.map((s) => [s.id, depthOf(s.id) - base]));
}

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
      <Callout tone="info" title="Every count comes from your Medals screen">
        Open Pokémon GO → tap your trainer avatar → scroll to <strong>Medals</strong>. Each field
        below names the medal it comes from, and the medal screen shows your exact progress
        (“47,312 / 50,000”), not just the tier. A few things have no medal at all — those are
        marked, and you will have to estimate them.
      </Callout>

      <Callout tone="warn" title="Trades are re-rolls, not new Pokémon">
        A traded Pokémon was already counted at whatever source you caught it from. Trading
        re-rolls its <strong>IVs only</strong> — it does not re-roll shininess and it does not
        create a new Pokémon. So the trade fields ask for the number of{' '}
        <strong>shiny Pokémon you traded</strong>, and they contribute to your hundo/shundo
        expectations without adding a single shiny to the count.
      </Callout>

      {issues.map((issue) => (
        <Callout key={issue.sourceId} tone="error" title="Subsets exceed their parent medal">
          {issue.message}
        </Callout>
      ))}

      {CATEGORIES.map((category) => {
        const depths = localDepths(category);
        return (
          <Panel key={category} title={category}>
            <div className="flex flex-col divide-y divide-edge/40">
              {SOURCES.filter((s) => s.category === category).map((def) => (
                <SourceRow
                  key={def.id}
                  def={def}
                  depth={depths[def.id]}
                  inputs={inputs}
                  setCount={setCount}
                  setOverride={setOverride}
                />
              ))}
            </div>
          </Panel>
        );
      })}

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
              no longer a shadow. Your <strong>Purifier</strong> medal (“Purify ___ Shadow
              Pokémon”, platinum at 1,000) tells you how many you have actually purified; if that
              is a small fraction of your Hero total, leave this off. Either way the per-source
              table shows both paths.
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
  depth,
  inputs,
  setCount,
  setOverride,
}: {
  def: SourceDef;
  depth: number;
  inputs: ModelInputs;
  setCount: (id: string, n: number | undefined) => void;
  setOverride: (id: string, key: Scenario | 'ivFloor', n: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const override = inputs.overrides[def.id];
  const isOverridden = override !== undefined && Object.keys(override).length > 0;
  const floor = effectiveFloor(def, inputs);
  const count = inputs.counts[def.id];
  const parent = def.subsetOf ? SOURCES_BY_ID[def.subsetOf] : undefined;
  // Only worth calling out when the parent lives in another panel.
  const crossCategoryParent =
    parent && parent.category !== def.category ? parent : undefined;

  return (
    <div className="py-3" style={{ paddingLeft: depth * 14 }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug text-slate-200" title={def.label}>
            {depth > 0 && <span className="mr-1 text-muted">↳</span>}
            {def.label}
          </div>

          {def.medal ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-200">
                {def.medal.name}
              </span>
              <span className="text-[10px] text-muted">
                “{def.medal.description.replace('___', 'N')}”
              </span>
            </div>
          ) : (
            <div className="mt-1">
              <span className="rounded border border-edge bg-ink/50 px-1.5 py-0.5 text-[10px] text-muted">
                no medal — estimate
              </span>
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
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

          {crossCategoryParent && (
            <div className="mt-1 text-[10px] text-muted">
              subtracted from{' '}
              <span className="text-slate-400">
                {crossCategoryParent.medal?.name ?? crossCategoryParent.label}
              </span>
            </div>
          )}
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
          className={`shrink-0 self-start rounded-lg border px-2 py-1.5 text-[11px] transition ${
            isOverridden
              ? 'border-violet-500/60 bg-violet-500/10 text-violet-200'
              : 'border-edge text-muted hover:border-sky-400/50 hover:text-sky-200'
          }`}
          title="Medal thresholds, rate estimates and IV floor for this source"
        >
          {isOverridden ? 'edited' : 'info'} {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-edge/70 bg-panel2/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <ConfidenceBadge level={def.confidence} />
            <span className="text-[11px] text-muted">{def.kind} source</span>
          </div>

          {def.medal ? (
            <div className="mb-3">
              <p className="text-[11px] text-muted">
                Tap a tier to fill in that threshold, or type your exact medal progress.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setCount(def.id, def.medal![tier])}
                    className={`rounded border px-1.5 py-0.5 text-[10px] transition hover:brightness-125 ${TIER_STYLE[tier]}`}
                    title={`${def.medal!.name} ${tier}: ${fmtInt(def.medal![tier])}`}
                  >
                    {tier} {fmtInt(def.medal![tier])}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mb-3 rounded-lg border border-edge/60 bg-ink/40 px-2 py-1.5 text-[11px] leading-relaxed text-muted">
              {def.medalNote}
            </p>
          )}

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
