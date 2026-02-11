import React from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

export default function TimeLadderInput({
  timeLabel,
  infoLabel,
  isStarted,
  onStart,
  onStop
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 text-center dark:bg-black dark:border-white/10 dark:text-slate-100">
        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-2">
          {t('player.time', 'Aeg')}
        </div>
        <div className="text-4xl sm:text-5xl font-bold text-emerald-600 dark:text-emerald-400">{timeLabel}</div>
        {infoLabel && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{infoLabel}</div>
        )}
        <Button
          onClick={isStarted ? onStop : onStart}
          className={`mt-4 w-full h-12 text-sm sm:text-base font-semibold ${
            isStarted ? 'bg-slate-800 hover:bg-slate-900' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {isStarted ? t('player.stop_timer', 'Lõpeta') : t('player.start_timer', 'Alusta stopperit')}
        </Button>
      </div>
    </div>
  );
}
