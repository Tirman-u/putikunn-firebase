import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trash2, Share2, FolderPlus, Folder, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function ManageGames() {
  const [selectedGames, setSelectedGames] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupDialog, setShowGroupDialog] = useState(false);
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

  const deleteGameMutation = useMutation({
    mutationFn: (gameId) => base44.entities.Game.delete(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-games'] });
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
                <div key={group.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{group.name}</div>
                      <div className="text-sm text-slate-500">{group.game_ids?.length || 0} games</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games List */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3">My Games</h2>
          {games.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
              <p>No games yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-slate-100"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedGames.includes(game.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGames([...selectedGames, game.id]);
                        } else {
                          setSelectedGames(selectedGames.filter(id => id !== game.id));
                        }
                      }}
                      className="mt-1 w-5 h-5 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800">{game.name}</span>
                        <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                          {getGameTypeName(game.game_type)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'No date'}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {game.players?.length || 0} players • PIN: {game.pin}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
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
              ))}
            </div>
          )}
        </div>

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