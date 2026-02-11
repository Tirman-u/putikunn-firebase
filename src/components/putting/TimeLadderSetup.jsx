import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import PuttTypeSelector from './PuttTypeSelector';
import { useLanguage } from '@/lib/i18n';

const DISC_OPTIONS = [3, 5, 7];

export default function TimeLadderSetup({ isSolo, onBack, onStart, initialName, initialPuttType }) {
  const { t } = useLanguage();
  const [gameName, setGameName] = useState(initialName || '');
  const [discCount, setDiscCount] = useState(5);
  const [puttType, setPuttType] = useState(initialPuttType || 'regular');

  const handleStart = () => {
    onStart({
      name: gameName || t('time.setup.title', 'Aja väljakutse'),
      gameType: 'time_ladder',
      pin: isSolo ? null : undefined,
      puttType,
      config: {
        discs_per_turn: discCount,
        start_distance: 5,
        end_distance: 10
      }
    });
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <div className="mb-6 flex items-center gap-2">
        <BackButton onClick={onBack} />
        <HomeButton />
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2 dark:text-slate-100">{t('time.setup.title', 'Aja väljakutse')}</h1>
        <p className="text-slate-600 dark:text-slate-300">{t('time.setup.subtitle', 'Solo treening')}</p>
      </div>

      <div className="space-y-6 bg-white rounded-2xl p-6 shadow-sm dark:bg-black dark:border dark:border-white/10 dark:text-slate-100">
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">
            {t('time.setup.name_label', 'Mängu nimi (valikuline)')}
          </label>
          <Input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder={t('time.setup.name_placeholder', 'Nt. Aja väljakutse')}
            className="text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3 dark:text-slate-200">
            {t('time.setup.discs', 'Kettad')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DISC_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => setDiscCount(count)}
                className={`rounded-xl border-2 px-3 py-3 text-center transition ${
                  discCount === count
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-black dark:text-emerald-300'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:bg-black dark:border-white/10 dark:text-slate-200'
                }`}
              >
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('host.discs', 'ketast')}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <PuttTypeSelector selectedType={puttType} onSelect={setPuttType} />
        </div>

        <Button
          onClick={handleStart}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-lg font-semibold"
        >
          {t('time.setup.start', 'Alusta treeningut')}
        </Button>
      </div>

      <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200 dark:bg-black dark:border-white/10">
        <h3 className="font-semibold text-blue-900 mb-2 dark:text-slate-100">{t('time.setup.howto', 'Kuidas mängida?')}</h3>
        <ul className="text-sm text-blue-800 space-y-1 dark:text-slate-300">
          <li>• {t('time.setup.rule1', 'Alusta 5m pealt, eesmärk on jõuda 10m-ni')}</li>
          <li>• {t('time.setup.rule2', '5 järjest sees → liigu +1m (füüsiline arvestus)')}</li>
          <li>• {t('time.setup.rule3', 'Mööda → seeria nulli')}</li>
          <li>• {t('time.setup.rule4', 'Appis ainult stopper: Start alguses, Stop finišis')}</li>
        </ul>
      </div>
    </div>
  );
}
