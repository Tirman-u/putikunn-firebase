import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Share2, Calendar, Users, Target } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format as formatDate } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';

export default function GameResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameId = searchParams.get('id');
  const queryClient = useQueryClient();

  const { data: game, isLoading, error } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.list();
      const found = games.find(g => g.id === gameId);
      if (!found) throw new Error('Game not found');
      return found;
    },
    enabled: !!gameId,
    retry: false
  });

  const deleteGameMutation = useMutation({
    mutationFn: (id) => base44.entities.Game.delete(id),
    onSuccess: () => {
      navigate(-1);
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-slate-400 mb-4">Game not found</div>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const gameType = game.game_type || 'classic';
  const gameFormat = GAME_FORMATS[gameType];

  // Calculate statistics for each player
  const playerStats = game.players.map(player => {
    const putts = game.player_putts?.[player] || [];
    const totalPutts = putts.length;
    const madePutts = putts.filter(p => p.result === 'made').length;
    const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
    const totalPoints = game.total_points?.[player] || 0;

    // Group putts into frames (5 putts per frame for classic/short/long)
    const frames = [];
    if (!gameFormat.singlePuttMode) {
      for (let i = 0; i < putts.length; i += 5) {
        const framePutts = putts.slice(i, i + 5);
        const distance = framePutts[0]?.distance || 0;
        const made = framePutts.filter(p => p.result === 'made').length;
        frames.push({ distance, made });
      }
    }

    return {
      name: player,
      totalPutts,
      madePutts,
      puttingPercentage,
      totalPoints,
      putts,
      frames
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  const handleShare = () => {
    const shareText = `${game.name} - ${gameFormat.name}\n\nResults:\n${playerStats.map(p => 
      `${p.name}: ${p.totalPoints} pts (${p.puttingPercentage}%)`
    ).join('\n')}`;
    
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Results copied to clipboard!');
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this game? This cannot be undone.')) {
      deleteGameMutation.mutate(game.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{game.name}</h1>
          <div className="w-16" />
        </div>

        {/* Game Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">Format</div>
              <div className="font-bold text-slate-800">{gameFormat.name}</div>
              <div className="text-xs text-slate-500">{gameFormat.minDistance}m - {gameFormat.maxDistance}m</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date
              </div>
              <div className="font-bold text-slate-800">
                {game.date ? formatDate(new Date(game.date), 'MMM d, yyyy') : 'No date'}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleShare} variant="outline" className="flex-1">
              <Share2 className="w-4 h-4 mr-2" />
              Share Results
            </Button>
            <Button onClick={handleDelete} variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Player Results */}
        {!gameFormat.singlePuttMode ? (
          // Table view for classic, short, long formats
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 font-semibold text-slate-700 bg-slate-50 sticky left-0 z-10">Player</th>
                    {[...Array(20)].map((_, i) => (
                      <th key={i} className="text-center p-2 font-semibold text-slate-700 bg-slate-50 text-sm min-w-[60px]">
                        {i + 1}
                      </th>
                    ))}
                    <th className="text-center p-4 font-semibold text-slate-700 bg-slate-50 sticky right-0 z-10">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((player, pIndex) => (
                    <tr key={player.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-4 font-medium text-slate-800 bg-white sticky left-0 z-10 border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                            {pIndex + 1}
                          </div>
                          <span>{player.name}</span>
                        </div>
                      </td>
                      {[...Array(20)].map((_, frameIndex) => {
                        const frame = player.frames[frameIndex];
                        return (
                          <td key={frameIndex} className="p-2 text-center">
                            {frame ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="text-xs text-slate-500 font-medium">{frame.distance}m</div>
                                <div className={`text-base font-bold ${
                                  frame.made === 5 ? 'text-emerald-600' : 
                                  frame.made >= 3 ? 'text-emerald-500' : 
                                  'text-slate-600'
                                }`}>
                                  {frame.made}
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-300">-</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-4 text-center bg-white sticky right-0 z-10 border-l border-slate-100">
                        <div className="font-bold text-lg text-emerald-600">{player.totalPoints}</div>
                        <div className="text-xs text-slate-500">{player.puttingPercentage}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Card view for back & forth format
          <div className="space-y-4">
            {playerStats.map((player, index) => (
              <div key={player.name} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-slate-800">{player.name}</div>
                      <div className="text-sm text-slate-500">
                        {player.totalPutts} putts • {player.madePutts} made
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-emerald-600">{player.totalPoints}</div>
                    <div className="text-sm text-slate-500">{player.puttingPercentage}%</div>
                  </div>
                </div>

                {/* Distance Progression */}
                {player.putts.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-slate-700 mb-2">Distance Progression</div>
                    <div className="flex flex-wrap gap-1">
                      {player.putts.map((putt, idx) => (
                        <div
                          key={idx}
                          className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
                            putt.result === 'made'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {putt.distance}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}