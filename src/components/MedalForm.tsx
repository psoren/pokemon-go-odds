import { useState } from 'react';
import { CATEGORIES, MEDAL_SOURCES } from '../config/rates';
import { TIERS, TIER_STYLE } from '../config/medals';
import { effectiveFloor } from '../model/forward';
import type { ModelInputs, Scenario, SourceDef, ValidationIssue } from '../model/types';
import { fmtInt, fmtOneIn, toDenominator } from '../lib/format';
import { hundoProbability } from '../model/math';
import { Callout, ConfidenceBadge, NumberField, Panel } from './ui';
import { CategoryIcon } from './art';

interface Props {
  inputs: ModelInputs;
  setInputs: (updater: (prev: ModelInputs) => ModelInputs) => void;
  issues: ValidationIssue[];
}

const SCENARIOS: Scenario[] = ['low', 'mid', 'high'];

/**
 * The whole primary input surface: nine numbers, each read straight off the
 * in-game Medals screen. Everything the model needs that no medal tracks is
 * derived from these and lives in the separate Assumptions panel.
 */
export function MedalForm({ inputs, setInputs, issues }: Props) {
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
      <Callout tone="info" title="Where to find these">
        In-game → tap your avatar → <strong>Medals</strong>. Each one shows your exact progress
        (“47,312 / 50,000”) — type that number.
      </Callout>

      {issues.map((issue) => (
        <Callout key={issue.sourceId} tone="error" title="Subsets exceed their parent medal">
          {issue.message}
        </Callout>
      ))}

      {CATEGORIES.map((category) => {
        const rows = MEDAL_SOURCES.filter((s) => s.category === category);
        if (rows.length === 0) return null;
        return (
          <Panel
            key={category}
            title={category}
            icon={<CategoryIcon category={category} className="h-5 w-5" />}
          >
            <div className="flex flex-col divide-y divide-edge/40">
              {rows.map((def) => (
                <MedalRow
                  key={def.id}
                  def={def}
                  inputs={inputs}
                  setCount={setCount}
                  setOverride={setOverride}
                />
              ))}
            </div>
          </Panel>
        );
      })}

      <button
        type="button"
        onClick={() => {
          if (confirm('Clear all medal counts, assumptions and rate overrides?')) {
            setInputs(() => ({ counts: {}, overrides: {}, assumptions: {} }));
          }
        }}
        className="self-start rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:border-rose-500/50 hover:text-rose-200"
      >
        Reset everything
      </button>
    </div>
  );
}

function MedalRow({
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
  const medal = def.medal!;

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug text-slate-100">{medal.name}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted">
            {medal.description.replace('___', 'N')}
          </div>
        </div>

        <NumberField
          ariaLabel={def.label}
          value={inputs.counts[def.id]}
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
          title="Medal tiers, rate estimates and IV floor"
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

          <p className="text-[11px] leading-relaxed text-muted">
            <span className="text-slate-300">{def.label}</span>
            {def.kind !== 'reference' && (
              <>
                {' '}
                · IV floor {floor} · hundo {fmtOneIn(hundoProbability(floor))}
              </>
            )}
            {def.subsetOf && <> · carved out of a larger medal</>}
          </p>
          <p className="mt-2 text-[11px] text-muted">
            Tap a tier to fill in that threshold, or type your exact medal progress.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setCount(def.id, medal[tier])}
                className={`rounded border px-1.5 py-0.5 text-[10px] transition hover:brightness-125 ${TIER_STYLE[tier]}`}
              >
                {tier} {fmtInt(medal[tier])}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted">{def.note}</p>

          {def.shinyRate && (
            <div className="mt-3 grid grid-cols-3 gap-2">
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
          )}

          {def.kind !== 'reference' && (
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
          )}

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
