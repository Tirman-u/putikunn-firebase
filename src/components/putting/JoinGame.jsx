import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogIn, Clock, Users, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { GAME_FORMATS } from './gameRules';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { useLanguage } from '@/lib/i18n';
import { createPageUrl } from '@/utils';
import { pickJoinableDuelGame } from '@/lib/duel-game-utils';
import { buildJoinableEntries } from '@/lib/joinable-games';

export default function JoinGame({ onJoin, onBack }) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const {
    data: recentGames = [],
    isLoading: isLoadingRecentGames,
    isError: isRecentGamesError,
    refetch: refetchRecentGames
  } = useQuery({
    queryKey: ['recent-games-v2'],
    queryFn: async () => {
      const [hostedGames, duelGames] = await Promise.all([
        base44.entities.Game.filter({ pin: { $ne: '0000' } }, '-date', 80),
        base44.entities.DuelGame.filter({}, '-created_at', 50)
      ]);
      return buildJoinableEntries({ hostedGames, duelGames, limit: 10 });
    },
    enabled: true,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchInterval: 15000
  });

  // Realtime updates removed to keep Firestore read usage low.

  useEffect(() => {
    if (!user) return;
    if (!playerName.trim()) {
      setPlayerName(user?.display_name || user?.full_name || user?.email || '');
    }
  }, [playerName, user]);

  const getGameTypeName = (type) => {
    return t(`format.${type}.name`, GAME_FORMATS[type]?.name || 'Classic');
  };

  const getEntryTypeLabel = (game) => {
    if (game?.__kind === 'duel') {
      return game?.mode === 'solo' ? 'Sõbraduell SOLO' : 'Sõbraduell HOST';
    }
    return getGameTypeName(game?.game_type);
  };

  const getPlayerCount = (game) => {
    if (!game) return 0;
    if (game.__kind === 'duel') {
      return Object.keys(game.state?.players || {}).length;
    }
    return (
      game.players?.length ||
      Object.keys(game.player_putts || {}).length ||
      Object.keys(game.atw_state || {}).length ||
      0
    );
  };

  const getEntryDate = (game) => game.__sortDate || game.date || game.created_at || game.created_date || null;

  const handleJoin = async () => {
    if (!pin.trim() || !playerName.trim()) {
      setError(t('join.error_missing', 'Sisesta PIN ja oma nimi'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Find game by PIN
      const games = await base44.entities.Game.filter({ pin: pin.trim() });

      if (games.length === 0) {
        const duelPin = pin.trim().replace(/\D/g, '').slice(0, 4);
        if (duelPin.length === 4) {
          const duelMatches = await base44.entities.DuelGame.filter({ pin: duelPin }, '-created_at', 30);
          const duelGame = pickJoinableDuelGame(duelMatches || []);
          if (duelGame) {
            window.location.href = `${createPageUrl('DuelJoin')}?id=${duelGame.id}${duelGame.pin ? `&pin=${duelGame.pin}` : ''}`;
            return;
          }
        }
        setError(t('join.error_not_found', 'Mängu ei leitud. Kontrolli PIN-i.'));
        setLoading(false);
        return;
      }

      const game = games[0];

      if (game.join_closed === true || game.status === 'closed') {
        setError(t('join.error_closed', 'Mäng on hosti poolt suletud.'));
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
      setError(t('join.error_failed', 'Mänguga liitumine ebaõnnestus'));
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

        <div className="pk-surface p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              {t('join.name_label', 'Sinu nimi')}
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t('join.name_placeholder', 'Sisesta nimi')}
              className="mt-2 h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              {t('join.pin_label', 'Mängu PIN')}
            </label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder={t('join.pin_placeholder', 'Sisesta 4-kohaline PIN')}
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
            {t('join.button', 'Liitu mänguga')}
          </Button>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 dark:text-slate-200">
              <Clock className="w-4 h-4" />
              {t('join.active_games', 'Aktiivsed mängud')}
            </h3>
            <button
              type="button"
              onClick={() => refetchRecentGames()}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:bg-black dark:border-white/10 dark:text-slate-200"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingRecentGames ? 'animate-spin' : ''}`} />
              Uuenda
            </button>
          </div>
          {isLoadingRecentGames ? (
            <div className="pk-card px-4 py-3 text-sm text-slate-500 dark:text-slate-300">
              Laen aktiivseid mänge...
            </div>
          ) : isRecentGamesError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm dark:bg-black dark:border-red-400/40 dark:text-red-300">
              Aktiivsete mängude laadimine ebaõnnestus.
            </div>
          ) : recentGames.length === 0 ? (
            <div className="pk-card px-4 py-3 text-sm text-slate-500 dark:text-slate-300">
              Hetkel pole ühtegi avatud mängu. Sisesta PIN käsitsi või proovi hetke pärast uuesti.
            </div>
          ) : (
            <div className="space-y-2">
              {recentGames.map((game) => {
                const playerCount = getPlayerCount(game);
                return (
                  <button
                    key={game.__entryKey || game.id}
                    onClick={() => {
                      if (game.__kind === 'duel') {
                        window.location.href = `${createPageUrl('DuelJoin')}?id=${game.id}${game.pin ? `&pin=${game.pin}` : ''}`;
                        return;
                      }
                      setPin(game.pin);
                      setPlayerName(user?.display_name || user?.full_name || '');
                    }}
                    className="w-full pk-card p-3 text-left transition hover:bg-emerald-50/80 dark:hover:bg-black"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800 text-sm dark:text-slate-100">{game.name}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded dark:bg-black dark:border dark:border-emerald-400/40 dark:text-emerald-300">
                            {getEntryTypeLabel(game)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {getEntryDate(game) ? format(new Date(getEntryDate(game)), 'MMM d, yyyy') : t('join.no_date', 'Kuupäev puudub')}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Users className="w-3 h-3" />
                            {playerCount} {playerCount === 1 ? t('join.players_singular', 'mängija') : t('join.players_plural', 'mängijat')}
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
          )}
        </div>
      </div>
    </div>
  );
}
