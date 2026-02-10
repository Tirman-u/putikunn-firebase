import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogIn, Clock, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { GAME_FORMATS } from './gameRules';
import BackButton from '@/components/ui/back-button';

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
      const activeGames = await base44.entities.Game.filter({
        status: { $in: ['setup', 'active'] }
      }, '-date', 10);
      return activeGames.filter(g =>
        g.pin !== null &&
        g.pin !== '0000' &&
        g.join_closed !== true &&
        g.status !== 'closed'
      );
    },
    enabled: !!user,
    refetchInterval: false
  });

  // Realtime updates removed to keep Firestore read usage low.

  useEffect(() => {
    if (!user) return;
    if (!playerName.trim()) {
      setPlayerName(user?.display_name || user?.full_name || user?.email || '');
    }
  }, [playerName, user]);

  const getGameTypeName = (type) => {
    const names = {
      classic: 'Classic',
      back_and_forth: 'Back & Forth',
      short: 'Short',
      long: 'Long',
      streak_challenge: 'Streak',
      random_distance: 'Random',
      around_the_world: 'Around The World'
    };
    return names[type] || 'Classic';
  };

  const getPlayerCount = (game) => {
    if (!game) return 0;
    return (
      game.players?.length ||
      Object.keys(game.player_putts || {}).length ||
      Object.keys(game.atw_state || {}).length ||
      0
    );
  };

  const handleJoin = async () => {
    if (!pin.trim() || !playerName.trim()) {
      setError('Sisesta PIN ja oma nimi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Find game by PIN
      const games = await base44.entities.Game.filter({ pin: pin.trim() });
      
      if (games.length === 0) {
        setError('Mängu ei leitud. Kontrolli PIN-i.');
        setLoading(false);
        return;
      }

      const game = games[0];

      if (game.join_closed === true || game.status === 'closed') {
        setError('Mäng on hosti poolt suletud.');
        setLoading(false);
        return;
      }

      // Check if player already exists
      if (game.players.includes(playerName.trim())) {
        // Player already exists, ensure uid/email mapping is stored
        if (user?.id || user?.email) {
          const updatedPlayerUids = {
            ...(game.player_uids || {}),
            ...(user?.id ? { [playerName.trim()]: user.id } : {})
          };
          const updatedPlayerEmails = {
            ...(game.player_emails || {}),
            ...(user?.email ? { [playerName.trim()]: user.email } : {})
          };
          const updatedGame = await base44.entities.Game.update(game.id, {
            player_uids: updatedPlayerUids,
            player_emails: updatedPlayerEmails
          });
          onJoin({ game: updatedGame, playerName: playerName.trim() });
        } else {
          onJoin({ game, playerName: playerName.trim() });
        }
      } else {
        // Add player to game
        const gameType = game.game_type || 'classic';
        const format = GAME_FORMATS[gameType];
        const startDistance = format.startDistance;

        const updatedPlayers = [...game.players, playerName.trim()];
        const updatedDistances = { ...game.player_distances, [playerName.trim()]: startDistance };
        const updatedPutts = { ...game.player_putts, [playerName.trim()]: [] };
        const updatedPoints = { ...game.total_points, [playerName.trim()]: 0 };
        const updatedPlayerUids = {
          ...(game.player_uids || {}),
          ...(user?.id ? { [playerName.trim()]: user.id } : {})
        };
        const updatedPlayerEmails = {
          ...(game.player_emails || {}),
          ...(user?.email ? { [playerName.trim()]: user.email } : {})
        };

        const updateData = {
          players: updatedPlayers,
          player_distances: updatedDistances,
          player_putts: updatedPutts,
          total_points: updatedPoints,
          player_uids: updatedPlayerUids,
          player_emails: updatedPlayerEmails
        };

        // For ATW games, initialize player state
        if (gameType === 'around_the_world') {
          updateData.atw_state = {
            ...game.atw_state,
            [playerName.trim()]: {
              current_distance_index: 0,
              direction: 'UP',
              laps_completed: 0,
              turns_played: 0,
              total_makes: 0,
              total_putts: 0,
              current_distance_points: 0,
              current_round_draft: { attempts: [], is_finalized: false },
              history: [],
              best_score: 0,
              best_laps: 0,
              best_accuracy: 0,
              attempts_count: 0
            }
          };
        }

        const updatedGame = await base44.entities.Game.update(game.id, updateData);

        onJoin({ game: updatedGame, playerName: playerName.trim() });
      }
    } catch (err) {
      setError('Mänguga liitumine ebaõnnestus');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-3 sm:p-4">
      <div className="max-w-lg mx-auto pt-3 sm:pt-4">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton onClick={onBack} />
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Sinu nimi
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Sisesta nimi"
              className="h-12 sm:h-14 rounded-xl border-slate-200 text-base sm:text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mängu PIN
            </label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="Sisesta 4-kohaline PIN"
              className="h-12 sm:h-14 rounded-xl border-slate-200 text-center text-xl sm:text-2xl tracking-widest font-bold"
              maxLength={4}
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
            className="w-full h-12 sm:h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-base sm:text-xl font-bold rounded-2xl shadow-lg sm:shadow-xl shadow-emerald-200"
          >
            <LogIn className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
            Liitu mänguga
          </Button>
        </div>

        {/* Recent Games */}
        {recentGames.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Aktiivsed mängud
            </h3>
            <div className="space-y-2">
              {recentGames.map((game) => {
                const playerCount = getPlayerCount(game);
                return (
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
                            {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'Kuupäev puudub'}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Users className="w-3 h-3" />
                            {playerCount} {playerCount === 1 ? 'mängija' : 'mängijat'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 bg-slate-100 rounded font-mono">
                        {game.pin}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
