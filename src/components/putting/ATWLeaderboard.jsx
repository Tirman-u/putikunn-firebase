import React from 'react';
import { Trophy, Target } from 'lucide-react';

export default function ATWLeaderboard({ game }) {
  const playerStats = Object.entries(game.atw_state || {}).map(([playerName, state]) => {
    const totalScore = game.total_points?.[playerName] || 0;
    const accuracy = state.total_putts > 0 
      ? ((state.total_makes / state.total_putts) * 100).toFixed(1)
      : 0;
    
    return {
      name: playerName,
      score: totalScore,
      laps: state.laps_completed || 0,
      accuracy: parseFloat(accuracy),
      totalPutts: state.total_putts || 0,
      totalMakes: state.total_makes || 0
    };
  }).sort((a, b) => b.score - a.score);

  const bestScore = Math.max(...playerStats.map(p => p.score), 0);
  const bestLaps = Math.max(...playerStats.map(p => p.laps), 0);
  const bestAccuracy = Math.max(...playerStats.map(p => p.accuracy), 0);
  
  const bestScorePlayer = playerStats.find(p => p.score === bestScore);
  const bestLapsPlayer = playerStats.find(p => p.laps === bestLaps);
  const bestAccuracyPlayer = playerStats.find(p => p.accuracy === bestAccuracy);

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <div className="flex justify-center mb-2">
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{bestScore}</div>
          <div className="text-xs text-slate-500 mt-1">Best Score</div>
          <div className="text-xs text-slate-600 font-medium mt-1">
            {bestScorePlayer?.name}
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <div className="flex justify-center mb-2">
            <RotateCcw className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{bestLaps}</div>
          <div className="text-xs text-slate-500 mt-1">Most Laps</div>
          <div className="text-xs text-slate-600 font-medium mt-1">
            {bestLapsPlayer?.name}
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <div className="flex justify-center mb-2">
            <Target className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600">{bestAccuracy}%</div>
          <div className="text-xs text-slate-500 mt-1">Best Accuracy</div>
          <div className="text-xs text-slate-600 font-medium mt-1">
            {bestAccuracyPlayer?.name}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left p-4 font-semibold text-slate-700">#</th>
              <th className="text-left p-4 font-semibold text-slate-700">Player</th>
              <th className="text-center p-4 font-semibold text-slate-700">Score</th>
              <th className="text-center p-4 font-semibold text-slate-700">Laps</th>
              <th className="text-center p-4 font-semibold text-slate-700">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map((player, index) => (
              <tr key={player.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="p-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-slate-200 text-slate-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {index + 1}
                  </div>
                </td>
                <td className="p-4 font-medium text-slate-800">{player.name}</td>
                <td className="p-4 text-center">
                  <div className="font-bold text-lg text-emerald-600">{player.score}</div>
                </td>
                <td className="p-4 text-center">
                  <div className="font-bold text-lg text-blue-600">{player.laps}</div>
                </td>
                <td className="p-4 text-center">
                  <div className="font-bold text-lg text-purple-600">{player.accuracy}%</div>
                  <div className="text-xs text-slate-500">{player.totalMakes}/{player.totalPutts}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RotateCcw = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);