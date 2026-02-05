import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISTANCE_COLORS = {
  5: 'from-red-400 to-red-500',
  6: 'from-orange-400 to-orange-500',
  7: 'from-amber-400 to-amber-500',
  8: 'from-yellow-400 to-yellow-500',
  9: 'from-lime-400 to-lime-500',
  10: 'from-emerald-400 to-emerald-500'
};

export default function JylyScoreInput({ player, currentDistance, onSubmit }) {
  const [made, setMade] = useState(null);

  const handleSubmit = () => {
    if (made !== null) {
      // Calculate points: distance × made putts
      const points = currentDistance * made;
      onSubmit({ made, points });
      setMade(null);
    }
  };

  useEffect(() => {
    setMade(null);
  }, [currentDistance]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      {/* Player Name */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-slate-800 mb-1">{player}</h3>
        <p className="text-sm text-slate-400">Vali sisse läinud putid</p>
      </div>

      {/* Current Distance Display */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <Target className="w-6 h-6 text-slate-400" />
        <div className={cn(
          "px-6 py-3 rounded-2xl bg-gradient-to-r shadow-lg",
          DISTANCE_COLORS[currentDistance]
        )}>
          <span className="text-3xl font-bold text-white">{currentDistance}m</span>
        </div>
      </div>

      {/* Score Selection (0-5) */}
      <div className="mb-6">
        <div className="text-center text-sm text-slate-500 mb-4">
          Vali mitu putti läks sisse (5-st)
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((num) => {
            const potentialPoints = currentDistance * num;
            return (
              <button
                key={num}
                onClick={(event) => {
                  setMade(num);
                  event.currentTarget.blur();
                }}
                className={cn(
                  "relative py-6 rounded-2xl text-center transition-all",
                  made === num
                    ? "bg-emerald-500 text-white shadow-xl scale-105"
                    : "bg-slate-50 text-slate-700 [@media(hover:hover)]:hover:bg-slate-100 active:scale-95"
                )}
              >
                <div className="text-3xl font-bold mb-1">{num}</div>
                <div className={cn(
                  "text-xs font-medium",
                  made === num ? "text-emerald-100" : "text-slate-400"
                )}>
                  {potentialPoints} p
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Next Distance Preview */}
      {made !== null && (
        <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-2">Järgmine distants</div>
            <div className={cn(
              "inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r text-white font-bold",
              DISTANCE_COLORS[[5, 6, 7, 8, 9, 10][made]]
            )}>
              {[5, 6, 7, 8, 9, 10][made]}m
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={made === null}
        className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-lg font-semibold rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Check className="w-5 h-5 mr-2" />
        {made !== null ? `Kinnita ${made} sees • ${currentDistance * made} p` : 'Vali tulemus'}
      </Button>
    </div>
  );
}
