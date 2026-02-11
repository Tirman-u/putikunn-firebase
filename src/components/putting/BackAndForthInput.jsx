import React from 'react';
import { Button } from '@/components/ui/button';
import { Undo, Target, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

const DISTANCE_COLORS = {
  5: 'from-red-400 to-red-500',
  6: 'from-orange-400 to-orange-500',
  7: 'from-amber-400 to-amber-500',
  8: 'from-yellow-400 to-yellow-500',
  9: 'from-lime-400 to-lime-500',
  10: 'from-emerald-400 to-emerald-500'
};

export default function BackAndForthInput({ 
  player, 
  currentDistance, 
  onMade, 
  onMissed, 
  canUndo, 
  onUndo,
  showStreak = false,
  currentStreak = 0
}) {
  const { t } = useLanguage();
  const nextMade = Math.min(currentDistance + 1, 10);
  const nextMissed = Math.max(currentDistance - 1, 5);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100">
      {/* Player Name & Distance */}
      <div className="text-center mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2 sm:mb-3">{player}</h3>
        <div className="flex items-center justify-center gap-3">
          <Target className="w-5 h-5 text-slate-400" />
          <div className={cn(
            "px-4 py-1.5 sm:px-6 sm:py-2 rounded-xl bg-gradient-to-r shadow-lg",
            DISTANCE_COLORS[currentDistance]
          )}>
            <span className="text-xl sm:text-2xl font-bold text-white">{currentDistance}m</span>
          </div>
        </div>
        {showStreak && (
          <div className="mt-3">
            <div className="text-xs sm:text-sm text-slate-500">{t('player.current_streak', 'Praegune seeria')}</div>
            <div className="text-2xl sm:text-3xl font-bold text-red-600">🔥 {currentStreak}</div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">
        {t('player.was_made', 'Kas putt läks sisse?')}
      </div>

      {/* Made/Missed Buttons */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <button
          onClick={(event) => {
            onMade();
            event.currentTarget.blur();
          }}
          className="py-8 sm:py-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 [@media(hover:hover)]:hover:from-emerald-600 [@media(hover:hover)]:hover:to-emerald-700 active:scale-95 transition-all shadow-lg text-white focus:outline-none"
        >
          <CheckCircle2 className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3" />
          <div className="text-xl sm:text-2xl font-bold">{t('player.sees', 'Sees')}</div>
          <div className="text-xs sm:text-sm opacity-90 mt-1">+{currentDistance} {t('player.points_abbr', 'p')}</div>
          <div className="text-[11px] sm:text-xs opacity-75 mt-1">→ {nextMade}m</div>
        </button>

        <button
          onClick={(event) => {
            onMissed();
            event.currentTarget.blur();
          }}
          className="py-8 sm:py-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 [@media(hover:hover)]:hover:from-red-600 [@media(hover:hover)]:hover:to-red-700 active:scale-95 transition-all shadow-lg text-white focus:outline-none"
        >
          <XCircle className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3" />
          <div className="text-xl sm:text-2xl font-bold">{t('player.miss', 'Mööda')}</div>
          <div className="text-xs sm:text-sm opacity-90 mt-1">0 {t('player.points_abbr', 'p')}</div>
          <div className="text-[11px] sm:text-xs opacity-75 mt-1">→ {nextMissed}m</div>
        </button>
      </div>

      {/* Undo Button */}
      {canUndo && (
        <Button
          onClick={onUndo}
          variant="outline"
          className="w-full h-11 sm:h-12 rounded-xl border-2 text-sm sm:text-base"
        >
          <Undo className="w-4 h-4 mr-2" />
          {t('player.undo_last', 'Võta viimane tagasi')}
        </Button>
      )}
    </div>
  );
}
