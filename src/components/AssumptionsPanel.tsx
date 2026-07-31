import { useState } from 'react';
import { FRACTION_SOURCES, SOURCES_BY_ID } from '../config/rates';
import { effectiveFraction } from '../model/forward';
import type { ModelInputs, ModelOutput, Scenario } from '../model/types';
import { fmtInt, fmtPercent } from '../lib/format';
import { Callout, NumberField, Panel } from './ui';

const SCENARIOS: Scenario[] = ['low', 'mid', 'high'];

/**
 * Everything the model needs that no medal tracks, derived as a share of a
 * medal you did enter. Collapsed by default — the point of the app is that you
 * can enter medals and stop.
 *
 * These are shown as percentages of their parent so they scale with whatever
 * medal counts you typed, and every one is editable. The low/high columns feed
 * the headline range, so an assumption you are unsure about widens the answer
 * instead of quietly biasing it.
 */
export function AssumptionsPanel({
  inputs,
  setInputs,
  model,
}: {
  inputs: ModelInputs;
  setInputs: (updater: (prev: ModelInputs) => ModelInputs) => void;
  model: ModelOutput;
}) {
  const [open, setOpen] = useState(false);

  const setFraction = (id: string, key: Scenario, pctValue: number | undefined) =>
    setInputs((prev) => {
      const next = { ...(prev.assumptions[id] ?? {}) };
      if (pctValue === undefined) delete next[key];
      else next[key] = Math.min(1, Math.max(0, pctValue / 100));
      const assumptions = { ...prev.assumptions };
      if (Object.keys(next).length === 0) delete assumptions[id];
      else assumptions[id] = next;
      return { ...prev, assumptions };
    });

  const edited = Object.keys(inputs.assumptions).length;

  return (
    <Panel
      title="Assumptions"
      subtitle="The handful of things no medal tracks. Defaults are rough guesses, not data — but their uncertainty is already baked into the ranges above."
      right={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted transition hover:border-sky-300 hover:text-sky-700"
        >
          {edited > 0 && (
            <span className="mr-1 text-violet-700">{edited} edited</span>
          )}
          {open ? 'hide ▲' : 'show ▼'}
        </button>
      }
    >
      {!open ? (
        <p className="text-xs leading-relaxed text-muted">
          {FRACTION_SOURCES.length} values are being assumed from your medals — including{' '}
          <span className="text-muted">
            {fmtInt(model.sources.find((r) => r.def.id === 'trades-shiny')?.rawCount ?? 0)} shiny
            trades
          </span>{' '}
          and{' '}
          <span className="text-muted">
            {fmtInt(model.sources.find((r) => r.def.id === 'community-day')?.rawCount ?? 0)}{' '}
            Community Day catches
          </span>
          . Open this if any of them look wrong for how you play.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Callout tone="warn" title="These are guesses, and one of them matters a lot">
            Nothing in the game counts what share of your catches were weather-boosted, or how
            many of your trades were shiny. The defaults below are plausible, not measured.{' '}
            <strong>Shiny trades</strong> is the one worth your attention — it usually drives
            most of your expected shundos, and it is pure guesswork until you replace it.
          </Callout>

          {FRACTION_SOURCES.map((def) => {
            const parent = SOURCES_BY_ID[def.derivedFrom!.parentId];
            const row = model.sources.find((r) => r.def.id === def.id);
            const parentRow = model.sources.find((r) => r.def.id === parent.id);
            const isEdited = inputs.assumptions[def.id] !== undefined;
            return (
              <div
                key={def.id}
                className={`rounded-xl border p-3 ${
                  isEdited ? 'border-violet-300 bg-violet-50' : 'border-edge bg-panel2'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink">{def.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {fmtInt(row?.rawCount ?? 0)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  as a share of{' '}
                  <span className="text-muted">
                    {parent.medal?.name ?? parent.label}
                  </span>{' '}
                  ({fmtInt(parentRow?.rawCount ?? 0)})
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {def.derivedFrom!.rationale}
                </p>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {SCENARIOS.map((s) => (
                    <label key={s} className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-muted">
                        {s}
                      </span>
                      <span className="flex items-center gap-1">
                        <NumberField
                          ariaLabel={`${def.label} ${s} percent`}
                          value={Number(
                            (effectiveFraction(def, inputs, s) * 100).toFixed(1),
                          )}
                          onChange={(n) => setFraction(def.id, s, n)}
                          className="w-full"
                        />
                        <span className="text-[11px] text-muted">%</span>
                      </span>
                    </label>
                  ))}
                </div>

                {isEdited && (
                  <button
                    type="button"
                    onClick={() =>
                      setInputs((prev) => {
                        const assumptions = { ...prev.assumptions };
                        delete assumptions[def.id];
                        return { ...prev, assumptions };
                      })
                    }
                    className="mt-2 text-[11px] text-muted underline underline-offset-2 hover:text-ink"
                  >
                    Reset to default (
                    {fmtPercent(def.derivedFrom!.fraction.mid, 1)})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
