import { useMemo } from 'react';
import { ContributionChart } from './components/ContributionChart';
import { DistributionTables } from './components/DistributionTables';
import { Headline } from './components/Headline';
import { InputForm } from './components/InputForm';
import { SensitivityView } from './components/SensitivityView';
import { SourceTable } from './components/SourceTable';
import { Callout } from './components/ui';
import { useLocalStorage } from './hooks/useLocalStorage';
import { emptyInputs, runAllScenarios } from './model/forward';
import type { ModelInputs } from './model/types';

const STORAGE_KEY = 'pokemon-go-odds:inputs:v1';

export default function App() {
  const [inputs, setInputs] = useLocalStorage<ModelInputs>(STORAGE_KEY, emptyInputs());
  const bundle = useMemo(() => runAllScenarios(inputs), [inputs]);
  const mid = bundle.mid;

  const hasInput = mid.sources.some((s) => s.rawCount > 0);

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
          Pokémon GO rarity calculator
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Enter your lifetime account stats and see how many shinies, hundos and shundos the model
          expects you to have — as a full probability distribution, not a single number. Every
          encounter source is an independent binomial trial with its own shiny rate and IV floor.
          Nothing leaves your browser; inputs are saved to localStorage.
        </p>
      </header>

      <div className="mb-6">
        <Headline bundle={bundle} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <InputForm inputs={inputs} setInputs={setInputs} issues={mid.validation} />
        </div>

        <div className="flex flex-col gap-6">
          {!hasInput && (
            <Callout tone="info" title="Start with your wild catch total">
              Your Pokémon GO medals page has most of these: <em>Collector</em> is your lifetime
              catches, <em>Breeder</em> is egg hatches, <em>Champion / Battle Legend</em> track
              raids, <em>Hero / Purifier</em> track Team GO Rocket. Trades come from the{' '}
              <em>Gentleman</em> and <em>Pilot</em> medals — but remember to enter only the{' '}
              <strong>shiny</strong> ones there.
            </Callout>
          )}

          <ContributionChart model={mid} />
          <DistributionTables model={mid} />
          <SensitivityView bundle={bundle} />
          <SourceTable model={mid} assumePurified={inputs.assumePurified} />

          <Callout tone="info" title="What this model does and doesn't know">
            Shiny and IV rolls are treated as independent, every encounter as an independent trial,
            and each source's rate as constant over your whole account history — none of which is
            exactly true. Rates have also changed over the years, and your event mix is not the
            community average. See <code className="text-slate-300">MODEL.md</code> in the repo for
            the full list of approximations.
          </Callout>
        </div>
      </div>

      <footer className="mt-10 border-t border-edge/60 pt-4 text-[11px] leading-relaxed text-muted">
        Shiny rates are community estimates aggregated by Bulbapedia from The Silph Road's
        crowd-sourced research; Niantic has never published them. IV floors are datamined game
        mechanics and are exact. All rates are editable at runtime — open the “rate” disclosure on
        any source.
      </footer>
    </div>
  );
}
