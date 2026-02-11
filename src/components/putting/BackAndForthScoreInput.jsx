import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Undo2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export default function BackAndForthScoreInput({ 
  player, 
  currentDistance, 
  onMade, 
  onMissed, 
  canUndo, 
  onUndo,
  putts = [],
  puttType = 'regular',
  totalPoints = 0,
  hideScore = false
}) {
  const { t } = useLanguage();
  // Group putts into frames of 20
  const totalFrames = 20;
  const puttsPerFrame = 5;
  
  // Calculate which frame we're in
  const currentFrameIndex = Math.floor(putts.length / puttsPerFrame);
  const currentFramePutts = putts.slice(
    currentFrameIndex * puttsPerFrame,
    (currentFrameIndex + 1) * puttsPerFrame
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Visual Frames Display - 20 boxes */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100">
        <div className="grid grid-cols-10 gap-2 sm:gap-2.5">
          {Array.from({ length: totalFrames }).map((_, frameIdx) => {
            const framePutts = putts.slice(frameIdx * puttsPerFrame, (frameIdx + 1) * puttsPerFrame);
            const isCurrent = frameIdx === currentFrameIndex;
            const isCompleted = framePutts.length === puttsPerFrame;
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
                  {Array.from({ length: puttsPerFrame }).map((_, puttIdx) => {
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

      {/* Current Distance - BIG AND CLEAR */}
      <div className="text-center bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100">
        <div className="text-4xl sm:text-5xl font-bold text-slate-800">{currentDistance}m</div>
      </div>

      {/* Current Frame Detail */}
      {currentFrameIndex < totalFrames && (
        <div className="bg-white rounded-2xl p-2 sm:p-3 shadow-sm border border-slate-100">
          <div className="flex gap-2">
            {Array.from({ length: puttsPerFrame }).map((_, idx) => {
              const putt = currentFramePutts[idx];
              return (
                <div
                  key={idx}
                  className={`flex-1 h-2.5 sm:h-3 rounded-full ${
                    putt?.result === 'made'
                      ? 'bg-emerald-500'
                      : putt?.result === 'missed'
                      ? 'bg-red-400'
                      : 'bg-slate-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {currentFrameIndex < totalFrames && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Button
            onClick={(event) => {
              onMissed();
              event.currentTarget.blur();
            }}
            className="h-20 sm:h-24 bg-red-100 [@media(hover:hover)]:hover:bg-red-200 text-red-700 text-lg sm:text-xl font-bold rounded-2xl"
            variant="ghost"
          >
            <XCircle className="w-6 h-6 sm:w-7 sm:h-7 mr-2" />
            {t('player.miss', 'Mööda')}
          </Button>
          <Button
            onClick={(event) => {
              onMade();
              event.currentTarget.blur();
            }}
            className="h-20 sm:h-24 bg-emerald-100 [@media(hover:hover)]:hover:bg-emerald-200 text-emerald-700 text-lg sm:text-xl font-bold rounded-2xl"
            variant="ghost"
          >
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 mr-2" />
            {t('player.sees', 'Sees')}
          </Button>
        </div>
      )}

      {canUndo && (
        <Button
          onClick={onUndo}
          variant="outline"
          className="w-full h-12 sm:h-14 rounded-xl text-sm sm:text-base"
        >
          <Undo2 className="w-5 h-5 mr-2" />
          {t('player.undo_last', 'Võta viimane tagasi')}
        </Button>
      )}
    </div>
  );
}
