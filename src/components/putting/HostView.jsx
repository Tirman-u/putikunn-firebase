import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Copy, Check, Users, Upload, Trophy, Target, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import useRealtimeGame from '@/hooks/use-realtime-game';
import LoadingState from '@/components/ui/loading-state';
import {
  buildLeaderboardIdentityFilter,
  getLeaderboardEmail,
  getLeaderboardStats,
  isHostedClassicGame,
  resolveLeaderboardPlayer
} from '@/lib/leaderboard-utils';
import BackButton from '@/components/ui/back-button';

export default function HostView({ gameId, onExit }) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const baseGameRef = React.useRef(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ id: gameId });
      return games[0];
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  useEffect(() => {
    if (!game) return;
    baseGameRef.current = { ...baseGameRef.current, ...game };
  }, [game]);

  const mergeRealtimeGame = React.useCallback((previous, incoming) => {
    if (!previous) return incoming;
    if (!incoming) return previous;
    const merged = { ...previous, ...incoming };
    const fallback = baseGameRef.current || previous;
    const staticKeys = ['name', 'pin', 'host_user', 'game_type', 'putt_type', 'status', 'date'];
    staticKeys.forEach((key) => {
      if (merged?.[key] === undefined || merged?.[key] === null) {
        merged[key] = fallback?.[key];
      }
    });
    const mapKeys = [
      'player_putts',
      'total_points',
      'player_distances',
      'player_current_streaks',
      'player_highest_streaks',
      'player_uids',
      'player_emails',
      'atw_state',
      'live_stats'
    ];
    mapKeys.forEach((key) => {
      if (previous?.[key] || incoming?.[key]) {
        merged[key] = {
          ...(previous?.[key] || {}),
          ...(incoming?.[key] || {})
        };
      }
    });
    return merged;
  }, []);

  useRealtimeGame({
    gameId,
    enabled: !!gameId,
    throttleMs: 1000,
    eventTypes: ['update', 'delete'],
    onEvent: (event) => {
      if (event.type === 'delete') {
        queryClient.setQueryData(['game', gameId], undefined);
        return;
      }
      if (!event?.data) return;
      queryClient.setQueryData(['game', gameId], (previous) => {
        return mergeRealtimeGame(previous, event.data);
      });
    }
  });

  const userRole = user?.app_role || 'user';
  const canSubmitDiscgolf = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const completeGameMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Game.update(gameId, {
        status: 'completed'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      toast.success('Mäng lõpetatud!');
    }
  });

  const closeGameMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Game.update(gameId, {
        join_closed: true,
        status: 'closed'
      });
    },
    onSuccess: () => {
      toast.success('Mäng suletud');
      onExit?.();
    }
  });

  const resolveGamePlayers = (gameData) => {
    const fromPlayers = Array.isArray(gameData?.players) ? gameData.players : [];
    const fromPutts = Object.keys(gameData?.player_putts || {});
    const fromAtw = Object.keys(gameData?.atw_state || {});
    return Array.from(new Set([...fromPlayers, ...fromPutts, ...fromAtw].filter(Boolean)));
  };

  const syncLeaderboardEntries = async ({ includeDiscgolf }) => {
      const results = [];
      const profileCache = {};

      const playersToSync = resolveGamePlayers(game);
      for (const rawPlayerName of playersToSync) {
        const { score, madePutts, totalPutts, accuracy } = getLeaderboardStats(game, rawPlayerName);
        const resolvedPlayer = await resolveLeaderboardPlayer({
          game,
          playerName: rawPlayerName,
          cache: profileCache
        });
        const identityFilter = buildLeaderboardIdentityFilter(resolvedPlayer);
        const normalizedDate = new Date(game.date || new Date().toISOString()).toISOString();
        const basePayload = {
          game_id: game.id,
          player_name: resolvedPlayer.playerName,
          ...(resolvedPlayer.playerUid ? { player_uid: resolvedPlayer.playerUid } : {}),
          player_email: getLeaderboardEmail(resolvedPlayer),
          ...(resolvedPlayer.playerGender ? { player_gender: resolvedPlayer.playerGender } : {}),
          game_type: game.game_type,
          score,
          accuracy: Math.round(accuracy * 10) / 10,
          made_putts: madePutts,
          total_putts: totalPutts,
          ...(game.game_type === 'streak_challenge'
            ? { streak_distance: game.player_distances?.[rawPlayerName] || 0 }
            : {}),
          date: normalizedDate
        };

        if (includeDiscgolf && isHostedClassicGame(game)) {
          const [existingDiscgolf] = await base44.entities.LeaderboardEntry.filter({
            ...identityFilter,
            game_type: game.game_type,
            leaderboard_type: 'discgolf_ee'
          });

          if (existingDiscgolf) {
            if (score > existingDiscgolf.score) {
              await base44.entities.LeaderboardEntry.update(existingDiscgolf.id, {
                ...basePayload,
                leaderboard_type: 'discgolf_ee',
                submitted_by: user?.email
              });
              results.push({ player: resolvedPlayer.playerName, action: 'updated' });
            } else {
              results.push({ player: resolvedPlayer.playerName, action: 'skipped' });
            }
          } else {
            await base44.entities.LeaderboardEntry.create({
              ...basePayload,
              leaderboard_type: 'discgolf_ee',
              submitted_by: user?.email
            });
            results.push({ player: resolvedPlayer.playerName, action: 'created' });
          }
        }

        const [existingGeneral] = await base44.entities.LeaderboardEntry.filter({
          ...identityFilter,
          game_type: game.game_type,
          leaderboard_type: 'general'
        });

        if (existingGeneral) {
          if (score > existingGeneral.score) {
            await base44.entities.LeaderboardEntry.update(existingGeneral.id, {
              ...basePayload,
              leaderboard_type: 'general'
            });
            if (!includeDiscgolf) {
              results.push({ player: resolvedPlayer.playerName, action: 'updated' });
            }
          } else if (!includeDiscgolf) {
            results.push({ player: resolvedPlayer.playerName, action: 'skipped' });
          }
        } else {
          await base44.entities.LeaderboardEntry.create({
            ...basePayload,
            leaderboard_type: 'general'
          });
          if (!includeDiscgolf) {
            results.push({ player: resolvedPlayer.playerName, action: 'created' });
          }
        }
      }

      return results;
  };

  const submitToLeaderboardMutation = useMutation({
    mutationFn: async () => syncLeaderboardEntries({ includeDiscgolf: false }),
    onSuccess: (results) => {
      const updated = results.filter(r => r.action === 'updated').length;
      const created = results.filter(r => r.action === 'created').length;
      const skipped = results.filter(r => r.action === 'skipped').length;
      
      let message = 'Edetabelisse saadetud';
      if (updated > 0 || skipped > 0) {
        message += ` (${created} uusi, ${updated} uuendatud, ${skipped} vahele jäetud)`;
      }
      toast.success(message);
    }
  });

  const submitToDiscgolfMutation = useMutation({
    mutationFn: async () => syncLeaderboardEntries({ includeDiscgolf: true }),
    onSuccess: (results) => {
      const updated = results.filter(r => r.action === 'updated').length;
      const created = results.filter(r => r.action === 'created').length;
      const skipped = results.filter(r => r.action === 'skipped').length;
      
      let message = 'Discgolf.ee-sse saadetud';
      if (updated > 0 || skipped > 0) {
        message += ` (${created} uusi, ${updated} uuendatud, ${skipped} vahele jäetud)`;
      }
      toast.success(message);
    }
  });

  const copyPin = () => {
    if (game?.pin) {
      navigator.clipboard.writeText(game.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const gameType = game?.game_type;
  const isATWGame = gameType === 'around_the_world';
  const isCompleted = game?.status === 'completed';
  const canSubmitDiscgolfForGame = canSubmitDiscgolf && isHostedClassicGame(game);
  const canSubmitGeneralForGame =
    Boolean(user?.email && game?.host_user && user.email === game.host_user) || canSubmitDiscgolf;
  const scoreLabel = gameType === 'streak_challenge' ? 'Parim seeria' : 'Tulemus';

  useEffect(() => {
    if (!gameId || !gameType || isATWGame) return undefined;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    }, 2000);
    return () => clearInterval(interval);
  }, [gameId, gameType, isATWGame, queryClient]);

  if (isLoading || !game) {
    return <LoadingState />;
  }

  // Calculate player stats for ATW
  const playerStats = (game.players || []).map(playerName => {
    const playerState = game.atw_state?.[playerName] || {};
    const currentScore = game.total_points?.[playerName] || 0;
    const bestScore = playerState.best_score || 0;
    const currentLaps = playerState.laps_completed || 0;
    const bestLaps = playerState.best_laps || 0;
    const attemptsCount = playerState.attempts_count || 0;

    return {
      name: playerName,
      currentScore,
      bestScore,
      currentLaps,
      bestLaps,
      attemptsCount
    };
  }).sort((a, b) => b.bestScore - a.bestScore);

  const nonAtwPlayerStats = !isATWGame
    ? (game.players || []).map((playerName) => {
        const putts = game.player_putts?.[playerName] || [];
        const liveStats = game.live_stats?.[playerName];
        const totalPutts = liveStats?.total_putts ?? putts.length;
        const madePutts = liveStats?.made_putts ?? putts.filter(p => p.result === 'made').length;
        const totalPoints = liveStats?.total_points ?? game.total_points?.[playerName] ?? 0;
        const puttingPercentage = totalPutts > 0
          ? Math.round((madePutts / totalPutts) * 1000) / 10
          : 0;

        return {
          name: playerName,
          totalPoints,
          totalPutts,
          madePutts,
          puttingPercentage
        };
      }).sort((a, b) => b.totalPoints - a.totalPoints)
    : [];

  const bestPlayer = playerStats[0];
  const mostAttempts = Math.max(...playerStats.map(p => p.attemptsCount || 0), 0);
  const mostAttemptsPlayer = playerStats.find(p => p.attemptsCount === mostAttempts);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <BackButton onClick={onExit} label="Välju" />
          <h2 className="text-xl font-bold text-slate-800">{game.name}</h2>
          <div className="w-16" />
        </div>

        {/* PIN Display */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold mb-1 opacity-90">Mängu PIN</div>
              <div className="text-4xl font-bold tracking-widest">{game.pin}</div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={copyPin}
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Kopeeritud' : 'Kopeeri'}
              </Button>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Users className="w-4 h-4" />
                <span>{game.players.length} mängijat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview (Best Player) */}
        {isATWGame && bestPlayer && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <div className="text-sm text-slate-600">Parim tulemus</div>
              </div>
              <div className="text-3xl font-bold text-emerald-600">{bestPlayer.bestScore}</div>
              <div className="text-xs text-slate-500 mt-1">{bestPlayer.name}</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-sm text-slate-600 mb-2">Enim ringe</div>
              <div className="text-3xl font-bold text-blue-600">{bestPlayer.bestLaps}</div>
              <div className="text-xs text-slate-500 mt-1">{bestPlayer.name}</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="w-5 h-5 text-purple-500" />
                <div className="text-sm text-slate-600">Katseid</div>
              </div>
              <div className="text-3xl font-bold text-purple-600">{mostAttempts}</div>
              <div className="text-xs text-slate-500 mt-1">{mostAttemptsPlayer?.name}</div>
            </div>
          </div>
        )}

        {/* Player Table */}
        {isATWGame && game.players.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-4 font-semibold text-slate-700">#</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Mängija</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Parim tulemus</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Praegu</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Ringid</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Katseid</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((player, index) => (
                    <tr key={player.name} className={`border-b border-slate-100 ${index === 0 && isCompleted ? 'bg-amber-50' : ''}`}>
                      <td className="p-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-800">{player.name}</td>
                      <td className="p-4 text-center">
                        <div className="text-lg font-bold text-emerald-600">{player.bestScore}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-sm text-slate-500">{player.currentScore}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <div className="text-sm font-bold text-blue-600">{player.bestLaps}</div>
                          <div className="text-xs text-slate-400">{player.currentLaps}</div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-sm font-bold text-purple-600">{player.attemptsCount}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isATWGame && game.players.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Trophy className="w-4 h-4 text-amber-500" />
                Live tulemused
              </div>
              <div className="text-xs text-slate-500">Uueneb automaatselt</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-4 font-semibold text-slate-700">#</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Mängija</th>
                    <th className="text-center p-4 font-semibold text-slate-700">{scoreLabel}</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Putid</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Täpsus</th>
                  </tr>
                </thead>
                <tbody>
                  {nonAtwPlayerStats.map((player, index) => (
                    <tr key={player.name} className={`border-b border-slate-100 ${index === 0 ? 'bg-amber-50' : ''}`}>
                      <td className="p-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-800">{player.name}</td>
                      <td className="p-4 text-center">
                        <div className="text-lg font-bold text-emerald-600">{player.totalPoints}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-sm text-slate-500">{player.madePutts}/{player.totalPutts}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-sm text-slate-500">{player.puttingPercentage}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex flex-col gap-3">
            {!isATWGame && (
              <Button
                onClick={() => closeGameMutation.mutate()}
                disabled={closeGameMutation.isPending || game.join_closed === true}
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {game.join_closed === true ? 'Mäng suletud' : 'Sulge mäng'}
              </Button>
            )}

            {!isCompleted && isATWGame && (
              <Button 
                onClick={() => completeGameMutation.mutate()}
                disabled={completeGameMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Lõpeta mäng
              </Button>
            )}
            
            {isCompleted && (
              <>
                {canSubmitGeneralForGame && (
                  <Button 
                    onClick={() => submitToLeaderboardMutation.mutate()}
                    disabled={submitToLeaderboardMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Saada edetabelisse
                  </Button>
                )}
                {canSubmitDiscgolfForGame && (
                  <Button 
                    onClick={() => submitToDiscgolfMutation.mutate()}
                    disabled={submitToDiscgolfMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Saada Discgolf.ee-sse
                  </Button>
                )}
              </>
            )}
            
            <Link to={`${createPageUrl('GameResult')}?id=${game.id}`}>
              <Button variant="outline" className="w-full">
                Vaata kõiki tulemusi
              </Button>
            </Link>
          </div>
        </div>

        {game.players.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm border border-slate-100">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Ootame mängijate liitumist...</p>
            <p className="text-sm mt-2">Jaga PIN-i: <span className="font-bold text-emerald-600">{game.pin}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
