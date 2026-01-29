import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Check, Users, Upload, Trophy, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import useRealtimeGame from '@/hooks/use-realtime-game';

export default function HostView({ gameId, onExit }) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ id: gameId });
      return games[0];
    },
    refetchInterval: false
  });

  useRealtimeGame({
    gameId,
    enabled: !!gameId,
    throttleMs: 1000,
    eventTypes: ['update', 'delete'],
    onEvent: (event) => {
      queryClient.setQueryData(['game', gameId], event.data);
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

  const submitToDiscgolfMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      
      for (const playerName of game.players || []) {
        const playerState = game.atw_state?.[playerName];
        const score = playerState?.best_score || 0;
        const totalPutts = playerState?.total_putts || 0;
        const madePutts = playerState?.total_makes || 0;
        const accuracy = playerState?.best_accuracy || 0;

        const playerUid = game.player_uids?.[playerName];
        const playerEmail = game.player_emails?.[playerName];
        const existingEntries = await base44.entities.LeaderboardEntry.filter({
          ...(playerUid ? { player_uid: playerUid } : { player_name: playerName }),
          game_type: game.game_type,
          leaderboard_type: 'discgolf_ee'
        });

        const existingEntry = existingEntries.length > 0 ? existingEntries[0] : null;

        if (existingEntry) {
          if (score > existingEntry.score) {
            await base44.entities.LeaderboardEntry.update(existingEntry.id, {
              game_id: game.id,
              ...(playerUid ? { player_uid: playerUid } : {}),
              ...(playerEmail ? { player_email: playerEmail } : {}),
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
    }
  });

  const copyPin = () => {
    if (game?.pin) {
      navigator.clipboard.writeText(game.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const isATWGame = game.game_type === 'around_the_world';
  const isCompleted = game.status === 'completed';

  // Calculate player stats for ATW
  const playerStats = (game.players || []).map(playerName => {
    const playerState = game.atw_state?.[playerName] || {};
    const currentScore = game.total_points?.[playerName] || 0;
    const bestScore = playerState.best_score || 0;
    const currentLaps = playerState.laps_completed || 0;
    const bestLaps = playerState.best_laps || 0;
    const totalPutts = playerState.total_putts || 0;
    const madePutts = playerState.total_makes || 0;
    const currentAccuracy = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
    const bestAccuracy = (playerState.best_accuracy || 0).toFixed(1);

    return {
      name: playerName,
      currentScore,
      bestScore,
      currentLaps,
      bestLaps,
      currentAccuracy,
      bestAccuracy
    };
  }).sort((a, b) => b.bestScore - a.bestScore);

  const bestPlayer = playerStats[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Exit</span>
          </button>
          <h2 className="text-xl font-bold text-slate-800">{game.name}</h2>
          <div className="w-16" />
        </div>

        {/* PIN Display */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold mb-1 opacity-90">Game PIN</div>
              <div className="text-4xl font-bold tracking-widest">{game.pin}</div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={copyPin}
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Users className="w-4 h-4" />
                <span>{game.players.length} players</span>
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
                <div className="text-sm text-slate-600">Best Score</div>
              </div>
              <div className="text-3xl font-bold text-emerald-600">{bestPlayer.bestScore}</div>
              <div className="text-xs text-slate-500 mt-1">{bestPlayer.name}</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-sm text-slate-600 mb-2">Most Laps</div>
              <div className="text-3xl font-bold text-blue-600">{bestPlayer.bestLaps}</div>
              <div className="text-xs text-slate-500 mt-1">{bestPlayer.name}</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="w-5 h-5 text-purple-500" />
                <div className="text-sm text-slate-600">Best Accuracy</div>
              </div>
              <div className="text-3xl font-bold text-purple-600">{bestPlayer.bestAccuracy}%</div>
              <div className="text-xs text-slate-500 mt-1">{bestPlayer.name}</div>
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
                    <th className="text-left p-4 font-semibold text-slate-700">Player</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Best Score</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Current</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Laps</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Accuracy</th>
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
                        <div className="flex flex-col items-center">
                          <div className="text-sm font-bold text-purple-600">{player.bestAccuracy}%</div>
                          <div className="text-xs text-slate-400">{player.currentAccuracy}%</div>
                        </div>
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
            
            {isCompleted && canSubmitDiscgolf && (
              <>
                <Button 
                  onClick={() => submitToDiscgolfMutation.mutate()}
                  disabled={submitToDiscgolfMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Submit to Discgolf.ee
                </Button>
                <Button 
                  onClick={() => submitToDiscgolfMutation.mutate()}
                  disabled={submitToDiscgolfMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Submit to Leaderboard
                </Button>
              </>
            )}
            
            <Link to={`${createPageUrl('GameResult')}?id=${game.id}`}>
              <Button variant="outline" className="w-full">
                View Full Results
              </Button>
            </Link>
          </div>
        </div>

        {game.players.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm border border-slate-100">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Waiting for players to join...</p>
            <p className="text-sm mt-2">Share the PIN: <span className="font-bold text-emerald-600">{game.pin}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
