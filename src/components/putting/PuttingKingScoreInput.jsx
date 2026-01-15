import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PuttingKingScoreInput({ 
  match, 
  tournament, 
  distances, 
  onScore,
  getPlayerName 
}) {
  const [manualScoreA, setManualScoreA] = useState('');
  const [manualScoreB, setManualScoreB] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleManualScoreSubmit = () => {
    const scoreA = parseInt(manualScoreA);
    const scoreB = parseInt(manualScoreB);
    
    if (isNaN(scoreA) || isNaN(scoreB)) {
      return;
    }

    onScore({ 
      finalScoreA: scoreA, 
      finalScoreB: scoreB,
      isManual: true 
    });

    setManualScoreA('');
    setManualScoreB('');
    setShowManualInput(false);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-purple-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">Score Match</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowManualInput(!showManualInput)}
        >
          {showManualInput ? 'Putt-by-putt' : 'Enter Final Score'}
        </Button>
      </div>

      {showManualInput ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-purple-600 font-semibold mb-1">Team A Score</div>
              <Input
                type="number"
                value={manualScoreA}
                onChange={(e) => setManualScoreA(e.target.value)}
                placeholder="0"
                className="text-center"
              />
            </div>
            <div>
              <div className="text-xs text-blue-600 font-semibold mb-1">Team B Score</div>
              <Input
                type="number"
                value={manualScoreB}
                onChange={(e) => setManualScoreB(e.target.value)}
                placeholder="0"
                className="text-center"
              />
            </div>
          </div>
          <Button
            onClick={handleManualScoreSubmit}
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={!manualScoreA || !manualScoreB}
          >
            Submit Final Score
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Team A */}
          <div>
            <div className="text-xs font-semibold text-purple-600 mb-2">
              Team A: {match.team_a_players.map(e => getPlayerName(e)).join(', ')}
            </div>
            <div className="space-y-2">
              {distances.map(distance => (
                <div key={distance.id} className="flex items-center gap-2">
                  <div className="flex-1 text-xs font-medium text-slate-700">
                    {distance.label} ({distance.points_for_made > 0 ? '+' : ''}{distance.points_for_made})
                  </div>
                  <Button
                    onClick={() => onScore({ team: 'A', distance, made: true })}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex-1 text-xs h-8"
                  >
                    Made
                  </Button>
                  <Button
                    onClick={() => onScore({ team: 'A', distance, made: false })}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                  >
                    Miss
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Team B */}
          <div>
            <div className="text-xs font-semibold text-blue-600 mb-2">
              Team B: {match.team_b_players.map(e => getPlayerName(e)).join(', ')}
            </div>
            <div className="space-y-2">
              {distances.map(distance => (
                <div key={distance.id} className="flex items-center gap-2">
                  <div className="flex-1 text-xs font-medium text-slate-700">
                    {distance.label} ({distance.points_for_made > 0 ? '+' : ''}{distance.points_for_made})
                  </div>
                  <Button
                    onClick={() => onScore({ team: 'B', distance, made: true })}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex-1 text-xs h-8"
                  >
                    Made
                  </Button>
                  <Button
                    onClick={() => onScore({ team: 'B', distance, made: false })}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                  >
                    Miss
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between text-sm">
          <div className="text-purple-600 font-bold">Team A: {match.score_a}</div>
          <div className="text-blue-600 font-bold">Team B: {match.score_b}</div>
        </div>
      </div>
    </div>
  );
}