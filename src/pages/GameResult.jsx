import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Share2, Calendar, Users, Target, Upload } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format as formatDate } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import { toast } from 'sonner';
import PerformanceAnalysis from '@/components/putting/PerformanceAnalysis';
import AroundTheWorldGameView from '@/components/putting/AroundTheWorldGameView';
import { createPageUrl } from '@/utils';
import LoadingState from '@/components/ui/loading-state';
import useRealtimeGame from '@/hooks/use-realtime-game';


export default function GameResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameId = searchParams.get('id');
  const queryClient = useQueryClient();


  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canSubmitDiscgolf = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const { data: game, isLoading, error } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ id: gameId });
      const found = games?.[0];
      if (!found) throw new Error('Game not found');
      return found;
    },
    enabled: !!gameId,
    retry: false
  });

  const mergeRealtimeGame = React.useCallback((previous, incoming) => {
    if (!previous) return incoming;
    if (!incoming) return previous;
    const merged = { ...previous, ...incoming };
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
      queryClient.setQueryData(['game', gameId], (previous) => mergeRealtimeGame(previous, event.data));
    }
  });

  const { data: leaderboardEntries = [] } = useQuery({
    queryKey: ['leaderboard-entries'],
    queryFn: () => base44.entities.LeaderboardEntry.list()
  });

  const deleteGameMutation = useMutation({
    mutationFn: (id) => base44.entities.Game.delete(id),
    onSuccess: () => {
      navigate(-1);
    }
  });

  const submitToLeaderboardMutation = useMutation({
    mutationFn: async () => {
      // Find current user's name in the game
      const playerName = user?.full_name;
      let madePutts = 0;
      let totalPutts = 0;
      let accuracy = 0;
      let score = 0;

      if (game.game_type === 'around_the_world') {
        const state = game.atw_state?.[playerName] || {};
        const currentScore = game.total_points?.[playerName] || 0;
        const bestScore = Math.max(state.best_score || 0, currentScore);
        const currentAccuracy = state.total_putts > 0
          ? (state.total_makes / state.total_putts) * 100
          : 0;
        madePutts = state.total_makes || 0;
        totalPutts = state.total_putts || 0;
        accuracy = Math.max(state.best_accuracy || 0, currentAccuracy);
        score = bestScore;
      } else {
        const playerPutts = game.player_putts?.[playerName] || [];
        madePutts = playerPutts.filter(p => p.result === 'made').length;
        totalPutts = playerPutts.length;
        accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;
        score = game.total_points[playerName] || 0;
      }

      // Check if player already has an entry for this game type
      const existingEntries = await base44.entities.LeaderboardEntry.filter({
        ...(user?.id ? { player_uid: user.id } : { player_email: user?.email }),
        game_type: game.game_type,
        leaderboard_type: 'general'
      });

      const existingEntry = existingEntries.length > 0 ? existingEntries[0] : null;

      if (existingEntry) {
        // Only update if new score is better
        if (score > existingEntry.score) {
          await base44.entities.LeaderboardEntry.update(existingEntry.id, {
            game_id: game.id,
            score: score,
            accuracy: Math.round(accuracy * 10) / 10,
            made_putts: madePutts,
            total_putts: totalPutts,
            date: new Date(game.date).toISOString()
          });
          return { updated: true };
        } else {
          return { updated: false, existing: existingEntry.score };
        }
      } else {
        // Create new entry
        await base44.entities.LeaderboardEntry.create({
          game_id: game.id,
          player_uid: user?.id,
          player_email: user?.email || 'unknown',
          player_name: playerName,
          game_type: game.game_type,
          score: score,
          accuracy: Math.round(accuracy * 10) / 10,
          made_putts: madePutts,
          total_putts: totalPutts,
          leaderboard_type: 'general',
          player_gender: user?.gender || 'M',
          date: new Date(game.date).toISOString()
        });
        return { updated: true };
      }
    },
    onSuccess: (result) => {
      if (result.updated) {
        toast.success('Result submitted to leaderboard!');
      } else {
        toast.info(`Your best score (${result.existing}) is higher than this game`);
      }
      setShowSubmitDialog(false);
    }
  });

  const submitToDiscgolfMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      
      for (const playerName of game.players || []) {
        let madePutts = 0;
        let totalPutts = 0;
        let accuracy = 0;
        let score = 0;

        if (game.game_type === 'around_the_world') {
          const state = game.atw_state?.[playerName] || {};
          const currentScore = game.total_points?.[playerName] || 0;
          const bestScore = Math.max(state.best_score || 0, currentScore);
          const currentAccuracy = state.total_putts > 0
            ? (state.total_makes / state.total_putts) * 100
            : 0;
          madePutts = state.total_makes || 0;
          totalPutts = state.total_putts || 0;
          accuracy = Math.max(state.best_accuracy || 0, currentAccuracy);
          score = bestScore;
        } else {
          const playerPutts = game.player_putts?.[playerName] || [];
          madePutts = playerPutts.filter(p => p.result === 'made').length;
          totalPutts = playerPutts.length;
          accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;
          score = game.total_points?.[playerName] || 0;
        }

        // Check if player already has an entry
        const playerUid = game.player_uids?.[playerName];
        const playerEmail = game.player_emails?.[playerName];
        const existingEntries = await base44.entities.LeaderboardEntry.filter({
          ...(playerUid ? { player_uid: playerUid } : { player_name: playerName }),
          game_type: game.game_type,
          leaderboard_type: 'discgolf_ee'
        });

        const existingEntry = existingEntries.length > 0 ? existingEntries[0] : null;

        if (existingEntry) {
          // Update only if new score is better
          if (score > existingEntry.score) {
            await base44.entities.LeaderboardEntry.update(existingEntry.id, {
              game_id: game.id,
              score: score,
              accuracy: Math.round(accuracy * 10) / 10,
              made_putts: madePutts,
              total_putts: totalPutts,
              submitted_by: user?.email,
              date: new Date(game.date).toISOString()
            });
            results.push({ player: playerName, action: 'updated' });
          } else {
            results.push({ player: playerName, action: 'skipped' });
          }
        } else {
          // Create new entry
          await base44.entities.LeaderboardEntry.create({
            game_id: game.id,
            player_uid: playerUid,
            player_email: playerEmail,
            player_name: playerName,
            game_type: game.game_type,
            score: score,
            accuracy: Math.round(accuracy * 10) / 10,
            made_putts: madePutts,
            total_putts: totalPutts,
            leaderboard_type: 'discgolf_ee',
            submitted_by: user?.email,
            player_gender: 'M',
            date: new Date(game.date).toISOString()
          });
          results.push({ player: playerName, action: 'created' });
        }

        // Also submit to general leaderboard (always create new)
        await base44.entities.LeaderboardEntry.create({
          game_id: game.id,
          player_uid: playerUid,
          player_email: playerEmail,
          player_name: playerName,
          game_type: game.game_type,
          score: score,
          accuracy: Math.round(accuracy * 10) / 10,
          made_putts: madePutts,
          total_putts: totalPutts,
          leaderboard_type: 'general',
          player_gender: 'M',
          date: new Date(game.date).toISOString()
        });
      }

      return results;
    },
    onSuccess: (results) => {
      const updated = results.filter(r => r.action === 'updated').length;
      const created = results.filter(r => r.action === 'created').length;
      const skipped = results.filter(r => r.action === 'skipped').length;
      
      let message = 'Submitted to Discgolf.ee & General leaderboards';
      if (updated > 0 || skipped > 0) {
        message += ` (${created} new, ${updated} updated, ${skipped} skipped)`;
      }
      toast.success(message);
      setShowDiscgolfDialog(false);
    }
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-slate-400 mb-4">Game not found</div>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const myDisplayName = user?.display_name || user?.full_name || user?.email;

  // Show ATW views for Around The World games
  if (game.game_type === 'around_the_world') {
    const isSolo = game.players.length === 1 && game.pin === '0000';
    
    // If user is the host, redirect to HostView
    if (user?.email === game.host_user && !isSolo) {
      window.location.href = createPageUrl('Home') + '?mode=atw-host&gameId=' + game.id;
      return null;
    }
    
    // Otherwise show player view
    return (
      <AroundTheWorldGameView
        gameId={game.id}
        playerName={myDisplayName}
        isSolo={isSolo}
      />
    );
  }

  const gameType = game.game_type || 'classic';
  const gameFormat = GAME_FORMATS[gameType];
  const canDelete = ['admin', 'super_admin'].includes(userRole) || user?.email === game?.host_user;

  // Calculate statistics for each player
  const playerStats = game.players.map(player => {
    const putts = game.player_putts?.[player] || [];
    const totalPutts = putts.length;
    const madePutts = putts.filter(p => p.result === 'made').length;
    const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
    const totalPoints = game.total_points?.[player] || 0;

    // Group putts into frames (5 putts per frame for classic/short/long)
    const frames = [];
    if (!gameFormat.singlePuttMode) {
      for (let i = 0; i < putts.length; i += 5) {
        const framePutts = putts.slice(i, i + 5);
        const distance = framePutts[0]?.distance || 0;
        const made = framePutts.filter(p => p.result === 'made').length;
        frames.push({ distance, made });
      }
    }

    return {
      name: player,
      totalPutts,
      madePutts,
      puttingPercentage,
      totalPoints,
      putts,
      frames
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  const handleShare = async () => {
    const shareText = `${game.name} - ${gameFormat.name}\n\nResults:\n${playerStats.map(p => 
      `${p.name}: ${p.totalPoints} pts (${p.puttingPercentage}%)`
    ).join('\n')}`;
    
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('Results copied to clipboard!');
      }
    } catch (error) {
      // Fallback to clipboard if share fails
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Results copied to clipboard!');
      } catch {
        alert('Unable to share. Please copy manually.');
      }
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this game? This cannot be undone.')) {
      deleteGameMutation.mutate(game.id);
    }
  };

  const isSubmittedToLeaderboard = leaderboardEntries.some(entry => 
    entry.game_id === gameId &&
    entry.leaderboard_type === 'general' &&
    (user?.id ? entry.player_uid === user.id : entry.player_email === user?.email)
  );

  const isSubmittedToDgEe = leaderboardEntries.some(entry => 
    entry.game_id === gameId && 
    entry.leaderboard_type === 'discgolf_ee'
  );

  // Check if this is a solo ATW game
  const isSoloATW = game.game_type === 'around_the_world' && game.pin === '0000';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{game.name}</h1>
          <div className="w-16" />
        </div>

        {/* Game Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">Format</div>
              <div className="font-bold text-slate-800">{gameFormat.name}</div>
              <div className="text-xs text-slate-500">{gameFormat.minDistance}m - {gameFormat.maxDistance}m</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date
              </div>
              <div className="font-bold text-slate-800">
                {game.date ? formatDate(new Date(game.date), 'MMM d, yyyy') : 'No date'}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Button onClick={handleShare} variant="outline" className="flex-1">
                <Share2 className="w-4 h-4 mr-2" />
                Share Results
              </Button>
              {canDelete && (
                <Button onClick={handleDelete} variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              {!isSoloATW && (
                <Button 
                  onClick={() => submitToLeaderboardMutation.mutate()}
                  disabled={submitToLeaderboardMutation.isPending || isSubmittedToLeaderboard}
                  className={isSubmittedToLeaderboard ? "flex-1 bg-slate-400" : "flex-1 bg-emerald-600 hover:bg-emerald-700"}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isSubmittedToLeaderboard ? 'Submitted' : 'Submit to Leaderboard'}
                </Button>
              )}
              {canSubmitDiscgolf && !(game.pin === '0000') && (
                <Button 
                  onClick={() => submitToDiscgolfMutation.mutate()}
                  disabled={submitToDiscgolfMutation.isPending || isSubmittedToDgEe}
                  className={isSubmittedToDgEe ? "flex-1 bg-slate-400" : "flex-1 bg-blue-600 hover:bg-blue-700"}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isSubmittedToDgEe ? 'Submitted' : 'Submit to Discgolf.ee'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Performance Analysis for single player games */}
        {game.players.length === 1 && (
          <PerformanceAnalysis playerPutts={game.player_putts?.[game.players[0]] || []} />
        )}

        {/* Player Results */}
        {!gameFormat.singlePuttMode ? (
          // Table view for classic, short, long formats
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 font-semibold text-slate-700 bg-slate-50 sticky left-0 z-10">Player</th>
                    {[...Array(20)].map((_, i) => (
                      <th key={i} className="text-center p-2 font-semibold text-slate-700 bg-slate-50 text-sm min-w-[60px]">
                        {i + 1}
                      </th>
                    ))}
                    <th className="text-center p-4 font-semibold text-slate-700 bg-slate-50 sticky right-0 z-10">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((player, pIndex) => (
                    <tr key={player.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-4 font-medium text-slate-800 bg-white sticky left-0 z-10 border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                            {pIndex + 1}
                          </div>
                          <span>{player.name}</span>
                        </div>
                      </td>
                      {[...Array(20)].map((_, frameIndex) => {
                        const frame = player.frames[frameIndex];
                        return (
                          <td key={frameIndex} className="p-2 text-center">
                            {frame ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="text-xs text-slate-500 font-medium">{frame.distance}m</div>
                                <div className={`text-base font-bold ${
                                  frame.made === 5 ? 'text-emerald-600' : 
                                  frame.made >= 3 ? 'text-emerald-500' : 
                                  'text-slate-600'
                                }`}>
                                  {frame.made}
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-300">-</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-4 text-center bg-white sticky right-0 z-10 border-l border-slate-100">
                        <div className="font-bold text-lg text-emerald-600">{player.totalPoints}</div>
                        <div className="text-xs text-slate-500">{player.puttingPercentage}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Table view for back & forth format with dots
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 font-semibold text-slate-700 bg-slate-50 sticky left-0 z-10">Player</th>
                    {[...Array(20)].map((_, i) => (
                      <th key={i} className="text-center p-2 font-semibold text-slate-700 bg-slate-50 text-sm min-w-[60px]">
                        {i + 1}
                      </th>
                    ))}
                    <th className="text-center p-4 font-semibold text-slate-700 bg-slate-50 sticky right-0 z-10">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((player, pIndex) => {
                    // Group putts into rounds of 5
                    const rounds = [];
                    for (let i = 0; i < 100; i += 5) {
                      const roundPutts = player.putts.slice(i, i + 5);
                      if (roundPutts.length > 0) {
                        rounds.push(roundPutts);
                      }
                    }

                    return (
                      <tr key={player.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-4 font-medium text-slate-800 bg-white sticky left-0 z-10 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                              {pIndex + 1}
                            </div>
                            <span>{player.name}</span>
                          </div>
                        </td>
                        {[...Array(20)].map((_, roundIndex) => {
                          const round = rounds[roundIndex];
                          return (
                            <td key={roundIndex} className="p-2 text-center">
                              {round ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="text-base font-bold text-slate-700">
                                    {round.reduce((sum, p) => sum + (p.points || 0), 0)}
                                  </div>
                                  <div className="flex gap-0.5">
                                    {round.map((putt, puttIdx) => (
                                      <div
                                        key={puttIdx}
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          putt.result === 'made' 
                                            ? 'bg-emerald-500' 
                                            : 'bg-red-500'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-slate-300">-</div>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-4 text-center bg-white sticky right-0 z-10 border-l border-slate-100">
                          <div className="font-bold text-lg text-emerald-600">{player.totalPoints}</div>
                          <div className="text-xs text-slate-500">{player.puttingPercentage}%</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
