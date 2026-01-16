import React from 'react';
import { Target } from 'lucide-react';

export default function PerformanceAnalysis({ playerPutts }) {
  // Calculate statistics by distance
  const statsByDistance = {};
  
  playerPutts.forEach(putt => {
    const dist = putt.distance;
    if (!statsByDistance[dist]) {
      statsByDistance[dist] = { made: 0, total: 0 };
    }
    statsByDistance[dist].total += 1;
    if (putt.result === 'made') {
      statsByDistance[dist].made += 1;
    }
  });

  // Calculate percentages
  const distancePerformance = Object.entries(statsByDistance)
    .map(([distance, stats]) => ({
      distance: parseInt(distance),
      percentage: (stats.made / stats.total) * 100,
      made: stats.made,
      total: stats.total
    }))
    .sort((a, b) => a.distance - b.distance);

  // Find sweet spot (best percentage with at least 2 attempts)
  const sweetSpot = distancePerformance
    .filter(d => d.total >= 2)
    .sort((a, b) => b.percentage - a.percentage)[0];

  // Find challenge area (worst percentage with at least 3 attempts)
  const challengeArea = distancePerformance
    .filter(d => d.total >= 3)
    .sort((a, b) => a.percentage - b.percentage)[0];

  if (distancePerformance.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-slate-700" />
        <h2 className="text-lg font-bold text-slate-800">Performance Analysis</h2>
      </div>

      {/* Sweet Spot & Challenge Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {sweetSpot && (
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="text-sm text-emerald-700 font-semibold mb-1">Sweet Spot</div>
            <div className="text-3xl font-bold text-emerald-600 mb-1">
              {sweetSpot.distance}m • {sweetSpot.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-emerald-600">{sweetSpot.total} attempts</div>
          </div>
        )}
        
        {challengeArea && (
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="text-sm text-amber-700 font-semibold mb-1">Challenge Area</div>
            <div className="text-3xl font-bold text-amber-600 mb-1">
              {challengeArea.distance}m • {challengeArea.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-amber-600">{challengeArea.total} attempts</div>
          </div>
        )}
      </div>

      {/* Distance Performance Bars */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Distance Performance</h3>
        <div className="space-y-3">
          {distancePerformance.map(({ distance, percentage, made, total }) => (
            <div key={distance}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">{distance}m</span>
                <span className="text-sm font-bold text-slate-700">{percentage.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{made}/{total} made</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}