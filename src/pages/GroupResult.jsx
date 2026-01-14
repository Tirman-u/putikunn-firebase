import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Target, Calendar } from 'lucide-react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';

export default function GroupResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupId = searchParams.get('id');

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const groups = await base44.entities.GameGroup.list();
      return groups.find(g => g.id === groupId);
    },
    enabled: !!groupId
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['group-games', groupId],
    queryFn: async () => {
      const allGames = await base44.entities.Game.list();
      return allGames.filter(g => group?.game_ids?.includes(g.id));
    },
    enabled: !!group
  });

  if (groupLoading || gamesLoading || !group) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Calculate group statistics
  const playerScores = {};
  const playerGamesCount = {};
  let totalPutts = 0;
  let madePutts = 0;
  const allGameScores = [];

  games.forEach(game => {
    const gameTotal = Object.values(game.total_points || {}).reduce((sum, pts) => sum + pts, 0);
    allGameScores.push(gameTotal);
    
    game.players?.forEach(player => {
      const points = game.total_points?.[player] || 0;
      const putts = game.player_putts?.[player] || [];
      
      if (!playerScores[player]) {
        playerScores[player] = 0;
        playerGamesCount[player] = 0;
      }
      
      playerScores[player] += points;
      playerGamesCount[player] += 1;
      totalPutts += putts.length;
      madePutts += putts.filter(p => p.result === 'made').length;
    });
  });

  const avgPuttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
  const bestScore = allGameScores.length > 0 ? Math.max(...allGameScores) : 0;
  const avgScore = allGameScores.length > 0 ? Math.round(allGameScores.reduce((sum, s) => sum + s, 0) / allGameScores.length) : 0;

  // Player ranking
  const playerRanking = Object.entries(playerScores)
    .map(([name, score]) => ({
      name,
      totalPoints: score,
      gamesPlayed: playerGamesCount[name]
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Games with stats
  const gamesWithStats = games.map(game => {
    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    
    let totalPutts = 0;
    let madePutts = 0;
    game.players?.forEach(player => {
      const putts = game.player_putts?.[player] || [];
      totalPutts += putts.length;
      madePutts += putts.filter(p => p.result === 'made').length;
    });
    
    const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
    const totalScore = Object.values(game.total_points || {}).reduce((sum, pts) => sum + pts, 0);

    return {
      ...game,
      formatName: format.name,
      puttingPercentage,
      totalScore
    };
  }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{group.name}</h1>
          <div className="w-16" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Group Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Group Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                  <div className="text-sm text-emerald-700 mb-1">Best Score</div>
                  <div className="text-3xl font-bold text-emerald-600">{bestScore}</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <div className="text-sm text-amber-700 mb-1">Avg Score</div>
                  <div className="text-3xl font-bold text-amber-600">{avgScore}</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-sm text-slate-600 mb-1">Avg Putting %</div>
                  <div className="text-3xl font-bold text-slate-700">{avgPuttingPercentage}%</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-sm text-slate-600 mb-1">Games</div>
                  <div className="text-3xl font-bold text-slate-700">{games.length}</div>
                </div>
              </div>
            </div>

            {/* Games List */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-3">Games in Group</h2>
              {gamesWithStats.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                  No games in this group
                </div>
              ) : (
                <div className="space-y-3">
                  {gamesWithStats.map(game => (
                    <Link
                      key={game.id}
                      to={`${createPageUrl('GameResult')}?id=${game.id}`}
                      className="block bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800">{game.name}</span>
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                              {game.formatName}
                            </span>
                          </div>
                          <div className="text-sm text-slate-500 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'No date'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-600">{game.totalScore}</div>
                          <div className="text-xs text-slate-500">{game.puttingPercentage}% made</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Player Ranking Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-4">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Group Ranking
              </h2>
              {playerRanking.length === 0 ? (
                <div className="text-center text-slate-400 py-8">No players yet</div>
              ) : (
                <div className="space-y-2">
                  {playerRanking.map((player, index) => (
                    <div
                      key={player.name}
                      className={`p-3 rounded-xl transition-all ${
                        index === 0
                          ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-2 border-amber-200'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-slate-800">{player.name}</div>
                          <div className="text-xs text-slate-500">{player.gamesPlayed} games</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${
                            index === 0 ? 'text-amber-600' : 'text-slate-700'
                          }`}>
                            {player.totalPoints}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}