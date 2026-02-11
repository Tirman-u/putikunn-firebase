import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Calendar, MonitorPlay } from 'lucide-react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import LoadingState from '@/components/ui/loading-state';
import BackButton from '@/components/ui/back-button';

export default function GroupResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupId = searchParams.get('id');

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      return base44.entities.GameGroup.get(groupId);
    },
    enabled: !!groupId
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['group-games', groupId],
    queryFn: async () => {
      const gameIds = group?.game_ids || [];
      if (!gameIds.length) return [];
      return base44.entities.Game.filter({ id: { $in: gameIds } });
    },
    enabled: !!group
  });

  if (groupLoading || gamesLoading || !group) {
    return <LoadingState />;
  }

  // Calculate group statistics
  const playerScores = {};
  const playerGamesCount = {};
  let totalPutts = 0;
  let madePutts = 0;
  const allGameBestScores = [];

  games.forEach(game => {
    // Get the best individual player score for this game
    const gameBestScore = Object.values(game.total_points || {}).length > 0
      ? Math.max(...Object.values(game.total_points || {}))
      : 0;
    allGameBestScores.push(gameBestScore);
    
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
  const bestScore = allGameBestScores.length > 0 ? Math.max(...allGameBestScores) : 0;
  const avgScore = allGameBestScores.length > 0 ? Math.round(allGameBestScores.reduce((sum, s) => sum + s, 0) / allGameBestScores.length) : 0;

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
    const bestScore = Object.values(game.total_points || {}).length > 0 
      ? Math.max(...Object.values(game.total_points || {})) 
      : 0;

    return {
      ...game,
      formatName: format.name,
      puttingPercentage,
      bestScore
    };
  }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-slate-800">{group.name}</h1>
          <Link
            to={`${createPageUrl('GroupProjector')}?id=${group.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-emerald-200 hover:text-emerald-700"
          >
            <MonitorPlay className="w-4 h-4" />
            Projektor
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Group Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Grupi kokkuvõte</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                  <div className="text-sm text-emerald-700 mb-1">Parim tulemus</div>
                  <div className="text-3xl font-bold text-emerald-600">{bestScore}</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <div className="text-sm text-amber-700 mb-1">Keskmine tulemus</div>
                  <div className="text-3xl font-bold text-amber-600">{avgScore}</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-sm text-slate-600 mb-1">Keskmine täpsus</div>
                  <div className="text-3xl font-bold text-slate-700">{avgPuttingPercentage}%</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-sm text-slate-600 mb-1">Mänge</div>
                  <div className="text-3xl font-bold text-slate-700">{games.length}</div>
                </div>
              </div>
            </div>

            {/* Games List */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-3">Mängud grupis</h2>
              {gamesWithStats.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                  Grupi mänge pole
                </div>
              ) : (
                <div className="space-y-3">
                  {gamesWithStats.map(game => (
                    <Link
                      key={game.id}
                      to={`${createPageUrl('GameResult')}?id=${game.id}&from=group&groupId=${groupId}`}
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
                            {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'Kuupäev puudub'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-600">{game.bestScore}</div>
                          <div className="text-xs text-slate-500">{game.puttingPercentage}% sees</div>
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
                Grupi edetabel
              </h2>
              {playerRanking.length === 0 ? (
                <div className="text-center text-slate-400 py-8">Mängijaid veel pole</div>
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
                          <div className="text-xs text-slate-500">{player.gamesPlayed} mängu</div>
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
