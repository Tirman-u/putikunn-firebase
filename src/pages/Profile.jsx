import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Trophy, Target, TrendingUp, Edit2, Save, X, Award, ExternalLink } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import BackButton from '@/components/ui/back-button';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import AIInsights from '@/components/profile/AIInsights';
import AchievementsList, { getAchievements } from '@/components/profile/AchievementsList';
import LoadingState from '@/components/ui/loading-state';
import { deleteGameAndLeaderboardEntries } from '@/lib/leaderboard-utils';
import { toast } from 'sonner';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isPuttingKingEnabled = FEATURE_FLAGS.puttingKing;
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [uploading, setUploading] = useState(false);
  const [sortBy, setSortBy] = useState('date'); // date, score, format
  const [filterFormat, setFilterFormat] = useState('all');
  const [filterPuttType, setFilterPuttType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const GAMES_PER_PAGE = 10;

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['user-games', user?.email, user?.full_name, user?.display_name],
    queryFn: async () => {
      if (!user) return [];
      const results = [];
      if (user.email) {
        results.push(...await base44.entities.Game.filter({ host_user: user.email }));
      }
      if (user.full_name) {
        results.push(...await base44.entities.Game.filter({ players: { $arrayContains: user.full_name } }));
      }
      if (user.display_name && user.display_name !== user.full_name) {
        results.push(...await base44.entities.Game.filter({ players: { $arrayContains: user.display_name } }));
      }
      const byId = new Map();
      results.forEach((game) => {
        if (game?.id && !byId.has(game.id)) byId.set(game.id, game);
      });
      return Array.from(byId.values());
    },
    enabled: !!user
  });

  const { data: tournamentPlayers = [], isLoading: tournamentPlayersLoading } = useQuery({
    queryKey: ['user-tournaments', user?.email],
    queryFn: () => base44.entities.PuttingKingPlayer.filter({ user_email: user.email }),
    enabled: isPuttingKingEnabled && !!user?.email
  });

  const tournamentIds = React.useMemo(() => {
    return Array.from(new Set(tournamentPlayers.map(p => p.tournament_id).filter(Boolean)));
  }, [tournamentPlayers]);

  const { data: tournaments = [], isLoading: tournamentsLoading } = useQuery({
    queryKey: ['putting-king-tournaments', tournamentIds.join('|')],
    queryFn: () => {
      if (!tournamentIds.length) return [];
      return base44.entities.PuttingKingTournament.filter({ id: { $in: tournamentIds } });
    },
    enabled: isPuttingKingEnabled && tournamentIds.length > 0
  });

  React.useEffect(() => {
    setSelectedGameIds([]);
  }, [filterFormat, filterPuttType, sortBy, currentPage]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user'], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setIsEditing(false);
    }
  });

  const deleteGamesMutation = useMutation({
    mutationFn: async (gameIds) => {
      let deleted = 0;
      for (const id of gameIds) {
        if (!id) continue;
        await deleteGameAndLeaderboardEntries(id);
        deleted += 1;
      }
      return deleted;
    },
    onSuccess: (count) => {
      toast.success(`Kustutatud ${count} mängu`);
      setSelectedGameIds([]);
      queryClient.invalidateQueries({ queryKey: ['user-games'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Kustutamine ebaõnnestus');
    }
  });

  const handleEdit = () => {
    if (!user) return;
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
      alert('Pildi üleslaadimine ebaõnnestus');
    } finally {
      setUploading(false);
    }
  };

  if (userLoading || gamesLoading || (isPuttingKingEnabled && (tournamentPlayersLoading || tournamentsLoading))) {
    return <LoadingState />;
  }
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
          <p className="text-slate-700 mb-4">Kasutaja profiili ei õnnestu laadida.</p>
          <Button onClick={() => navigate(createPageUrl('Login'))}>Logi uuesti sisse</Button>
        </div>
      </div>
    );
  }

  const myDisplayName = user?.display_name || user?.full_name || user?.email || 'Mängija';
  const userRole = user?.app_role || 'user';
  const isAdmin = ['admin', 'super_admin'].includes(userRole);
  const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
  const normalizedDisplayName = normalize(myDisplayName);
  const normalizedFullName = normalize(user?.full_name);
  const normalizedEmail = normalize(user?.email);

  const isPlayerInGame = (game) => {
    if (!game) return false;
    const players = (game.players || []).map(normalize);
    if (
      (normalizedDisplayName && players.includes(normalizedDisplayName)) ||
      (normalizedFullName && players.includes(normalizedFullName)) ||
      (normalizedEmail && players.includes(normalizedEmail))
    ) {
      return true;
    }

    const playerEmails = Object.values(game.player_emails || {}).map(normalize);
    if (normalizedEmail && playerEmails.includes(normalizedEmail)) return true;

    const playerUids = Object.values(game.player_uids || {});
    if (user?.id && playerUids.includes(user.id)) return true;

    return false;
  };

  const myGames = games.filter((game) => isPlayerInGame(game));
  const canDeleteGame = (game) => {
    if (!game) return false;
    if (isAdmin) return true;
    if (game.pin === '0000') return true;
    return game.host_user === user?.email;
  };
  
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

  const trendGames = myGames
    .map((game) => {
      const putts = game.player_putts?.[myDisplayName] || game.player_putts?.[user?.full_name] || game.player_putts?.[user?.email] || [];
      const total = putts.length;
      if (total === 0) return null;
      const made = putts.filter(p => p.result === 'made').length;
      const accuracy = Math.round((made / total) * 1000) / 10;
      return {
        id: game.id,
        date: game.date || game.created_date || null,
        accuracy
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const trendData = trendGames.slice(-10);
  const trendDelta = trendData.length > 1
    ? Math.round((trendData[trendData.length - 1].accuracy - trendData[0].accuracy) * 10) / 10
    : 0;
  const trendPoints = trendData.map((item, idx) => {
    const x = trendData.length === 1 ? 50 : (idx / (trendData.length - 1)) * 100;
    const clamped = Math.max(0, Math.min(100, item.accuracy));
    const y = 100 - clamped;
    return { x, y };
  });
  const trendLine = trendPoints.map((point) => `${point.x},${point.y}`).join(' ');

  // Distance analysis
  const distanceStats = allPutts.reduce((acc, putt) => {
    const dist = putt.distance;
    if (!acc[dist]) acc[dist] = { made: 0, attempts: 0 };
    if (putt.result === 'made') acc[dist].made += 1;
    acc[dist].attempts += 1;
    return acc;
  }, {});

  const distanceBuckets = Object.entries(distanceStats).map(([dist, stats]) => {
    const attempts = stats.attempts || 0;
    const made = stats.made || 0;
    const misses = Math.max(0, attempts - made);
    const accuracy = attempts > 0 ? Math.round((made / attempts) * 1000) / 10 : 0;
    return {
      distance: parseInt(dist, 10),
      attempts,
      made,
      misses,
      accuracy
    };
  }).sort((a, b) => a.distance - b.distance);

  const totalDistanceAttempts = distanceBuckets.reduce((sum, item) => sum + item.attempts, 0);

  const comfortZone = distanceBuckets.length > 0
    ? distanceBuckets.reduce((best, curr) => {
        if (curr.attempts > best.attempts) return curr;
        if (curr.attempts === best.attempts && curr.accuracy > best.accuracy) return curr;
        if (curr.attempts === best.attempts && curr.accuracy === best.accuracy && curr.distance > best.distance) return curr;
        return best;
      })
    : null;

  const comfortShare = comfortZone && totalDistanceAttempts > 0
    ? Math.round((comfortZone.attempts / totalDistanceAttempts) * 1000) / 10
    : 0;

  const dropCandidates = comfortZone
    ? distanceBuckets.filter((entry) => entry.distance > comfortZone.distance && entry.attempts > 0)
    : [];

  const dropCause = dropCandidates.length > 0
    ? dropCandidates.reduce((worst, curr) => {
        if (curr.misses > worst.misses) return curr;
        if (curr.misses === worst.misses && curr.accuracy < worst.accuracy) return curr;
        if (curr.misses === worst.misses && curr.accuracy === worst.accuracy && curr.distance > worst.distance) return curr;
        return worst;
      })
    : (distanceBuckets.length > 0
        ? distanceBuckets.reduce((worst, curr) =>
            curr.accuracy < worst.accuracy ? curr : worst
          )
        : null);

  const distancePercentages = distanceBuckets.map((stat) => ({
    distance: stat.distance,
    percentage: stat.accuracy,
    attempts: stat.attempts
  }));

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
    turbo: { made: 0, total: 0, score: 0, count: 0 },
    kneeling: { made: 0, total: 0, score: 0, count: 0 },
    marksman: { made: 0, total: 0, score: 0, count: 0 }
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
    mini_league: 0,
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

  const pageGames = filteredGames.slice((currentPage - 1) * GAMES_PER_PAGE, currentPage * GAMES_PER_PAGE);
  const selectablePageIds = pageGames.filter(canDeleteGame).map((game) => game.id);
  const allPageSelected = selectablePageIds.length > 0 && selectablePageIds.every((id) => selectedGameIds.includes(id));

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedGameIds((prev) => prev.filter((id) => !selectablePageIds.includes(id)));
    } else {
      setSelectedGameIds((prev) => Array.from(new Set([...prev, ...selectablePageIds])));
    }
  };

  const toggleGameSelection = (gameId) => {
    setSelectedGameIds((prev) => (
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    ));
  };

  const handleBulkDelete = () => {
    const deletableIds = selectedGameIds.filter((id) => {
      const game = filteredGames.find((g) => g.id === id);
      return canDeleteGame(game);
    });
    if (deletableIds.length === 0) {
      toast.error('Pole midagi kustutada');
      return;
    }
    if (!window.confirm(`Kustutada ${deletableIds.length} mängu?`)) return;
    deleteGamesMutation.mutate(deletableIds);
  };

  const cardClass = "bg-white/80 rounded-[28px] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)]">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-5 pt-2">
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3">
            <BackButton onClick={() => navigate(-1)} showLabel={false} className="h-9 w-9 justify-center px-0" />
            <div className="text-center text-sm font-semibold text-slate-800">Minu profiil</div>
            <div className="h-9 w-9" />
          </div>
        </div>

        {/* Profile Card */}
        <div className={`${cardClass} mb-6`}>
          {!isEditing ? (
            <div className="flex items-start gap-4">
              <div className="relative">
                {user?.profile_picture ? (
                  <img 
                    src={user.profile_picture} 
                    alt={user.full_name || user.display_name || user.email}
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-600">
                    {user?.full_name?.charAt(0) || user?.display_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-800">{user.display_name || user.full_name || user.email}</h2>
                {user.display_name && user.full_name && (
                  <p className="text-xs text-slate-500">{user.full_name}</p>
                )}
                <p className="text-xs text-slate-500">{user.email || '-'}</p>
                {user.gender && (
                  <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold mt-1">
                    {user.gender === 'M' ? 'Mees' : 'Naine'}
                  </span>
                )}
                {user.bio && <p className="text-sm text-slate-600 mt-2">{user.bio}</p>}
              </div>
              <Button onClick={handleEdit} variant="outline" size="sm" className="rounded-2xl">
                <Edit2 className="w-4 h-4 mr-2" />
                Muuda
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  {editData.profile_picture ? (
                    <img 
                      src={editData.profile_picture} 
                      alt="Profiil"
                      className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100"
                    />
                  ) : (
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-600">
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
                   <label className="text-sm text-slate-600 mb-1 block">Kuvatav nimi</label>
                   <Input 
                     value={editData.display_name}
                     onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                     placeholder={user?.full_name}
                   />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Sugu</label>
                    <Select 
                      value={editData.gender || 'none'}
                      onValueChange={(value) => setEditData({ ...editData, gender: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vali sugu" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Määramata</SelectItem>
                        <SelectItem value="M">Mees</SelectItem>
                        <SelectItem value="N">Naine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Tutvustus</label>
                    <Textarea 
                      value={editData.bio}
                      onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                      placeholder="Kirjelda ennast..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={uploading || updateUserMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvesta
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Tühista
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
           <div className="bg-white/80 rounded-[24px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur">
             <div className="flex items-center gap-2 text-[11px] text-slate-500">
               <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                 <Trophy className="w-4 h-4" />
               </span>
               <span>Mängud</span>
             </div>
             <div className="mt-2 text-2xl font-semibold text-slate-800">{totalGames}</div>
           </div>
           {atwStats.totalLaps > 0 && (
             <div className="bg-white/80 rounded-[24px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur">
               <div className="flex items-center gap-2 text-[11px] text-slate-500">
                 <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                   <Trophy className="w-4 h-4" />
                 </span>
                 <span>ATW ringe</span>
               </div>
               <div className="mt-2 text-2xl font-semibold text-emerald-600">{atwStats.totalLaps}</div>
             </div>
           )}
           <div className="bg-white/80 rounded-[24px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur">
             <div className="flex items-center gap-2 text-[11px] text-slate-500">
               <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                 <Target className="w-4 h-4" />
               </span>
               <span>Täpsus</span>
             </div>
             <div className="mt-2 text-2xl font-semibold text-slate-800">{puttingPercentage}%</div>
           </div>
           <div className="bg-white/80 rounded-[24px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur">
             <div className="flex items-center gap-2 text-[11px] text-slate-500">
               <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                 <TrendingUp className="w-4 h-4" />
               </span>
               <span>Keskmine skoor</span>
             </div>
             <div className="mt-2 text-2xl font-semibold text-slate-800">{avgScore}</div>
           </div>
           <div className="bg-white/80 rounded-[24px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur">
             <div className="flex items-center gap-2 text-[11px] text-slate-500">
               <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                 <Trophy className="w-4 h-4" />
               </span>
               <span>Parim skoor</span>
             </div>
             <div className="mt-2 text-2xl font-semibold text-slate-800">{bestScore}</div>
           </div>
         </div>

         {/* Putt % Trend */}
         <div className={`${cardClass} mb-6`}>
           <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 text-slate-800 font-semibold">
               <TrendingUp className="w-5 h-5 text-emerald-600" />
               Puti % trend (viimased 10 mängu)
             </div>
             {trendData.length > 1 && (
               <div className={`text-sm font-semibold ${trendDelta >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                 {trendDelta >= 0 ? '+' : ''}{trendDelta}%
               </div>
             )}
           </div>
           {trendData.length === 0 ? (
             <div className="text-sm text-slate-400">Pole piisavalt andmeid trendi jaoks.</div>
           ) : (
             <div className="space-y-2">
               <div className="relative h-28">
                 <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                   <defs>
                     <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                       <stop offset="0%" stopColor="#10b981" />
                       <stop offset="100%" stopColor="#059669" />
                     </linearGradient>
                   </defs>
                   <line x1="0" y1="100" x2="100" y2="100" stroke="#e2e8f0" strokeWidth="0.5" />
                   <line x1="0" y1="66" x2="100" y2="66" stroke="#f1f5f9" strokeWidth="0.5" />
                   <line x1="0" y1="33" x2="100" y2="33" stroke="#f1f5f9" strokeWidth="0.5" />
                   {trendPoints.length > 1 && (
                     <polyline
                       fill="none"
                       stroke="url(#trendLine)"
                       strokeWidth="2"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       points={trendLine}
                     />
                   )}
                   {trendPoints.map((point, idx) => (
                     <circle
                       key={`trend-point-${idx}`}
                       cx={point.x}
                       cy={point.y}
                       r="2"
                       fill="#10b981"
                     />
                   ))}
                 </svg>
               </div>
               <div className="flex justify-between gap-2 text-[10px] text-slate-400">
                 {trendData.map((item, idx) => (
                   <span key={`${item.id}-label-${idx}`} className="flex-1 text-center">
                     {item.date ? format(new Date(item.date), 'd.M') : '-'}
                   </span>
                 ))}
               </div>
             </div>
           )}
         </div>

         {/* Game Format Best Scores */}
         <div className={`${cardClass} mb-6`}>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Parimad skoorid formaadi järgi
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'classic', label: 'Classic', unit: 'p' },
                { key: 'short', label: 'Short', unit: 'p' },
                { key: 'long', label: 'Long', unit: 'p' },
                { key: 'back_and_forth', label: 'Back & Forth', unit: 'p' },
                { key: 'streak_challenge', label: 'Streak', unit: 'putti' },
                { key: 'random_distance', label: 'Random', unit: 'p' }
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
                <div className="text-xs font-semibold text-slate-600 mb-1">ATW</div>
                <div className="space-y-1">
                  {Object.entries(atwStatsByDifficulty).map(([difficulty, score]) => {
                    const labels = {
                      easy: 'Lihtne',
                      medium: 'Kesk',
                      hard: 'Raske',
                      ultra_hard: 'Ultra',
                      impossible: 'Võimatu'
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
                      0<span className="text-xs ml-1 text-slate-500">p</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

         {/* Putt Style Performance */}
         <div className={`${cardClass} mb-6`}>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Puti stiili statistika
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['regular', 'straddle', 'turbo', 'kneeling', 'marksman'].map((style) => {
                const stats = puttTypeStats[style];
                const accuracy = stats.total > 0 ? ((stats.made / stats.total) * 100).toFixed(1) : 0;
                const styleName = style === 'regular'
                  ? 'Tavaline'
                  : style === 'straddle'
                  ? 'Straddle'
                  : style === 'turbo'
                  ? 'Turbo'
                  : style === 'kneeling'
                  ? 'Põlvelt'
                  : 'Marksman';
                return (
                  <div key={style} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-sm font-semibold text-slate-700 mb-2">{styleName}</div>
                    <div className="text-2xl font-bold text-emerald-600 mb-1">{stats.score}</div>
                    <div className="text-xs text-slate-500 mb-2">Parim: {stats.count} mängu</div>
                    <div className="text-xs text-slate-600">
                      {stats.total > 0 ? `${accuracy}% (${stats.made}/${stats.total})` : 'Mänge pole'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        {/* Performance Analysis */}
        <div className={`${cardClass} mb-6`}>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Soorituse analüüs
          </h2>
          
          {comfortZone && (
            <div className="mb-4 p-4 bg-emerald-50 rounded-xl">
              <div className="text-sm text-emerald-700 font-semibold mb-1">Mugavus tsoon</div>
              <div className="text-2xl font-bold text-emerald-600">
                {comfortZone.distance}m • {comfortZone.accuracy}%
              </div>
              <div className="text-xs text-emerald-600">
                {comfortZone.attempts} katset • {comfortShare}% sinu katsetest
              </div>
            </div>
          )}

          {dropCause && (
            <div className="mb-4 p-4 bg-amber-50 rounded-xl">
              <div className="text-sm text-amber-700 font-semibold mb-1">Languse põhjus</div>
              <div className="text-2xl font-bold text-amber-600">
                {dropCause.distance}m • {dropCause.accuracy}%
              </div>
              <div className="text-xs text-amber-600">
                Mööda {dropCause.misses}/{dropCause.attempts}
              </div>
            </div>
          )}

          {/* Distance Breakdown */}
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Distantstulemused</div>
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
          <div className={`${cardClass} mb-6`}>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Grupimängude statistika
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Keskmine skoor</div>
                <div className="text-3xl font-bold text-slate-700">{avgGroupScore}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Parim skoor</div>
                <div className="text-3xl font-bold text-emerald-600">{bestScore}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tournament Results */}
        {isPuttingKingEnabled && tournamentPlayers.length > 0 && (
          <div className={`${cardClass} mb-6`}>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              Turniiri tulemused
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Turniir</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Võidud</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Kaotused</th>
                    <th className="text-right py-3 px-2 text-slate-600 font-semibold">Punktid</th>
                    <th className="text-right py-3 px-2 text-slate-600 font-semibold">Täpsus</th>
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
                          {tournament?.name || 'Teadmata'}
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
        <div className={`${cardClass}`}>
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-slate-800">Mängude ajalugu</h3>
             <div className="flex flex-wrap gap-2">
               {selectedGameIds.length > 0 && (
                 <Button
                   variant="outline"
                   className="border-rose-200 text-rose-600 hover:text-rose-700"
                   onClick={handleBulkDelete}
                   disabled={deleteGamesMutation.isPending}
                 >
                   Kustuta valitud ({selectedGameIds.length})
                 </Button>
               )}
               <Select value={filterFormat} onValueChange={() => { setFilterFormat(arguments[0]); setCurrentPage(1); }}>
                 <SelectTrigger className="w-32">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Kõik formaadid</SelectItem>
                   <SelectItem value="classic">Classic</SelectItem>
                   <SelectItem value="mini_league">Mini Liiga</SelectItem>
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
                   <SelectItem value="all">Kõik stiilid</SelectItem>
                   <SelectItem value="regular">Tavaline</SelectItem>
                   <SelectItem value="straddle">Straddle</SelectItem>
                   <SelectItem value="turbo">Turbo</SelectItem>
                   <SelectItem value="kneeling">Põlvelt</SelectItem>
                   <SelectItem value="marksman">Marksman</SelectItem>
                 </SelectContent>
               </Select>
               <Select value={sortBy} onValueChange={setSortBy}>
                 <SelectTrigger className="w-32">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="date">Kuupäev</SelectItem>
                   <SelectItem value="score">Skoor</SelectItem>
                   <SelectItem value="format">Formaat</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>

          {filteredGames.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Mänge ei leitud</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                     <tr className="border-b border-slate-200">
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">
                         <input
                           type="checkbox"
                           className="h-4 w-4 accent-emerald-500"
                           checked={allPageSelected}
                           onChange={toggleSelectAllPage}
                           disabled={selectablePageIds.length === 0}
                         />
                       </th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Mäng</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Kuupäev</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Formaat</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Stiil</th>
                       <th className="text-right py-3 px-2 text-slate-600 font-semibold">Skoor</th>
                       <th className="text-right py-3 px-2 text-slate-600 font-semibold">%</th>
                       <th className="text-center py-3 px-2 text-slate-600 font-semibold">Staatus</th>
                       <th className="text-center py-3 px-2 text-slate-600 font-semibold"></th>
                     </tr>
                   </thead>
                  <tbody>
                    {pageGames.map((game) => {
                      const putts = game.player_putts?.[myDisplayName] || game.player_putts?.[user?.full_name] || game.player_putts?.[user?.email] || [];
                      const made = putts.filter(p => p.result === 'made').length;
                      const percentage = putts.length > 0 ? ((made / putts.length) * 100).toFixed(0) : 0;
                      const score = game.total_points?.[myDisplayName] || game.total_points?.[user?.full_name] || game.total_points?.[user?.email] || 0;
                      const gameFormat = GAME_FORMATS[game.game_type || 'classic'];
                      const canDeleteThis = canDeleteGame(game);
                      const isSelected = selectedGameIds.includes(game.id);

                      return (
                        <tr key={game.id} className="border-b border-slate-100 hover:bg-slate-50">
                           <td className="py-3 px-2">
                             {canDeleteThis ? (
                               <input
                                 type="checkbox"
                                 className="h-4 w-4 accent-emerald-500"
                                 checked={isSelected}
                                 onChange={() => toggleGameSelection(game.id)}
                               />
                             ) : null}
                           </td>
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
                               {game.putt_type === 'regular'
                                 ? 'Tavaline'
                                 : game.putt_type === 'straddle'
                                 ? 'Straddle'
                                 : game.putt_type === 'turbo'
                                 ? 'Turbo'
                                 : game.putt_type === 'kneeling'
                                 ? 'Põlvelt'
                                 : game.putt_type === 'marksman'
                                 ? 'Marksman'
                                 : 'Tavaline'}
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
                               {game.status === 'active' ? 'Käimas' : 'Lõpetatud'}
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
                                to={`${createPageUrl('GameResult')}?id=${game.id}&from=profile`}
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
                  Kuvatakse {Math.min((currentPage - 1) * GAMES_PER_PAGE + 1, filteredGames.length)}–{Math.min(currentPage * GAMES_PER_PAGE, filteredGames.length)} / {filteredGames.length} mängu
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    Eelmine
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
                    Järgmine
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
              Saavutused ({unlockedAchievements.length}/{achievements.length})
            </h3>
          </div>
          <AchievementsList achievements={achievements} />
        </div>
      </div>
    </div>
  );
}
