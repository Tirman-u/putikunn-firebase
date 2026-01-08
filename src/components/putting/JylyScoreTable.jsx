import React from 'react';
import { Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISTANCE_COLORS = {
  5: 'bg-red-100 text-red-700 border-red-200',
  6: 'bg-orange-100 text-orange-700 border-orange-200',
  7: 'bg-amber-100 text-amber-700 border-amber-200',
  8: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  9: 'bg-lime-100 text-lime-700 border-lime-200',
  10: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

export default function JylyScoreTable({ players, roundScores, totalPoints, playerDistances, currentRound }) {
  // Sort players by total points (descending)
  const sortedPlayers = [...(players || [])].sort((a, b) => 
    (totalPoints?.[b] || 0) - (totalPoints?.[a] || 0)
  );

  // Get rounds array for headers (up to 20)
  const rounds = Array.from({ length: Math.min(currentRound - 1, 20) }, (_, i) => i + 1);

  if (!players || players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Target className="w-12 h-12 mb-3 opacity-50" />
        <p>No players yet</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-emerald-800/20">
            <th className="text-left py-4 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold sticky left-0 bg-white z-10">
              Player
            </th>
            {rounds.map((round) => (
              <th key={round} className="text-center py-4 px-2 text-xs uppercase tracking-wider text-slate-500 font-semibold min-w-[60px]">
                R{round}
              </th>
            ))}
            <th className="text-center py-4 px-3 text-xs uppercase tracking-wider text-emerald-700 font-bold sticky right-0 bg-white z-10">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player, index) => {
            const playerRounds = roundScores?.[player] || [];
            const total = totalPoints?.[player] || 0;
            const currentDist = playerDistances?.[player] || 10;
            const isLeader = index === 0 && total > 0;

            return (
              <tr 
                key={player} 
                className={cn(
                  "border-b border-slate-100 transition-colors",
                  isLeader && "bg-gradient-to-r from-amber-50/80 to-transparent"
                )}
              >
                <td className="py-4 px-3 sticky left-0 bg-white z-10">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {isLeader && (
                        <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <span className={cn(
                        "font-semibold text-slate-800",
                        isLeader && "text-amber-700"
                      )}>
                        {player}
                      </span>
                    </div>
                    <div className={cn(
                      "text-[10px] px-2 py-0.5 rounded border font-medium w-fit",
                      DISTANCE_COLORS[currentDist]
                    )}>
                      {currentDist}m
                    </div>
                  </div>
                </td>
                {rounds.map((round) => {
                  const roundData = playerRounds[round - 1];
                  return (
                    <td key={round} className="text-center py-4 px-2">
                      {roundData ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold",
                            roundData.made === 5
                              ? "bg-emerald-500 text-white shadow-md"
                              : roundData.made >= 3
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          )}>
                            {roundData.points}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {roundData.made}/5 • {roundData.distance}m
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center py-4 px-3 sticky right-0 bg-white z-10">
                  <span className={cn(
                    "text-2xl font-bold",
                    isLeader ? "text-amber-600" : "text-emerald-700"
                  )}>
                    {total}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}