import React from 'react';
import { Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ScoreTable({ players, scores, currentRound, puttsPerRound = 10 }) {
  // Calculate totals for each player
  const getPlayerTotal = (playerName) => {
    const playerScores = scores?.[playerName] || [];
    return playerScores.reduce((sum, score) => sum + (score || 0), 0);
  };

  // Get max possible score
  const maxPossible = (currentRound || 0) * puttsPerRound;

  // Sort players by total score (descending)
  const sortedPlayers = [...(players || [])].sort((a, b) => 
    getPlayerTotal(b) - getPlayerTotal(a)
  );

  // Get rounds array for headers
  const rounds = Array.from({ length: currentRound || 0 }, (_, i) => i + 1);

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
              <th key={round} className="text-center py-4 px-2 text-xs uppercase tracking-wider text-slate-500 font-semibold min-w-[50px]">
                R{round}
              </th>
            ))}
            <th className="text-center py-4 px-3 text-xs uppercase tracking-wider text-emerald-700 font-bold">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player, index) => {
            const playerScores = scores?.[player] || [];
            const total = getPlayerTotal(player);
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
                  <div className="flex items-center gap-2">
                    {isLeader && (
                      <Trophy className="w-4 h-4 text-amber-500" />
                    )}
                    <span className={cn(
                      "font-semibold text-slate-800",
                      isLeader && "text-amber-700"
                    )}>
                      {player}
                    </span>
                  </div>
                </td>
                {rounds.map((round) => (
                  <td key={round} className="text-center py-4 px-2">
                    <span className={cn(
                      "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium",
                      playerScores[round - 1] === puttsPerRound 
                        ? "bg-emerald-100 text-emerald-700" 
                        : playerScores[round - 1] >= puttsPerRound * 0.7
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-50 text-slate-600"
                    )}>
                      {playerScores[round - 1] ?? '-'}
                    </span>
                  </td>
                ))}
                <td className="text-center py-4 px-3">
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-xl font-bold",
                      isLeader ? "text-amber-600" : "text-emerald-700"
                    )}>
                      {total}
                    </span>
                    {maxPossible > 0 && (
                      <span className="text-[10px] text-slate-400">
                        /{maxPossible}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}