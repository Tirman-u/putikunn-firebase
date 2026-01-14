import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, Trophy, Target, TrendingUp, Edit2, Save, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format as formatDate } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [uploading, setUploading] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['user-games'],
    queryFn: async () => {
      const allGames = await base44.entities.Game.list();
      return allGames.filter(g => 
        g.status === 'completed' && 
        (g.players?.includes(user?.full_name) || g.host_user === user?.email)
      ).sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    enabled: !!user
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setIsEditing(false);
    }
  });

  const handleEdit = () => {
    setEditData({
      full_name: user.full_name,
      bio: user.bio || '',
      profile_picture: user.profile_picture || ''
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateUserMutation.mutate(editData);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditData({ ...editData, profile_picture: file_url });
    } catch (error) {
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  if (userLoading || gamesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Calculate statistics
  const totalGames = games.length;
  const playerGames = games.filter(g => g.players?.includes(user.full_name));
  
  let totalPutts = 0;
  let madePutts = 0;
  let totalPoints = 0;
  let bestScore = 0;

  playerGames.forEach(game => {
    const putts = game.player_putts?.[user.full_name] || [];
    totalPutts += putts.length;
    madePutts += putts.filter(p => p.result === 'made').length;
    const points = game.total_points?.[user.full_name] || 0;
    totalPoints += points;
    if (points > bestScore) bestScore = points;
  });

  const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
  const avgScore = playerGames.length > 0 ? Math.round(totalPoints / playerGames.length) : 0;

  // Achievements
  const achievements = [
    { 
      id: 'first_game', 
      name: 'First Game', 
      description: 'Completed your first game',
      unlocked: totalGames > 0,
      icon: '🎯'
    },
    { 
      id: 'ten_games', 
      name: '10 Games', 
      description: 'Played 10 games',
      unlocked: totalGames >= 10,
      icon: '🔥'
    },
    { 
      id: 'perfect_round', 
      name: 'Perfect Round', 
      description: 'Made all 5 putts in a round',
      unlocked: playerGames.some(g => {
        const putts = g.player_putts?.[user.full_name] || [];
        for (let i = 0; i < putts.length - 4; i += 5) {
          const round = putts.slice(i, i + 5);
          if (round.length === 5 && round.every(p => p.result === 'made')) return true;
        }
        return false;
      }),
      icon: '⭐'
    },
    { 
      id: 'high_scorer', 
      name: 'High Scorer', 
      description: 'Score over 500 points in a game',
      unlocked: bestScore > 500,
      icon: '🏆'
    },
    { 
      id: 'sharpshooter', 
      name: 'Sharpshooter', 
      description: 'Achieve 90%+ putting accuracy',
      unlocked: parseFloat(puttingPercentage) >= 90,
      icon: '🎖️'
    }
  ];

  const unlockedAchievements = achievements.filter(a => a.unlocked);

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
          <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
          <div className="w-16" />
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          {!isEditing ? (
            <>
              <div className="flex items-start gap-4 mb-4">
                <div className="relative">
                  {user.profile_picture ? (
                    <img 
                      src={user.profile_picture} 
                      alt={user.full_name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-3xl font-bold text-emerald-600">
                      {user.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-800">{user.full_name}</h2>
                  <p className="text-slate-500">{user.email}</p>
                  {user.bio && <p className="text-slate-600 mt-2">{user.bio}</p>}
                </div>
                <Button onClick={handleEdit} variant="outline" size="sm">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  {editData.profile_picture ? (
                    <img 
                      src={editData.profile_picture} 
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-3xl font-bold text-emerald-600">
                      {editData.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-emerald-700">
                    <Camera className="w-4 h-4 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Name</label>
                    <Input 
                      value={editData.full_name}
                      onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Bio</label>
                    <Textarea 
                      value={editData.bio}
                      onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={uploading || updateUserMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-slate-500">Games</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{totalGames}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-slate-500">Accuracy</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{puttingPercentage}%</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-slate-500">Avg Score</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{avgScore}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-slate-500">Best Score</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{bestScore}</div>
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Achievements ({unlockedAchievements.length}/{achievements.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {achievements.map(achievement => (
              <div 
                key={achievement.id}
                className={`p-4 rounded-xl border-2 ${
                  achievement.unlocked 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-slate-50 border-slate-200 opacity-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{achievement.icon}</div>
                  <div>
                    <div className="font-bold text-slate-800">{achievement.name}</div>
                    <div className="text-sm text-slate-600">{achievement.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Games */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Games</h3>
          <div className="space-y-3">
            {games.slice(0, 10).map(game => {
              const gameFormat = GAME_FORMATS[game.game_type || 'classic'];
              const playerScore = game.total_points?.[user.full_name] || 0;
              const playerPutts = game.player_putts?.[user.full_name] || [];
              const playerMade = playerPutts.filter(p => p.result === 'made').length;
              const playerPercentage = playerPutts.length > 0 ? ((playerMade / playerPutts.length) * 100).toFixed(1) : 0;

              return (
                <Link
                  key={game.id}
                  to={createPageUrl('GameResult') + '?id=' + game.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all"
                >
                  <div>
                    <div className="font-bold text-slate-800">{game.name}</div>
                    <div className="text-sm text-slate-500">
                      {gameFormat.name} • {game.date ? formatDate(new Date(game.date), 'MMM d, yyyy') : 'No date'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-emerald-600">{playerScore}</div>
                    <div className="text-sm text-slate-500">{playerPercentage}%</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}