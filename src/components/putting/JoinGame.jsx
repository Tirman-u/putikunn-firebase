import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function JoinGame({ onJoin }) {
  const [pin, setPin] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!pin.trim() || !playerName.trim()) {
      setError('Please enter PIN and your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Find game by PIN
      const games = await base44.entities.Game.filter({ pin: pin.trim() });
      
      if (games.length === 0) {
        setError('Game not found. Check the PIN.');
        setLoading(false);
        return;
      }

      const game = games[0];

      // Check if player already exists
      if (game.players.includes(playerName.trim())) {
        // Player already exists, just join
        onJoin({ game, playerName: playerName.trim() });
      } else {
        // Add player to game
        const updatedPlayers = [...game.players, playerName.trim()];
        const updatedDistances = { ...game.player_distances, [playerName.trim()]: 10 };
        const updatedScores = { ...game.round_scores, [playerName.trim()]: [] };
        const updatedPoints = { ...game.total_points, [playerName.trim()]: 0 };

        const updatedGame = await base44.entities.Game.update(game.id, {
          players: updatedPlayers,
          player_distances: updatedDistances,
          round_scores: updatedScores,
          total_points: updatedPoints
        });

        onJoin({ game: updatedGame, playerName: playerName.trim() });
      }
    } catch (err) {
      setError('Failed to join game');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-lg mx-auto pt-16">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200">
            <span className="text-4xl">🥏</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Join Jyly Game</h1>
          <p className="text-slate-500">Enter PIN to join the session</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Game PIN
            </label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="Enter 4-digit PIN"
              className="h-14 rounded-xl border-slate-200 text-center text-2xl tracking-widest font-bold"
              maxLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Your Name
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="h-14 rounded-xl border-slate-200 text-lg"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <Button
            onClick={handleJoin}
            disabled={loading || !pin.trim() || !playerName.trim()}
            className="w-full h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-xl font-bold rounded-2xl shadow-xl shadow-emerald-200"
          >
            <LogIn className="w-6 h-6 mr-3" />
            Join Game
          </Button>
        </div>
      </div>
    </div>
  );
}