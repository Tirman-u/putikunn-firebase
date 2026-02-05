import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trash2, FolderPlus, Folder, Calendar, ChevronRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  buildLeaderboardIdentityFilter,
  deleteGameAndLeaderboardEntries,
  getLeaderboardStats,
  isHostedClassicGame,
  resolveLeaderboardPlayer
} from '@/lib/leaderboard-utils';

export default function ManageGames() {
  const [selectedGames, setSelectedGames] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedSyncGameIds, setSelectedSyncGameIds] = useState([]);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: games = [] } = useQuery({
    queryKey: ['my-games'],
    queryFn: async () => {
      const allGames = await base44.entities.Game.list();
      return allGames.filter(g => g.host_user === user?.email);
    },
    enabled: !!user
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['game-groups'],
    queryFn: async () => {
      const allGroups = await base44.entities.GameGroup.list();
      return allGroups.filter(g => g.created_by === user?.email);
    },
    enabled: !!user
  });

  const { data: leaderboardEntries = [] } = useQuery({
    queryKey: ['leaderboard-entries'],
    queryFn: () => base44.entities.LeaderboardEntry.list()
  });

  const completeGameMutation = useMutation({
    mutationFn: (gameId) => base44.entities.Game.update(gameId, { status: 'completed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      toast.success('Game marked as completed');
    }
  });

  const deleteGameMutation = useMutation({
    mutationFn: (gameId) => deleteGameAndLeaderboardEntries(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId) => base44.entities.GameGroup.delete(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-groups'] });
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: (groupData) => base44.entities.GameGroup.create(groupData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-groups'] });
      setShowGroupDialog(false);
      setNewGroupName('');
      setSelectedGames([]);
    }
  });

  const resolveGamePlayers = (game) => {
    if (game.players && game.players.length) return Array.from(new Set(game.players));
    const fromPutts = Object.keys(game.player_putts || {});
    if (fromPutts.length) return Array.from(new Set(fromPutts));
    const fromAtw = Object.keys(game.atw_state || {});
    return Array.from(new Set(fromAtw));
  };

  const syncGameToLeaderboards = async (game, profileCache = {}) => {
    const results = [];
    const players = resolveGamePlayers(game);

    for (const rawPlayerName of players) {
      if (!rawPlayerName) continue;

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
        game_type: game.game_type,
        player_name: resolvedPlayer.playerName,
        score,
        accuracy: Math.round(accuracy * 10) / 10,
        made_putts: madePutts,
        total_putts: totalPutts,
        ...(resolvedPlayer.playerUid ? { player_uid: resolvedPlayer.playerUid } : {}),
        ...(resolvedPlayer.playerEmail ? { player_email: resolvedPlayer.playerEmail } : {}),
        ...(resolvedPlayer.playerGender ? { player_gender: resolvedPlayer.playerGender } : {}),
        ...(game.game_type === 'streak_challenge'
          ? { streak_distance: game.player_distances?.[rawPlayerName] || 0 }
          : {}),
        date: normalizedDate
      };

      if (!totalPutts && !score) {
        results.push({ player: resolvedPlayer.playerName, action: 'skipped' });
        continue;
      }

      try {
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
            results.push({ player: resolvedPlayer.playerName, action: 'updated' });
          } else {
            results.push({ player: resolvedPlayer.playerName, action: 'skipped' });
          }
        } else {
          await base44.entities.LeaderboardEntry.create({
            ...basePayload,
            leaderboard_type: 'general',
          });
          results.push({ player: resolvedPlayer.playerName, action: 'created' });
        }

        if (isHostedClassicGame(game)) {
          const [existingDg] = await base44.entities.LeaderboardEntry.filter({
            ...identityFilter,
            game_type: game.game_type,
            leaderboard_type: 'discgolf_ee'
          });

          if (existingDg) {
            if (score > existingDg.score) {
              await base44.entities.LeaderboardEntry.update(existingDg.id, {
                ...basePayload,
                leaderboard_type: 'discgolf_ee',
                submitted_by: user?.email
              });
            }
          } else {
            await base44.entities.LeaderboardEntry.create({
              ...basePayload,
              leaderboard_type: 'discgolf_ee',
              submitted_by: user?.email
            });
          }
        }
      } catch (error) {
        results.push({ player: resolvedPlayer.playerName, action: 'error', error });
      }
    }

    return results;
  };

  const submitToDiscgolfMutation = useMutation({
    mutationFn: async (game) => syncGameToLeaderboards(game, {}),
    onSuccess: (results) => {
      const updated = results.filter(r => r.action === 'updated').length;
      const created = results.filter(r => r.action === 'created').length;
      const skipped = results.filter(r => r.action === 'skipped').length;
      const errors = results.filter(r => r.action === 'error').length;
      
      let message = 'Submitted to leaderboards';
      if (updated > 0 || skipped > 0 || errors > 0 || created > 0) {
        message += ` (${created} new, ${updated} updated, ${skipped} skipped, ${errors} errors)`;
      }
      if (errors > 0) {
        toast.error(message);
      } else {
        toast.success(message);
      }
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
    },
    onError: (error) => {
      const message = error?.message || 'Submit failed';
      toast.error(message);
    }
  });

  const bulkSyncMutation = useMutation({
    mutationFn: async (gamesToSync) => {
      const profileCache = {};
      const summary = {
        games: gamesToSync.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      };

      for (const game of gamesToSync) {
        const results = await syncGameToLeaderboards(game, profileCache);
        summary.created += results.filter(r => r.action === 'created').length;
        summary.updated += results.filter(r => r.action === 'updated').length;
        summary.skipped += results.filter(r => r.action === 'skipped').length;
        summary.errors += results.filter(r => r.action === 'error').length;
      }

      return summary;
    },
    onSuccess: (summary) => {
      const message = `Bulk sync valmis (${summary.games} mängu, ${summary.created} new, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.errors} errors)`;
      if (summary.errors > 0) {
        toast.error(message);
      } else {
        toast.success(message);
      }
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Bulk sync failed');
    }
  });

  const handleCreateGroup = () => {
    if (!newGroupName.trim() || selectedGames.length === 0) return;
    
    createGroupMutation.mutate({
      name: newGroupName,
      game_ids: selectedGames,
      created_by: user.email
    });
  };

  const getGameTypeName = (type) => {
    const names = {
      classic: 'Classic',
      back_and_forth: 'Back & Forth',
      short: 'Short',
      long: 'Long'
    };
    return names[type] || type;
  };

  const isGameSubmitted = (gameId) => {
    return leaderboardEntries.some(entry => entry.game_id === gameId && entry.leaderboard_type === 'general');
  };

  const completedGames = games.filter(g => g.status === 'completed' && g.pin !== '0000');
  const activeGames = games.filter(g => g.status !== 'completed' && g.pin !== '0000');

  const getMonthKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const groupedByMonth = completedGames.reduce((acc, game) => {
    const monthKey = getMonthKey(game.date);
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(game);
    return acc;
  }, {});

  const sortedMonths = Object.keys(groupedByMonth).sort().reverse();
  
  const filteredCompletedGames = selectedMonth === 'all' 
    ? completedGames 
    : groupedByMonth[selectedMonth] || [];

  React.useEffect(() => {
    setSelectedSyncGameIds([]);
  }, [selectedMonth]);

  const allCompletedSelected =
    filteredCompletedGames.length > 0 &&
    filteredCompletedGames.every((game) => selectedSyncGameIds.includes(game.id));

  const toggleSelectAllCompleted = () => {
    if (allCompletedSelected) {
      setSelectedSyncGameIds([]);
    } else {
      setSelectedSyncGameIds(filteredCompletedGames.map((game) => game.id));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <Link to={createPageUrl('Home')} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Manage Games</h1>
          <div className="w-16" />
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => setShowGroupDialog(true)}
              disabled={selectedGames.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Create Group from Selected ({selectedGames.length})
            </Button>
            
          </div>
        </div>

        {/* Groups */}
        {groups.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Folder className="w-5 h-5" />
              My Groups
            </h2>
            <div className="space-y-3">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  to={`${createPageUrl('GroupResult')}?id=${group.id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                              <Folder className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{group.name}</div>
                              <div className="text-sm text-slate-500">{group.game_ids?.length || 0} games</div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirm(`Delete group "${group.name}"?`)) {
                                deleteGroupMutation.mutate(group.id);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 mr-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active Games */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Active Games</h2>
          {activeGames.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
              <p>No active games</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGames.map((game) => (
                <div
                  key={game.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-slate-300 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedGames.includes(game.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.checked) {
                          setSelectedGames([...selectedGames, game.id]);
                        } else {
                          setSelectedGames(selectedGames.filter(id => id !== game.id));
                        }
                      }}
                      className="mt-1 w-5 h-5 rounded"
                    />
                    <Link
                      to={`${createPageUrl('GameResult')}?id=${game.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate">
                        {game.name}
                      </div>
                      <div className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded inline-block mt-1">
                        {getGameTypeName(game.game_type)}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3" />
                        {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'No date'}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {game.players?.length || 0} players • PIN: {game.pin}
                      </div>
                    </Link>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          completeGameMutation.mutate(game.id);
                        }}
                        disabled={completeGameMutation.isPending}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap text-xs"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Close Game
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this game?')) {
                            deleteGameMutation.mutate(game.id);
                          }
                        }}
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Games Table */}
        {completedGames.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Completed Games</h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() =>
                    bulkSyncMutation.mutate(
                      filteredCompletedGames.filter((game) => selectedSyncGameIds.includes(game.id))
                    )
                  }
                  disabled={bulkSyncMutation.isPending || selectedSyncGameIds.length === 0}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${bulkSyncMutation.isPending ? 'animate-spin' : ''}`} />
                  {bulkSyncMutation.isPending ? 'Syncing...' : `Sync Selected (${selectedSyncGameIds.length})`}
                </Button>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white hover:border-emerald-300"
                >
                  <option value="all">All Months</option>
                  {sortedMonths.map((month) => {
                    const [year, monthNum] = month.split('-');
                    const monthName = new Date(year, parseInt(monthNum) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    return <option key={month} value={month}>{monthName}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-center py-3 px-4 text-slate-600 font-semibold w-10">
                      <input
                        type="checkbox"
                        checked={allCompletedSelected}
                        onChange={toggleSelectAllCompleted}
                        aria-label="Select all completed games"
                        className="w-4 h-4 rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">Game</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">Format</th>
                    <th className="text-center py-3 px-4 text-slate-600 font-semibold">Players</th>
                    <th className="text-right py-3 px-4 text-slate-600 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompletedGames.map((game) => (
                    <tr key={game.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedSyncGameIds.includes(game.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSyncGameIds([...selectedSyncGameIds, game.id]);
                            } else {
                              setSelectedSyncGameIds(selectedSyncGameIds.filter((id) => id !== game.id));
                            }
                          }}
                          aria-label={`Select ${game.name}`}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Link to={`${createPageUrl('GameResult')}?id=${game.id}`} className="text-emerald-600 hover:text-emerald-700 font-medium">
                          {game.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {game.date ? format(new Date(game.date), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                          {getGameTypeName(game.game_type)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700">
                        {game.players?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => submitToDiscgolfMutation.mutate(game)}
                            disabled={submitToDiscgolfMutation.isPending || bulkSyncMutation.isPending}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-xs"
                          >
                            {isGameSubmitted(game.id) ? 'Resync' : 'Submit'}
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm('Delete this game?')) {
                                deleteGameMutation.mutate(game.id);
                              }
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Group Creation Dialog */}
        {showGroupDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Create Game Group</h3>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Thursday Training"
                className="mb-4"
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowGroupDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
