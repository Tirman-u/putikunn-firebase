import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

export default function TimeLadderInput({
  timeLabel,
  currentDistance,
  currentStreak,
  targetStreak,
  isStarted,
  onStart,
  onMade,
  onMissed
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 text-center dark:bg-black dark:border-white/10 dark:text-slate-100">
        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-2">Aeg</div>
        <div className="text-4xl sm:text-5xl font-bold text-emerald-600 dark:text-emerald-400">{timeLabel}</div>
        {!isStarted && (
          <Button
            onClick={onStart}
            className="mt-4 w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-sm sm:text-base font-semibold"
          >
            Alusta stopperit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center dark:bg-black dark:border-white/10 dark:text-slate-100">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Distants</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{currentDistance}m</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center dark:bg-black dark:border-white/10 dark:text-slate-100">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Seeria</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {currentStreak}/{targetStreak}
          </div>
        </div>
      </div>

      {isStarted && (
        <div className="space-y-2 sm:space-y-3">
          <Button
            onClick={(event) => {
              onMade();
              event.currentTarget.blur();
            }}
            className="w-full h-14 sm:h-16 bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-3 text-base sm:text-lg font-bold"
          >
            <Check className="w-5 h-5 sm:w-6 sm:h-6" />
            Sees
          </Button>
          <Button
            onClick={(event) => {
              onMissed();
              event.currentTarget.blur();
            }}
            className="w-full h-14 sm:h-16 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center gap-3 text-base sm:text-lg font-bold text-white"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
            Mööda
          </Button>
        </div>
      )}
    </div>
  );
}
