import React, { useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import useRealtimeGame from '@/hooks/use-realtime-game';

export default function MobileLeaderboard({ game, onClose }) {
  const [liveGame, setLiveGame] = useState(game);

  useRealtimeGame({
    gameId: game?.id,
    enabled: !!game?.id,
    throttleMs: 1000,
    eventTypes: ['update'],
    onEvent: (event) => {
      setLiveGame(event.data);
    }
  });

  const currentGame = liveGame || game;
  if (!currentGame) return null;

  const playerStats = currentGame.players.map(player => {
    const putts = currentGame.player_putts?.[player] || [];
    const totalPutts = putts.length;
    const madePutts = putts.filter(p => p.result === 'made').length;
    const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
    const totalPoints = currentGame.total_points?.[player] || 0;
    const potentialMaxScore = currentGame.live_stats?.[player]?.potential_max_score;

    return {
      name: player,
      totalPoints,
      potentialMaxScore,
      puttingPercentage,
      totalPutts,
      madePutts
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Edetabel
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          {playerStats.map((player, index) => (
            <div
              key={player.name}
              className={cn(
                "p-4 rounded-xl",
                index === 0
                  ? "bg-gradient-to-r from-amber-50 to-amber-100 border-2 border-amber-200"
                  : "bg-slate-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                  index === 0
                    ? "bg-amber-500 text-white"
                    : index === 1
                    ? "bg-slate-300 text-slate-700"
                    : index === 2
                    ? "bg-orange-300 text-orange-800"
                    : "bg-slate-200 text-slate-600"
                )}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{player.name}</div>
                  <div className="text-xs text-slate-500">
                    {player.madePutts}/{player.totalPutts} • {player.puttingPercentage}%
                    {player.potentialMaxScore !== undefined ? ` • Max ${player.potentialMaxScore}` : ''}
                  </div>
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  index === 0 ? "text-amber-600" : "text-slate-700"
                )}>
                  {player.totalPoints}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
