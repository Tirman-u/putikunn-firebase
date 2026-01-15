import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Check, X, Undo2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StreakChallengeInput({
  player,
  currentDistance,
  onMade,
  onMissed,
  canUndo,
  onUndo,
  currentStreak = 0,
  showDistanceSelector = false,
  onDistanceSelect
}) {
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-4">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Select Distance</h3>
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-slate-600">Distance</span>
          <span className="text-3xl font-bold text-emerald-600">{selectedDistance}m</span>
        </div>
        <Slider
          value={[selectedDistance || 8]}
          onValueChange={(value) => value && setSelectedDistance(value[0])}
          min={3}
          max={15}
          step={1}
          className="mb-6"
        />
        <Button
          onClick={handleSelectDistance}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base font-semibold"
        >
          Start Streak at {selectedDistance}m
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Streak Display */}
      <motion.div
        animate={{ scale: currentStreak > 0 ? 1.05 : 1 }}
        className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200 text-center"
      >
        <div className="text-sm text-slate-600 mb-2">Current Streak</div>
        <div className="text-5xl font-bold text-amber-600 mb-2">{currentStreak}</div>
        <div className="text-sm text-slate-600">made putts in a row</div>
      </motion.div>

      {/* Distance Display */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="text-xs text-slate-500 mb-1">Distance</div>
        <div className="text-3xl font-bold text-slate-800">{currentDistance}m</div>
      </div>

      {/* Make/Miss Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onMade}
          className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-3 text-lg font-bold"
        >
          <Check className="w-6 h-6" />
          Made
        </Button>
        <Button
          onClick={onMissed}
          className="w-full h-16 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center gap-3 text-lg font-bold text-white"
        >
          <X className="w-6 h-6" />
          Missed (Game Ends)
        </Button>
      </div>

      {/* Undo Button */}
      {canUndo && (
        <Button
          onClick={onUndo}
          variant="outline"
          className="w-full h-12 rounded-xl flex items-center justify-center gap-2"
        >
          <Undo2 className="w-4 h-4" />
          Undo Last Putt
        </Button>
      )}
    </div>
  );
}