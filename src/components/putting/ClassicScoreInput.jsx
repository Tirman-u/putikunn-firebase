import React from 'react';
import { Button } from '@/components/ui/button';
import { Undo } from 'lucide-react';

const DISTANCE_COLORS = {
  3: 'from-red-300 to-red-400',
  4: 'from-red-400 to-red-500',
  5: 'from-orange-400 to-orange-500',
  6: 'from-amber-400 to-amber-500',
  7: 'from-yellow-400 to-yellow-500',
  8: 'from-lime-400 to-lime-500',
  9: 'from-emerald-400 to-emerald-500',
  10: 'from-emerald-500 to-emerald-600',
  11: 'from-teal-500 to-teal-600',
  12: 'from-cyan-500 to-cyan-600',
  13: 'from-blue-500 to-blue-600',
  14: 'from-indigo-500 to-indigo-600',
  15: 'from-purple-500 to-purple-600'
};

export default function ClassicScoreInput({ 
  player, 
  currentDistance, 
  onSubmit, 
  canUndo, 
  onUndo,
  distanceMap,
  currentRoundPutts = [],
  puttType = 'regular'
}) {
  const handleScoreClick = (made) => {
    onSubmit(made);
  };

  // Visual frames - 20 frames representing 20 rounds
  const totalFrames = 20;
  const currentFrameIndex = Math.floor(currentRoundPutts.length / 5);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Visual Frames Display - 20 boxes */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100">
        <div className="grid grid-cols-10 gap-2 sm:gap-2.5">
          {Array.from({ length: totalFrames }).map((_, frameIdx) => {
            const isCurrent = frameIdx === currentFrameIndex;
            const isCompleted = frameIdx < currentFrameIndex;
            
            // Get putts for this frame (5 putts per frame)
            const framePutts = currentRoundPutts.slice(frameIdx * 5, (frameIdx + 1) * 5);
            const madeCount = framePutts.filter(p => p.result === 'made').length;
            
            return (
              <div 
                key={frameIdx}
                className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-50'
                    : isCompleted
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* 5 small indicators inside each box */}
                <div className="grid grid-cols-1 gap-1">
                  {Array.from({ length: 5 }).map((_, puttIdx) => {
                    const puttResult = framePutts[puttIdx]?.result;
                    return (
                      <div
                        key={puttIdx}
                        className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${
                          puttResult === 'made'
                            ? 'bg-emerald-500'
                            : puttResult === 'missed'
                            ? 'bg-red-400'
                            : 'bg-slate-300'
                        }`}
                      />
                    );
                  })}
                </div>
                
                {/* Frame number */}
                <div className="text-[8px] sm:text-[9px] text-slate-400 mt-1">{frameIdx + 1}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Distance and Putt Style */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100">
        <div className="text-center">
          <div className="text-4xl sm:text-5xl font-bold text-slate-800 mb-1 sm:mb-2">{currentDistance}m</div>
          <div className="text-[11px] sm:text-xs text-slate-500">Puti stiil</div>
          <div className="text-sm font-semibold text-slate-800">
            {puttType === 'regular' ? 'Tavaline' : puttType === 'straddle' ? 'Straddle' : 'Turbo'}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center text-xs sm:text-sm text-slate-500">
        Vali mitu putti läks sisse (5-st)
      </div>

      {/* One-Click Score Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((num) => {
          const potentialPoints = currentDistance * num;
          const nextDistance = distanceMap[num];
          
          return (
            <button
              key={num}
              onClick={(event) => {
                handleScoreClick(num);
                event.currentTarget.blur();
              }}
              className="relative py-4 sm:py-6 rounded-2xl active:scale-95 transition-all border-2 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 [@media(hover:hover)]:hover:from-emerald-50 [@media(hover:hover)]:hover:to-emerald-100 border-slate-200 [@media(hover:hover)]:hover:border-emerald-300 focus:outline-none"
            >
              <div className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">{num}</div>
              <div className="text-[10px] sm:text-xs font-medium text-slate-500 mb-0.5">
                {potentialPoints} p
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400">
                → {nextDistance ? `${nextDistance}m` : '?m'}
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
          className="w-full h-12 sm:h-14 rounded-xl text-sm sm:text-base"
        >
          <Undo className="w-5 h-5 mr-2" />
          Võta viimane ring tagasi
        </Button>
      )}
    </div>
  );
}
