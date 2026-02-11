import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Check, X, Undo2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';

export default function StreakChallengeInput({
  player,
  currentDistance,
  onMade,
  onMissed,
  canUndo,
  onUndo,
  currentStreak = 0,
  showDistanceSelector = false,
  onDistanceSelect,
  onFinishTraining
}) {
  const { t } = useLanguage();
  const [selectedDistance, setSelectedDistance] = useState(currentDistance || 8);
  const [confirmed, setConfirmed] = useState(!showDistanceSelector);

  const handleSelectDistance = () => {
    if (onDistanceSelect) {
      onDistanceSelect(selectedDistance);
    }
    setConfirmed(true);
  };

  if (showDistanceSelector && !confirmed) {
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 mb-4">
        <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4">
          {t('player.choose_distance', 'Vali distants')}
        </h3>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <span className="text-xs sm:text-sm text-slate-600">{t('player.distance', 'Distants')}</span>
          <span className="text-2xl sm:text-3xl font-bold text-emerald-600">{selectedDistance}m</span>
        </div>
        <Slider
          value={[selectedDistance || 8]}
          onValueChange={(value) => value && setSelectedDistance(value[0])}
          min={3}
          max={15}
          step={1}
          className="mb-4 sm:mb-6"
        />
        <Button
          onClick={handleSelectDistance}
          className="w-full h-11 sm:h-12 bg-emerald-600 [@media(hover:hover)]:hover:bg-emerald-700 text-sm sm:text-base font-semibold"
        >
          {t('player.start_streak', 'Alusta seeriat {distance}m', { distance: selectedDistance })}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Streak Display */}
      <motion.div
        animate={{ scale: currentStreak > 0 ? 1.05 : 1 }}
        className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 sm:p-6 border-2 border-amber-200 text-center"
      >
        <div className="text-xs sm:text-sm text-slate-600 mb-2">{t('player.current_streak', 'Praegune seeria')}</div>
        <div className="text-4xl sm:text-5xl font-bold text-amber-600 mb-2">{currentStreak}</div>
        <div className="text-xs sm:text-sm text-slate-600">{t('player.in_a_row', 'järjest sisse')}</div>
      </motion.div>

      {/* Distance Display */}
      <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-slate-100">
        <div className="text-[11px] sm:text-xs text-slate-500 mb-1">{t('player.distance', 'Distants')}</div>
        <div className="text-2xl sm:text-3xl font-bold text-slate-800">{currentDistance}m</div>
      </div>

      {/* Make/Miss Buttons */}
      <div className="space-y-2 sm:space-y-3">
        <Button
          onClick={(event) => {
            onMade();
            event.currentTarget.blur();
          }}
          className="w-full h-14 sm:h-16 bg-emerald-600 [@media(hover:hover)]:hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-3 text-base sm:text-lg font-bold"
        >
          <Check className="w-5 h-5 sm:w-6 sm:h-6" />
          {t('player.sees', 'Sees')}
        </Button>
        <Button
            onClick={(event) => {
              onMissed();
              event.currentTarget.blur();
            }}
            className="w-full h-14 sm:h-16 bg-red-600 [@media(hover:hover)]:hover:bg-red-700 rounded-xl flex items-center justify-center gap-3 text-base sm:text-lg font-bold text-white"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
            {t('player.miss', 'Mööda')}
          </Button>
      </div>

      {/* Undo Button */}
      {canUndo && (
        <Button
          onClick={onUndo}
          variant="outline"
          className="w-full h-11 sm:h-12 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <Undo2 className="w-4 h-4" />
          {t('player.undo_last', 'Võta viimane tagasi')}
        </Button>
      )}

      {/* Finish Training Button */}
      {canUndo && (
        <Button
          onClick={onFinishTraining}
          className="w-full h-11 sm:h-12 bg-slate-600 [@media(hover:hover)]:hover:bg-slate-700 rounded-xl font-semibold text-sm sm:text-base"
        >
          {t('player.finish_training', 'Lõpeta treening')}
        </Button>
      )}
      </div>
      );
      }
