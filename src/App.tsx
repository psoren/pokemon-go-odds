import { useMemo } from 'react';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { ContributionChart } from './components/ContributionChart';
import { DistributionTables } from './components/DistributionTables';
import { Headline } from './components/Headline';
import { MedalForm } from './components/MedalForm';
import { SensitivityView } from './components/SensitivityView';
import { SourceTable } from './components/SourceTable';
import { Callout } from './components/ui';
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
    <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
          Pokémon GO rarity calculator
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Type in your medals. See how many shinies, hundos and shundos you should have — as a
          full probability distribution, not a single number. Every encounter source is an
          independent binomial trial with its own shiny rate and IV floor. Nothing leaves your
          browser; inputs are saved to localStorage.
        </p>
      </header>

      <div className="mb-6">
        <Headline bundle={bundle} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <MedalForm inputs={inputs} setInputs={setInputs} issues={mid.validation} />
        </div>

        <div className="flex flex-col gap-6">
          {!hasInput && (
            <Callout tone="info" title="Nine numbers and you are done">
              Start with <strong>Collector</strong> — every Pokémon you have ever caught. Then
              Champion and Battle Legend for raids, Hero and Ultra Hero for Team GO Rocket,
              Breeder for eggs, Pokémon Ranger for research, Gentleman for trades and Purifier
              for shadows. Because Collector already contains your raid, research and Rocket
              catches, the app subtracts those from it rather than adding them.
            </Callout>
          )}

          <AssumptionsPanel inputs={inputs} setInputs={setInputs} model={mid} />
          <ContributionChart model={mid} />
          <DistributionTables model={mid} />
          <SensitivityView bundle={bundle} />
          <SourceTable model={mid} />

          <Callout tone="info" title="What this model does and doesn't know">
            Shiny and IV rolls are treated as independent, every encounter as an independent
            trial, and each source's rate as constant over your whole account history — none of
            which is exactly true. Champion, Hero and Pokémon Ranger count battles won and tasks
            completed rather than Pokémon caught, so they run high. And your Collector total
            includes species that were shiny-locked at the time, which biases expected shinies
            up further. See <code className="text-slate-300">MODEL.md</code> in the repo for the
            full list.
          </Callout>
        </div>
      </div>

      <footer className="mt-10 border-t border-edge/60 pt-4 text-[11px] leading-relaxed text-muted">
        Medal names, descriptions and thresholds are in-game text. IV floors are datamined game
        mechanics and are exact. Shiny rates are community estimates aggregated by Bulbapedia
        from The Silph Road's crowd-sourced research — Niantic has never published them — and
        every one is editable at runtime.
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
