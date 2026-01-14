import React from 'react';
import { Button } from '@/components/ui/button';
import { Undo, Target, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const nextMade = Math.min(currentDistance + 1, 10);
  const nextMissed = Math.max(currentDistance - 1, 5);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      {/* Player Name & Distance */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-slate-800 mb-3">{player}</h3>
        <div className="flex items-center justify-center gap-3">
          <Target className="w-5 h-5 text-slate-400" />
          <div className={cn(
            "px-6 py-2 rounded-xl bg-gradient-to-r shadow-lg",
            DISTANCE_COLORS[currentDistance]
          )}>
            <span className="text-2xl font-bold text-white">{currentDistance}m</span>
          </div>
        </div>
        {showStreak && (
          <div className="mt-3">
            <div className="text-sm text-slate-500">Current Streak</div>
            <div className="text-3xl font-bold text-red-600">🔥 {currentStreak}</div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-slate-500 mb-4">
        Did you make the putt?
      </div>

      {/* Made/Missed Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={onMade}
          className="py-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-95 transition-all shadow-lg text-white"
        >
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
          <div className="text-2xl font-bold">Made</div>
          <div className="text-sm opacity-90 mt-1">+{currentDistance} pts</div>
          <div className="text-xs opacity-75 mt-1">→ {nextMade}m</div>
        </button>

        <button
          onClick={onMissed}
          className="py-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95 transition-all shadow-lg text-white"
        >
          <XCircle className="w-12 h-12 mx-auto mb-3" />
          <div className="text-2xl font-bold">Missed</div>
          <div className="text-sm opacity-90 mt-1">0 pts</div>
          <div className="text-xs opacity-75 mt-1">→ {nextMissed}m</div>
        </button>
      </div>

      {/* Undo Button */}
      {canUndo && (
        <Button
          onClick={onUndo}
          variant="outline"
          className="w-full h-12 rounded-xl border-2"
        >
          <Undo className="w-4 h-4 mr-2" />
          Undo Last Putt
        </Button>
      )}
    </div>
  );
}