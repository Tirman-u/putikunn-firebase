import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogIn, Clock, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { GAME_FORMATS } from './gameRules';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
      <div className="max-w-lg mx-auto pt-6 pb-12">
        {/* Back Button */}
        <div className="mb-6 flex items-center gap-2">
          <BackButton onClick={onBack} />
          <HomeButton />
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm space-y-4 dark:bg-black dark:border-white/10">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Sinu nimi</label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Sisesta nimi"
              className="mt-2 h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Mängu PIN</label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="Sisesta 4-kohaline PIN"
              className="mt-2 h-12 rounded-2xl border border-slate-200 bg-white px-4 text-center text-xl font-bold tracking-widest text-slate-800 focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
              maxLength={4}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <Button
            onClick={handleJoin}
            disabled={loading || !pin.trim() || !playerName.trim()}
            className="w-full h-12 rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Liitu mänguga
          </Button>
        </div>

        {/* Recent Games */}
        {recentGames.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2 dark:text-slate-200">
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
                    className="w-full rounded-2xl border border-white/70 bg-white/70 p-3 text-left shadow-sm backdrop-blur-sm transition hover:bg-emerald-50/80 dark:bg-black dark:border-white/10 dark:hover:bg-black"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800 text-sm dark:text-slate-100">{game.name}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded dark:bg-emerald-500/10 dark:text-emerald-300">
                            {getGameTypeName(game.game_type)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'Kuupäev puudub'}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Users className="w-3 h-3" />
                            {playerCount} {playerCount === 1 ? 'mängija' : 'mängijat'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 bg-white/70 rounded font-mono text-slate-700 dark:bg-black dark:text-slate-200">
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
