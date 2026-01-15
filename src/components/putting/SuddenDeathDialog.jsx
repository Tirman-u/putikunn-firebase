import React from 'react';
import { Button } from '@/components/ui/button';

export default function SuddenDeathDialog({ match, onSelectWinner, getPlayerName }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Sudden Death!</h2>
        <p className="text-slate-600 mb-4">
          Match ended in a tie {match.score_a}-{match.score_b}. Who won sudden death?
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => onSelectWinner('A')}
            className="w-full bg-purple-600 hover:bg-purple-700 h-auto py-4"
          >
            <div>
              <div className="font-bold text-lg">Team A</div>
              <div className="text-xs opacity-90">
                {match.team_a_players.map(e => getPlayerName(e)).join(', ')}
              </div>
            </div>
          </Button>

          <Button
            onClick={() => onSelectWinner('B')}
            className="w-full bg-blue-600 hover:bg-blue-700 h-auto py-4"
          >
            <div>
              <div className="font-bold text-lg">Team B</div>
              <div className="text-xs opacity-90">
                {match.team_b_players.map(e => getPlayerName(e)).join(', ')}
              </div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}