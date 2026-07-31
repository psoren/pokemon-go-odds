import { useMemo } from 'react';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { ContributionChart } from './components/ContributionChart';
import { DistributionTables } from './components/DistributionTables';
import { Headline } from './components/Headline';
import { LuckPanel } from './components/LuckPanel';
import { MedalForm } from './components/MedalForm';
import { SensitivityView } from './components/SensitivityView';
import { SourceTable } from './components/SourceTable';
import { Callout, Disclosure } from './components/ui';
import { HeaderArt, Pokeball } from './components/art';
import { useLocalStorage } from './hooks/useLocalStorage';
import { emptyInputs, runAllScenarios } from './model/forward';
import type { ModelInputs } from './model/types';
import { fmtPercent } from './lib/format';

const STORAGE_KEY = 'pokemon-go-odds:inputs:v2';

export default function App() {
  const [inputs, setInputs] = useLocalStorage<ModelInputs>(STORAGE_KEY, emptyInputs());
  const bundle = useMemo(() => runAllScenarios(inputs), [inputs]);
  const mid = bundle.mid;

  const hasInput = Object.values(inputs.counts).some((n) => n > 0);

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8">
      <header className="relative mb-6 overflow-hidden">
        <HeaderArt />
        <div className="relative flex items-center gap-3">
          <Pokeball className="h-9 w-9 shrink-0" top="#f6c453" bottom="#e8edf9" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Pokémon GO rarity calculator
          </h1>
        </div>
        <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Type in your medals. See how many shinies, hundos and shundos you should have by now.
          Nothing leaves your browser.
        </p>
      </header>

      <div className="mb-6">
        <Headline bundle={bundle} inputs={inputs} setInputs={setInputs} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <MedalForm inputs={inputs} setInputs={setInputs} issues={mid.validation} />
        </div>

        <div className="flex flex-col gap-6">
          {!hasInput ? (
            <Callout tone="info" title="Start with Collector">
              It is the big one — every Pokémon you have ever caught. The rest fill in from
              there. Because Collector already includes your raid, research and Rocket catches,
              the app subtracts those rather than adding them.
            </Callout>
          ) : (
            <ContributionChart model={mid} />
          )}

          <LuckPanel bundle={bundle} inputs={inputs} />

          <AssumptionsPanel inputs={inputs} setInputs={setInputs} model={mid} />

          <Disclosure
            label="Full breakdown"
            hint="Probability of exactly k, sensitivity to the rate estimates, and λ per source"
          >
            <DistributionTables model={mid} />
            <SensitivityView bundle={bundle} />
            <SourceTable model={mid} />
          </Disclosure>

          <Callout tone="info" title="Treat these as a ballpark, not a scoreboard">
            Niantic has never published shiny rates, so the model runs on community estimates.
            Three things push it high in particular: your Collector total includes species that
            were shiny-locked at the time, and the Champion, Hero and Pokémon Ranger medals count
            battles won and tasks completed rather than Pokémon caught. The full reasoning — and
            everywhere the model is knowingly approximate — is in{' '}
            <code className="text-slate-300">MODEL.md</code>.
          </Callout>
        </div>
      </div>

      <footer className="mt-10 border-t border-edge/60 pt-4 text-[11px] leading-relaxed text-muted">
        Medal names, descriptions and thresholds are in-game text. IV floors are datamined game
        mechanics and are exact. Shiny rates are community estimates aggregated by Bulbapedia
        from The Silph Road's research, and every one is editable at runtime.
        {mid.purifiedFraction > 0 && (
          <>
            {' '}
            Purification is applied to {fmtPercent(mid.purifiedFraction, 0)} of your shadows,
            from your Purifier medal.
          </>
        )}
      </footer>
    </div>
  );
}
