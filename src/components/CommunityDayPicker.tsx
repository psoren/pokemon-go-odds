import { useState } from 'react';
import {
  COMMUNITY_DAYS,
  COMMUNITY_DAY_YEARS,
  MONTH_NAMES,
  eventsInYear,
} from '../config/communityDays';
import { SOURCES_BY_ID } from '../config/rates';
import { communityDayCount, effectivePerEvent } from '../model/forward';
import type { ModelInputs, ModelOutput, Scenario } from '../model/types';
import { fmtInt } from '../lib/format';
import { NumberField, Panel } from './ui';
import { Sparkle } from './art';

const SCENARIOS: Scenario[] = ['low', 'mid', 'high'];

/**
 * Tick the Community Days you actually played.
 *
 * This replaces the app's worst assumption. Community Day catches are ~1-in-25
 * shiny — twenty times the base rate — so guessing "1% to 6% of my catches"
 * swung the shiny prediction by more than 250 all by itself. The events are a
 * matter of record; only your attendance and your catch rate were ever unknown,
 * and now only the catch rate is.
 */
export function CommunityDayPicker({
  inputs,
  setInputs,
  model,
}: {
  inputs: ModelInputs;
  setInputs: (updater: (prev: ModelInputs) => ModelInputs) => void;
  model: ModelOutput;
}) {
  const [open, setOpen] = useState(false);
  const def = SOURCES_BY_ID['community-day'];
  const selected = new Set(inputs.communityDays ?? []);
  const attended = communityDayCount(inputs);
  const catches = model.sources.find((r) => r.def.id === 'community-day')?.rawCount ?? 0;

  const setSelected = (next: Set<string>) =>
    setInputs((prev) => ({ ...prev, communityDays: [...next] }));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleYear = (year: number, on: boolean) => {
    const next = new Set(selected);
    for (const e of eventsInYear(year)) {
      if (on) next.add(e.id);
      else next.delete(e.id);
    }
    setSelected(next);
  };

  const setPerEvent = (key: Scenario, n: number | undefined) =>
    setInputs((prev) => {
      const next = { ...(prev.assumptions['community-day'] ?? {}) };
      if (n === undefined) delete next[key];
      else next[key] = Math.max(0, n);
      const assumptions = { ...prev.assumptions };
      if (Object.keys(next).length === 0) delete assumptions['community-day'];
      else assumptions['community-day'] = next;
      return { ...prev, assumptions };
    });

  return (
    <Panel
      title="Community Days you played"
      subtitle="The single biggest lever on your shiny estimate — these are ~1-in-25 shiny, twenty times the base rate."
      icon={<Sparkle className="h-4 w-4 text-shiny" />}
      right={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted transition hover:border-sky-400/50 hover:text-sky-200"
        >
          {open ? 'hide ▲' : 'pick them ▼'}
        </button>
      }
    >
      <p className="text-xs leading-relaxed text-muted">
        <span className="text-slate-200">
          {attended} of {COMMUNITY_DAYS.length}
        </span>{' '}
        events selected →{' '}
        <span className="text-shiny">{fmtInt(catches)} featured-species catches</span>.{' '}
        {attended === 0 && (
          <>
            Nothing selected yet, so the model currently assumes you have never played one.
            Open this and tick them off.
          </>
        )}
      </p>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-xl border border-edge/70 bg-panel2/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted">
              Catches per event you attended
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {def.derivedFromEvents!.rationale}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SCENARIOS.map((s) => (
                <label key={s} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted">{s}</span>
                  <NumberField
                    ariaLabel={`Community Day catches per event ${s}`}
                    value={Number(effectivePerEvent(def, inputs, s).toFixed(0))}
                    onChange={(n) => setPerEvent(s, n)}
                    className="w-full"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set(COMMUNITY_DAYS.map((e) => e.id)))}
              className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted transition hover:border-sky-400/50 hover:text-sky-200"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted transition hover:border-rose-500/50 hover:text-rose-200"
            >
              Clear all
            </button>
            <label className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-muted">others not listed</span>
              <NumberField
                ariaLabel="Other Community Days not listed"
                value={inputs.extraCommunityDays || undefined}
                onChange={(n) =>
                  setInputs((prev) => ({ ...prev, extraCommunityDays: n ?? 0 }))
                }
                placeholder="0"
                className="w-16"
              />
            </label>
          </div>

          {COMMUNITY_DAY_YEARS.map((year) => {
            const events = eventsInYear(year);
            const chosen = events.filter((e) => selected.has(e.id)).length;
            return (
              <div key={year} className="rounded-xl border border-edge/70 bg-panel2/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-200">
                    {year}
                    <span className="ml-2 text-[11px] font-normal text-muted">
                      {chosen}/{events.length}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleYear(year, true)}
                      className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-muted transition hover:border-sky-400/50 hover:text-sky-200"
                    >
                      all
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleYear(year, false)}
                      className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-muted transition hover:border-rose-500/50 hover:text-rose-200"
                    >
                      none
                    </button>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {events.map((e) => {
                    const on = selected.has(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggle(e.id)}
                        aria-pressed={on}
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight transition ${
                          on
                            ? 'border-shiny/50 bg-shiny/10 text-slate-100'
                            : 'border-edge/70 text-muted hover:border-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span
                          className={`grid size-3.5 shrink-0 place-items-center rounded-sm border text-[9px] ${
                            on ? 'border-shiny bg-shiny text-ink' : 'border-edge'
                          }`}
                          aria-hidden="true"
                        >
                          {on ? '✓' : ''}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{e.featured}</span>
                          <span className="block text-[10px] text-muted">
                            {MONTH_NAMES[e.month - 1]}
                            {e.classic && ' · Classic'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
