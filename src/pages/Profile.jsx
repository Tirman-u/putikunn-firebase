import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Camera, Trophy, Target, TrendingUp, Edit2, Save, X, Award, ExternalLink, Filter } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import AIInsights from '@/components/profile/AIInsights';
import AchievementsList, { getAchievements } from '@/components/profile/AchievementsList';
import LoadingState from '@/components/ui/loading-state';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [uploading, setUploading] = useState(false);
  const [sortBy, setSortBy] = useState('date'); // date, score, format
  const [filterFormat, setFilterFormat] = useState('all');
  const [filterPuttType, setFilterPuttType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const GAMES_PER_PAGE = 10;

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['user-games'],
    queryFn: async () => {
      const allGames = await base44.entities.Game.list();
      return allGames.filter(g => 
        g.players?.includes(user?.full_name) || g.host_user === user?.email
      );
    },
    enabled: !!user
  });

  const { data: tournamentPlayers = [], isLoading: tournamentsLoading } = useQuery({
    queryKey: ['user-tournaments'],
    queryFn: async () => {
      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      return allPlayers.filter(p => p.user_email === user?.email);
    },
    enabled: !!user
  });

  const { data: tournaments = [] } = useQuery({
    queryKey: ['putting-king-tournaments'],
    queryFn: () => base44.entities.PuttingKingTournament.list()
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user'], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setIsEditing(false);
    }
  });

  const handleEdit = () => {
    setEditData({
      display_name: user.display_name || '',
      bio: user.bio || '',
      profile_picture: user.profile_picture || '',
      gender: user.gender || ''
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

  if (userLoading || gamesLoading || tournamentsLoading) {
    return <LoadingState />;
  }

  const myDisplayName = user?.display_name || user?.full_name || user?.email;
  const myGames = games.filter(g => 
    g.players?.includes(myDisplayName) || 
    g.players?.includes(user?.full_name) ||
    g.players?.includes(user?.email) ||
    g.host_user === user?.email
  );
  
  // Calculate ATW stats by difficulty
  const atwGames = myGames.filter(g => g.game_type === 'around_the_world');
  const atwStatsByDifficulty = {
    easy: 0,
    medium: 0,
    hard: 0,
    ultra_hard: 0,
    impossible: 0
  };

  atwGames.forEach(game => {
    const playerState = game.atw_state?.[myDisplayName] || game.atw_state?.[user?.full_name] || game.atw_state?.[user?.email];
    if (playerState) {
      const difficulty = game.atw_config?.difficulty || 'medium';
      const score = game.total_points?.[myDisplayName] || game.total_points?.[user?.full_name] || game.total_points?.[user?.email] || 0;
      atwStatsByDifficulty[difficulty] = Math.max(atwStatsByDifficulty[difficulty], score);
    }
  });

  const atwStats = atwGames.reduce((acc, game) => {
    const playerState = game.atw_state?.[myDisplayName] || game.atw_state?.[user?.full_name] || game.atw_state?.[user?.email];
    if (playerState) {
      acc.totalLaps += playerState.laps_completed || 0;
      acc.totalTurns += playerState.turns_played || 0;
      const score = game.total_points?.[myDisplayName] || game.total_points?.[user?.full_name] || game.total_points?.[user?.email] || 0;
      acc.bestScore = Math.max(acc.bestScore, score);
    }
    return acc;
  }, { totalLaps: 0, totalTurns: 0, bestScore: 0 });

  // Calculate statistics
  const totalGames = myGames.length;
  const allPutts = myGames.flatMap(g => g.player_putts?.[myDisplayName] || g.player_putts?.[user?.full_name] || g.player_putts?.[user?.email] || []);
  const totalPutts = allPutts.length;
  const madePutts = allPutts.filter(p => p.result === 'made').length;
  const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;

  let totalPoints = 0;
  let bestScore = 0;
  myGames.forEach(game => {
    const points = game.total_points?.[myDisplayName] || game.total_points?.[user?.full_name] || game.total_points?.[user?.email] || 0;
    totalPoints += points;
    if (points > bestScore) bestScore = points;
  });
  const avgScore = myGames.length > 0 ? Math.round(totalPoints / myGames.length) : 0;

  // Distance analysis
  const distanceStats = allPutts.reduce((acc, putt) => {
    const dist = putt.distance;
    if (!acc[dist]) acc[dist] = { made: 0, attempts: 0 };
    if (putt.result === 'made') acc[dist].made += 1;
    acc[dist].attempts += 1;
    return acc;
  }, {});

  const distancePercentages = Object.entries(distanceStats).map(([dist, stats]) => ({
    distance: parseInt(dist),
    percentage: (stats.made / stats.attempts * 100).toFixed(1),
    attempts: stats.attempts
  })).sort((a, b) => a.distance - b.distance);

  const sweetSpot = distancePercentages.length > 0
    ? distancePercentages.reduce((best, curr) => 
        parseFloat(curr.percentage) > parseFloat(best.percentage) ? curr : best
      )
    : null;

  const challengeArea = distancePercentages.length > 0
    ? distancePercentages.reduce((worst, curr) => 
        parseFloat(curr.percentage) < parseFloat(worst.percentage) ? curr : worst
      )
    : null;

  // Group game stats
  const groupGames = games.filter(g => g.group_id);
  const groupScores = groupGames
    .filter(g => g.players?.includes(myDisplayName) || g.players?.includes(user?.full_name))
    .map(g => g.total_points?.[myDisplayName] || g.total_points?.[user?.full_name] || 0);
  const avgGroupScore = groupScores.length > 0
    ? (groupScores.reduce((sum, s) => sum + s, 0) / groupScores.length).toFixed(1)
    : 0;

  // Achievements
  const isSuperAdmin = user?.app_role === 'super_admin';
  const achievements = getAchievements({
    totalGames,
    puttingPercentage,
    bestScore,
    avgScore,
    allPutts,
    myGames,
    myName: myDisplayName
  }, isSuperAdmin);

  const unlockedAchievements = achievements.filter(a => a.unlocked);

  // Calculate stats by putt type
  const puttTypeStats = {
    regular: { made: 0, total: 0, score: 0, count: 0 },
    straddle: { made: 0, total: 0, score: 0, count: 0 },
    turbo: { made: 0, total: 0, score: 0, count: 0 }
  };
  
  myGames.forEach(game => {
    const puttType = game.putt_type || 'regular';
    const putts = game.player_putts?.[myDisplayName] || game.player_putts?.[user?.full_name] || game.player_putts?.[user?.email] || [];
    const made = putts.filter(p => p.result === 'made').length;
    const score = game.total_points?.[myDisplayName] || game.total_points?.[user?.full_name] || game.total_points?.[user?.email] || 0;
    
    puttTypeStats[puttType].made += made;
    puttTypeStats[puttType].total += putts.length;
    puttTypeStats[puttType].score = Math.max(puttTypeStats[puttType].score, score);
    if (score > 0) puttTypeStats[puttType].count += 1;
  });

  // Calculate best scores by game format
  const gameFormatStats = {
    classic: 0,
    short: 0,
    long: 0,
    back_and_forth: 0,
    streak_challenge: 0,
    random_distance: 0,
    around_the_world: 0
  };

  myGames.forEach(game => {
    const gameType = game.game_type || 'classic';
    const score = game.total_points?.[myDisplayName] || game.total_points?.[user?.full_name] || game.total_points?.[user?.email] || 0;
    gameFormatStats[gameType] = Math.max(gameFormatStats[gameType], score);
  });

  // Filter and sort games
  let filteredGames = myGames.filter(game => {
    if (filterFormat === 'all') return true;
    return game.game_type === filterFormat;
  });
  
  filteredGames = filteredGames.filter(game => {
    if (filterPuttType === 'all') return true;
    return (game.putt_type || 'regular') === filterPuttType;
  });

  filteredGames = filteredGames.sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date || 0) - new Date(a.date || 0);
    } else if (sortBy === 'score') {
      const scoreA = a.total_points?.[myDisplayName] || a.total_points?.[user?.full_name] || 0;
      const scoreB = b.total_points?.[myDisplayName] || b.total_points?.[user?.full_name] || 0;
      return scoreB - scoreA;
    } else if (sortBy === 'format') {
      return (a.game_type || 'classic').localeCompare(b.game_type || 'classic');
    }
    return 0;
  });

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
            <div className="flex items-start gap-4">
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
                <h2 className="text-2xl font-bold text-slate-800">{user.display_name || user.full_name}</h2>
                {user.display_name && (
                  <p className="text-sm text-slate-500">{user.full_name}</p>
                )}
                <p className="text-slate-500">{user.email}</p>
                {user.gender && (
                  <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold mt-1">
                    {user.gender === 'M' ? 'Male' : 'Female'}
                  </span>
                )}
                {user.bio && <p className="text-slate-600 mt-2">{user.bio}</p>}
              </div>
              <Button onClick={handleEdit} variant="outline" size="sm">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
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
                     {editData.display_name?.charAt(0) || user?.full_name?.charAt(0) || 'U'}
                   </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-emerald-700">
                   <Camera className="w-4 h-4 text-white" />
                   <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  </div>
                  <div className="flex-1 space-y-3">
                  <div>
                   <label className="text-sm text-slate-600 mb-1 block">Display Name</label>
                   <Input 
                     value={editData.display_name}
                     onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                     placeholder={user?.full_name}
                   />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Gender</label>
                    <Select 
                      value={editData.gender || 'none'}
                      onValueChange={(value) => setEditData({ ...editData, gender: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="N">Female</SelectItem>
                      </SelectContent>
                    </Select>
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
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
           <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 mb-2">
               <Trophy className="w-5 h-5 text-emerald-600" />
               <span className="text-sm text-slate-500">Games</span>
             </div>
             <div className="text-2xl font-bold text-slate-800">{totalGames}</div>
           </div>
           {atwStats.totalLaps > 0 && (
             <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
               <div className="flex items-center gap-2 mb-2">
                 <Trophy className="w-5 h-5 text-emerald-600" />
                 <span className="text-sm text-slate-500">ATW Laps</span>
               </div>
               <div className="text-2xl font-bold text-emerald-600">{atwStats.totalLaps}</div>
             </div>
           )}
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

         {/* Game Format Best Scores */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Best Scores by Format
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'classic', label: 'Classic', unit: 'pts' },
                { key: 'short', label: 'Short', unit: 'pts' },
                { key: 'long', label: 'Long', unit: 'pts' },
                { key: 'back_and_forth', label: 'Back & Forth', unit: 'pts' },
                { key: 'streak_challenge', label: 'Streak', unit: 'putts' },
                { key: 'random_distance', label: 'Random', unit: 'pts' }
              ].map((format) => (
                <div key={format.key} className="p-3 bg-gradient-to-br from-amber-50 to-emerald-50 rounded-xl border border-amber-100">
                  <div className="text-xs font-semibold text-slate-600 mb-1">{format.label}</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {gameFormatStats[format.key]}
                    <span className="text-xs ml-1 text-slate-500">{format.unit}</span>
                  </div>
                </div>
              ))}
              
              {/* Around The World with all difficulties */}
              <div className="p-3 bg-gradient-to-br from-amber-50 to-emerald-50 rounded-xl border border-amber-100">
                <div className="text-xs font-semibold text-slate-600 mb-1">Around The World</div>
                <div className="space-y-1">
                  {Object.entries(atwStatsByDifficulty).map(([difficulty, score]) => {
                    const labels = {
                      easy: 'Easy',
                      medium: 'Med',
                      hard: 'Hard',
                      ultra_hard: 'Ultra',
                      impossible: 'Imp'
                    };
                    if (score === 0) return null;
                    return (
                      <div key={difficulty} className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">{labels[difficulty]}:</span>
                        <span className="text-sm font-bold text-emerald-600">{score}</span>
                      </div>
                    );
                  })}
                  {Object.values(atwStatsByDifficulty).every(s => s === 0) && (
                    <div className="text-2xl font-bold text-emerald-600">
                      0<span className="text-xs ml-1 text-slate-500">pts</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

         {/* Putt Style Performance */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Putt Style Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['regular', 'straddle', 'turbo'].map((style) => {
                const stats = puttTypeStats[style];
                const accuracy = stats.total > 0 ? ((stats.made / stats.total) * 100).toFixed(1) : 0;
                const styleName = style === 'regular' ? 'Regular' : style === 'straddle' ? 'Straddle' : 'Turbo';
                return (
                  <div key={style} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-sm font-semibold text-slate-700 mb-2">{styleName}</div>
                    <div className="text-2xl font-bold text-emerald-600 mb-1">{stats.score}</div>
                    <div className="text-xs text-slate-500 mb-2">Best: {stats.count} games</div>
                    <div className="text-xs text-slate-600">
                      {stats.total > 0 ? `${accuracy}% (${stats.made}/${stats.total})` : 'No games'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        {/* Performance Analysis */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Performance Analysis
          </h2>
          
          {sweetSpot && (
            <div className="mb-4 p-4 bg-emerald-50 rounded-xl">
              <div className="text-sm text-emerald-700 font-semibold mb-1">Sweet Spot</div>
              <div className="text-2xl font-bold text-emerald-600">
                {sweetSpot.distance}m • {sweetSpot.percentage}%
              </div>
              <div className="text-xs text-emerald-600">{sweetSpot.attempts} attempts</div>
            </div>
          )}

          {challengeArea && (
            <div className="mb-4 p-4 bg-amber-50 rounded-xl">
              <div className="text-sm text-amber-700 font-semibold mb-1">Challenge Area</div>
              <div className="text-2xl font-bold text-amber-600">
                {challengeArea.distance}m • {challengeArea.percentage}%
              </div>
              <div className="text-xs text-amber-600">{challengeArea.attempts} attempts</div>
            </div>
          )}

          {/* Distance Breakdown */}
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Distance Performance</div>
            <div className="space-y-2">
              {distancePercentages.map((stat) => (
                <div key={stat.distance} className="flex items-center gap-3">
                  <div className="w-12 text-sm font-medium text-slate-600">{stat.distance}m</div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm font-medium text-slate-700 text-right">
                    {stat.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Group Game Stats */}
        {groupGames.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Group Game Stats
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Average Score</div>
                <div className="text-3xl font-bold text-slate-700">{avgGroupScore}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Best Score</div>
                <div className="text-3xl font-bold text-emerald-600">{bestScore}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tournament Results */}
        {tournamentPlayers.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              Tournament Results
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Tournament</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Wins</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Losses</th>
                    <th className="text-right py-3 px-2 text-slate-600 font-semibold">Points</th>
                    <th className="text-right py-3 px-2 text-slate-600 font-semibold">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentPlayers.map((player) => {
                    const tournament = tournaments.find(t => t.id === player.tournament_id);
                    const accuracy = player.total_attempts > 0 
                      ? ((player.total_made_putts / player.total_attempts) * 100).toFixed(1)
                      : 0;

                    return (
                      <tr key={player.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-2 font-medium text-slate-700">
                          {tournament?.name || 'Unknown'}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-700 font-semibold">
                          {player.wins}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-700 font-semibold">
                          {player.losses}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-purple-600">
                          {player.tournament_points}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-700">
                          {accuracy}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Insights */}
        <AIInsights games={myGames} userName={myDisplayName} />

        {/* Game History with Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-slate-800">Game History</h3>
             <div className="flex flex-wrap gap-2">
               <Select value={filterFormat} onValueChange={() => { setFilterFormat(arguments[0]); setCurrentPage(1); }}>
                 <SelectTrigger className="w-32">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Formats</SelectItem>
                   <SelectItem value="classic">Classic</SelectItem>
                   <SelectItem value="short">Short</SelectItem>
                   <SelectItem value="long">Long</SelectItem>
                   <SelectItem value="back_and_forth">Back & Forth</SelectItem>
                   <SelectItem value="streak_challenge">Streak</SelectItem>
                   <SelectItem value="random_distance">Random</SelectItem>
                   <SelectItem value="around_the_world">Around The World</SelectItem>
                   </SelectContent>
                   </Select>
               <Select value={filterPuttType} onValueChange={() => { setFilterPuttType(arguments[0]); setCurrentPage(1); }}>
                 <SelectTrigger className="w-32">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Styles</SelectItem>
                   <SelectItem value="regular">Regular</SelectItem>
                   <SelectItem value="straddle">Straddle</SelectItem>
                   <SelectItem value="turbo">Turbo</SelectItem>
                 </SelectContent>
               </Select>
               <Select value={sortBy} onValueChange={setSortBy}>
                 <SelectTrigger className="w-32">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="date">Date</SelectItem>
                   <SelectItem value="score">Score</SelectItem>
                   <SelectItem value="format">Format</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>

          {filteredGames.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No games found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                     <tr className="border-b border-slate-200">
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Game</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Date</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Format</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Style</th>
                       <th className="text-right py-3 px-2 text-slate-600 font-semibold">Score</th>
                       <th className="text-right py-3 px-2 text-slate-600 font-semibold">%</th>
                       <th className="text-center py-3 px-2 text-slate-600 font-semibold">Status</th>
                       <th className="text-center py-3 px-2 text-slate-600 font-semibold"></th>
                     </tr>
                   </thead>
                  <tbody>
                    {filteredGames.slice((currentPage - 1) * GAMES_PER_PAGE, currentPage * GAMES_PER_PAGE).map((game) => {
                      const putts = game.player_putts?.[myDisplayName] || game.player_putts?.[user?.full_name] || game.player_putts?.[user?.email] || [];
                      const made = putts.filter(p => p.result === 'made').length;
                      const percentage = putts.length > 0 ? ((made / putts.length) * 100).toFixed(0) : 0;
                      const score = game.total_points?.[myDisplayName] || game.total_points?.[user?.full_name] || game.total_points?.[user?.email] || 0;
                      const gameFormat = GAME_FORMATS[game.game_type || 'classic'];

                      return (
                        <tr key={game.id} className="border-b border-slate-100 hover:bg-slate-50">
                           <td className="py-3 px-2 font-medium text-slate-700">{game.name}</td>
                           <td className="py-3 px-2 text-slate-700">
                             {game.date ? format(new Date(game.date), 'MMM d, yyyy') : '-'}
                           </td>
                           <td className="py-3 px-2">
                             <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                               {gameFormat.name}
                             </span>
                           </td>
                           <td className="py-3 px-2">
                             <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                               {game.putt_type === 'regular' ? 'Regular' : game.putt_type === 'straddle' ? 'Straddle' : 'Turbo'}
                             </span>
                           </td>
                           <td className="py-3 px-2 text-right font-bold text-emerald-600">
                             {score}
                           </td>
                           <td className="py-3 px-2 text-right text-slate-700">
                             {percentage}%
                           </td>
                           <td className="py-3 px-2 text-center">
                             <span className={`text-xs px-2 py-1 rounded ${
                               game.status === 'active' 
                                 ? 'bg-amber-100 text-amber-700' 
                                 : 'bg-slate-100 text-slate-600'
                             }`}>
                               {game.status === 'active' ? 'In Progress' : 'Completed'}
                             </span>
                           </td>
                           <td className="py-3 px-2 text-center">
                             {game.status === 'active' ? (
                               <Link
                                 to={game.game_type === 'around_the_world' 
                                   ? createPageUrl('Home') + '?mode=atw-game&gameId=' + game.id
                                   : createPageUrl('Home') + '?mode=player&gameId=' + game.id}
                                 className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                               >
                                 <ExternalLink className="w-4 h-4" />
                               </Link>
                             ) : (
                               <Link
                                 to={`${createPageUrl('GameResult')}?id=${game.id}`}
                                 className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                               >
                                 <ExternalLink className="w-4 h-4" />
                               </Link>
                             )}
                           </td>
                         </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                <div className="text-sm text-slate-500">
                  Showing {Math.min((currentPage - 1) * GAMES_PER_PAGE + 1, filteredGames.length)} - {Math.min(currentPage * GAMES_PER_PAGE, filteredGames.length)} of {filteredGames.length} games
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(filteredGames.length / GAMES_PER_PAGE) }).map((_, i) => (
                      <Button
                        key={i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        variant={currentPage === i + 1 ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                      >
                        {i + 1}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setCurrentPage(Math.min(Math.ceil(filteredGames.length / GAMES_PER_PAGE), currentPage + 1))}
                    disabled={currentPage === Math.ceil(filteredGames.length / GAMES_PER_PAGE)}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              Achievements ({unlockedAchievements.length}/{achievements.length})
            </h3>
          </div>
          <AchievementsList achievements={achievements} />
        </div>
      </div>
    </div>
  );
}
