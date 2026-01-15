import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trash2, Share2, FolderPlus, Folder, Calendar, ChevronRight, Upload, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ManageGames() {
  const [selectedGames, setSelectedGames] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
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
    mutationFn: (gameId) => base44.entities.Game.delete(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
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

  const submitToDiscgolfMutation = useMutation({
    mutationFn: async (game) => {
      const results = [];
      
      for (const playerName of game.players || []) {
        const playerPutts = game.player_putts?.[playerName] || [];
        const madePutts = playerPutts.filter(p => p.result === 'made').length;
        const totalPutts = playerPutts.length;
        const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;
        const score = game.total_points?.[playerName] || 0;

        // Check if player already has an entry
        const existingEntries = await base44.entities.LeaderboardEntry.filter({
          player_name: playerName,
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
            player_email: user?.email,
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
          player_email: user?.email,
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
      
      let message = 'Submitted to dg.ee & General leaderboards';
      if (updated > 0 || skipped > 0) {
        message += ` (${created} new, ${updated} updated, ${skipped} skipped)`;
      }
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
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

  const isGameSubmittedToDgEe = (gameId) => {
    return leaderboardEntries.some(entry => 
      entry.game_id === gameId && entry.leaderboard_type === 'discgolf_ee'
    );
  };

  const completedGames = games.filter(g => g.status === 'completed');
  const activeGames = games.filter(g => g.status !== 'completed');

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
          <Button
            onClick={() => setShowGroupDialog(true)}
            disabled={selectedGames.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Create Group from Selected ({selectedGames.length})
          </Button>
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
                      {game.pin !== '0000' && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            submitToDiscgolfMutation.mutate(game);
                          }}
                          disabled={submitToDiscgolfMutation.isPending || isGameSubmittedToDgEe(game.id)}
                          size="sm"
                          className={isGameSubmittedToDgEe(game.id) ? "bg-slate-400 whitespace-nowrap text-xs" : "bg-blue-600 hover:bg-blue-700 whitespace-nowrap text-xs"}
                        >
                          {isGameSubmittedToDgEe(game.id) ? 'Submitted' : 'Submit to dg.ee'}
                        </Button>
                      )}
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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
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