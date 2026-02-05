import React from 'react';
import { cn } from '@/lib/utils';
import { GAME_FORMATS, getTotalRounds } from './gameRules';

export default function ProgressBar({ putts, gameType }) {
  const format = GAME_FORMATS[gameType] || GAME_FORMATS.classic;
  const totalRounds = getTotalRounds(gameType);
  const puttsPerRound = format.puttsPerRound || 5;
  
  // Group putts into rounds
  const rounds = [];
  for (let i = 0; i < totalRounds; i++) {
    const startIdx = i * puttsPerRound;
    const roundPutts = putts.slice(startIdx, startIdx + puttsPerRound);
    rounds.push(roundPutts);
  }

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <div className="flex items-center gap-1 flex-wrap">
        {rounds.map((round, roundIdx) => (
          <div key={roundIdx} className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((puttIdx) => {
              const putt = round[puttIdx];
              return (
                <div
                  key={puttIdx}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    !putt
                      ? "bg-slate-200"
                      : putt.result === 'made'
                      ? "bg-emerald-500"
                      : "bg-red-400"
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
