import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, LogIn, ArrowLeft, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { GAME_FORMATS } from './gameRules';

export default function JoinGame({ onJoin, onBack }) {
  const [pin, setPin] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: recentGames = [] } = useQuery({
    queryKey: ['recent-games'],
    queryFn: async () => {
      const allGames = await base44.entities.Game.list();
      const activeGames = allGames
        .filter(g => g.status !== 'completed' && g.pin !== null)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 10);
      return activeGames;
    },
    enabled: !!user
  });

  const getGameTypeName = (type) => {
    const names = {
      classic: 'Classic',
      back_and_forth: 'Back & Forth',
      short: 'Short',
      long: 'Long',
      streak_challenge: 'Streak',
      random_distance: 'Random'
    };
    return names[type] || 'Classic';
  };

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
        const gameType = game.game_type || 'classic';
        const format = GAME_FORMATS[gameType];
        const startDistance = format.startDistance;

        const updatedPlayers = [...game.players, playerName.trim()];
        const updatedDistances = { ...game.player_distances, [playerName.trim()]: startDistance };
        const updatedPutts = { ...game.player_putts, [playerName.trim()]: [] };
        const updatedPoints = { ...game.total_points, [playerName.trim()]: 0 };

        const updatedGame = await base44.entities.Game.update(game.id, {
          players: updatedPlayers,
          player_distances: updatedDistances,
          player_putts: updatedPutts,
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
      <div className="max-w-lg mx-auto pt-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Join Jyly Game</h1>
          <p className="text-sm text-slate-500">Enter PIN to join the session</p>
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

        {/* Recent Games */}
        {recentGames.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Active Games
            </h3>
            <div className="space-y-2">
              {recentGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setPin(game.pin);
                    setPlayerName(user?.full_name || '');
                  }}
                  className="w-full bg-white rounded-xl p-3 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{game.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                          {getGameTypeName(game.game_type)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'No date'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 bg-slate-100 rounded font-mono">
                      {game.pin}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}