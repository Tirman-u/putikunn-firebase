import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, TrendingUp, Award, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: games = [] } = useQuery({
    queryKey: ['my-participated-games'],
    queryFn: async () => {
      const allGames = await base44.entities.Game.list();
      return allGames.filter(g => 
        g.players?.includes(user?.full_name) || 
        g.host_user === user?.email
      );
    },
    enabled: !!user
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['game-groups'],
    queryFn: async () => {
      const allGroups = await base44.entities.GameGroup.list();
      return allGroups.filter(g => g.created_by === user?.email);
    },
    enabled: !!user
  });

  // Calculate statistics
  const myName = user?.full_name;
  
  // Calculate overall putting percentage from all games
  const myGames = games.filter(g => g.players?.includes(myName));
  const allPutts = myGames.flatMap(g => g.player_putts?.[myName] || []);
  const totalPutts = allPutts.length;
  const madePutts = allPutts.filter(p => p.result === 'made').length;
  const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;

  // Distance analysis
  const distanceStats = allPutts.reduce((acc, putt) => {
    const dist = putt.distance;
    if (!acc[dist]) acc[dist] = { made: 0, attempts: 0 };
    if (putt.result === 'made') acc[dist].made += 1;
    acc[dist].attempts += 1;
    return acc;
  }, {});

  const distancePercentages = Object.entries(distanceStats).map(([dist, stats]) => ({
    distance: parseInt(dist),
    percentage: (stats.made / stats.attempts * 100).toFixed(1),
    attempts: stats.attempts
  })).sort((a, b) => a.distance - b.distance);

  const sweetSpot = distancePercentages.length > 0
    ? distancePercentages.reduce((best, curr) => 
        parseFloat(curr.percentage) > parseFloat(best.percentage) ? curr : best
      )
    : null;

  const challengeArea = distancePercentages.length > 0
    ? distancePercentages.reduce((worst, curr) => 
        parseFloat(curr.percentage) < parseFloat(worst.percentage) ? curr : worst
      )
    : null;

  // Group game stats
  const groupGames = games.filter(g => g.group_id);
  const groupScores = groupGames
    .filter(g => g.players?.includes(myName))
    .map(g => g.total_points?.[myName] || 0);
  const avgGroupScore = groupScores.length > 0
    ? (groupScores.reduce((sum, s) => sum + s, 0) / groupScores.length).toFixed(1)
    : 0;
  const bestScore = groupScores.length > 0 ? Math.max(...groupScores) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <Link to={createPageUrl('Home')} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">My Dashboard</h1>
          <div className="w-16" />
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="text-sm text-slate-500 mb-1">Total Games</div>
            <div className="text-4xl font-bold text-emerald-600">{games.length}</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="text-sm text-slate-500 mb-1">Putting %</div>
            <div className="text-4xl font-bold text-emerald-600">{puttingPercentage}%</div>
          </div>
        </div>

        {/* Analytics */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Performance Analysis
          </h2>
          
          {sweetSpot && (
            <div className="mb-4 p-4 bg-emerald-50 rounded-xl">
              <div className="text-sm text-emerald-700 font-semibold mb-1">Sweet Spot</div>
              <div className="text-2xl font-bold text-emerald-600">
                {sweetSpot.distance}m • {sweetSpot.percentage}%
              </div>
              <div className="text-xs text-emerald-600">{sweetSpot.attempts} attempts</div>
            </div>
          )}

          {challengeArea && (
            <div className="mb-4 p-4 bg-amber-50 rounded-xl">
              <div className="text-sm text-amber-700 font-semibold mb-1">Challenge Area</div>
              <div className="text-2xl font-bold text-amber-600">
                {challengeArea.distance}m • {challengeArea.percentage}%
              </div>
              <div className="text-xs text-amber-600">{challengeArea.attempts} attempts</div>
            </div>
          )}

          {/* Distance Breakdown */}
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Distance Performance</div>
            <div className="space-y-2">
              {distancePercentages.map((stat) => (
                <div key={stat.distance} className="flex items-center gap-3">
                  <div className="w-12 text-sm font-medium text-slate-600">{stat.distance}m</div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm font-medium text-slate-700 text-right">
                    {stat.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* League Stats */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Group Game Stats
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Average Score</div>
              <div className="text-3xl font-bold text-slate-700">{avgGroupScore}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Best Score</div>
              <div className="text-3xl font-bold text-emerald-600">{bestScore}</div>
            </div>
          </div>
        </div>

        {/* Games History Table */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Game History</h2>
          {myGames.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No games yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Date</th>
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Format</th>
                    <th className="text-right py-3 px-2 text-slate-600 font-semibold">Score</th>
                    <th className="text-right py-3 px-2 text-slate-600 font-semibold">%</th>
                    <th className="text-right py-3 px-2 text-slate-600 font-semibold">Putts</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {myGames
                    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                    .map((game) => {
                      const putts = game.player_putts?.[myName] || [];
                      const made = putts.filter(p => p.result === 'made').length;
                      const percentage = putts.length > 0 ? ((made / putts.length) * 100).toFixed(0) : 0;
                      const score = game.total_points?.[myName] || 0;
                      const gameFormat = GAME_FORMATS[game.game_type || 'classic'];
                      
                      return (
                        <tr key={game.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-2 text-slate-700">
                            {game.date ? format(new Date(game.date), 'MMM d') : '-'}
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                              {gameFormat.name}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-emerald-600">
                            {score}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-700">
                            {percentage}%
                          </td>
                          <td className="py-3 px-2 text-right text-slate-500">
                            {made}/{putts.length}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Link
                              to={`${createPageUrl('GameResult')}?id=${game.id}`}
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}