import React from 'react';
import { Button } from '@/components/ui/button';
import { Undo, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISTANCE_COLORS = {
  5: 'from-red-400 to-red-500',
  6: 'from-orange-400 to-orange-500',
  7: 'from-amber-400 to-amber-500',
  8: 'from-yellow-400 to-yellow-500',
  9: 'from-lime-400 to-lime-500',
  10: 'from-emerald-400 to-emerald-500'
};

export default function OneClickScoreInput({ player, currentDistance, onSubmit, canUndo, onUndo }) {
  const handleScoreClick = (made) => {
    const points = currentDistance * made;
    onSubmit({ made, points });
  };

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
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-slate-500 mb-4">
        Vali mitu putti läks sisse (5-st)
      </div>

      {/* One-Click Score Buttons */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map((num) => {
          const potentialPoints = currentDistance * num;
          const nextDistance = [5, 6, 7, 8, 9, 10][num];
          
          return (
            <button
              key={num}
              onClick={(event) => {
                handleScoreClick(num);
                event.currentTarget.blur();
              }}
              className="relative py-8 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 [@media(hover:hover)]:hover:from-emerald-50 [@media(hover:hover)]:hover:to-emerald-100 active:scale-95 transition-all border-2 border-slate-200 [@media(hover:hover)]:hover:border-emerald-300 shadow-sm"
            >
              <div className="text-4xl font-bold text-slate-800 mb-2">{num}</div>
              <div className="text-xs font-medium text-slate-500 mb-1">
                {potentialPoints} p
              </div>
              <div className="text-[10px] text-slate-400">
                → {nextDistance}m
              </div>
            </button>
          );
        })}
      </div>

      {/* Undo Button */}
      {canUndo && (
        <Button
          onClick={onUndo}
          variant="outline"
          className="w-full h-12 rounded-xl border-2"
        >
          <Undo className="w-4 h-4 mr-2" />
          Võta viimane tagasi
        </Button>
      )}
    </div>
  );
}
