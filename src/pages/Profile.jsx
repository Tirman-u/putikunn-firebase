import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Camera,
  Trophy,
  Target,
  TrendingUp,
  Edit2,
  Save,
  X,
  Award,
  ExternalLink,
  Trash2,
  Bell,
  ChevronDown,
  Sparkles,
  BookOpen,
  Gamepad2,
  LogOut,
  GraduationCap
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import { formatDuration } from '@/lib/time-format';
import AIInsights from '@/components/profile/AIInsights';
import AchievementsList, { getAchievements } from '@/components/profile/AchievementsList';
import LoadingState from '@/components/ui/loading-state';
import { deleteGameAndLeaderboardEntries } from '@/lib/leaderboard-utils';
import { isUserInDuelGame, sortDuelGamesByNewest } from '@/lib/duel-game-utils';
import { toast } from 'sonner';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import ThemeToggle from '@/components/ui/theme-toggle';
import LanguageToggle from '@/components/ui/language-toggle';
import VersionBadge from '@/components/VersionBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

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

  const { data: duelGames = [], isLoading: duelGamesLoading } = useQuery({
    queryKey: ['user-duel-games', user?.id, user?.email, user?.display_name, user?.full_name],
    queryFn: async () => {
      if (!user) return [];
      const normalizedEmail = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
      const requests = [
        base44.entities.DuelGame.filter({ mode: 'solo' }, '-created_at', 300)
      ];
      if (user?.id) {
        requests.push(
          base44.entities.DuelGame.filter({ participant_uids: { $arrayContains: user.id } }, '-created_at', 300)
        );
      }
      if (normalizedEmail) {
        requests.push(
          base44.entities.DuelGame.filter({ participant_emails: { $arrayContains: normalizedEmail } }, '-created_at', 300)
        );
      }

      const settled = await Promise.allSettled(requests);
      const merged = new Map();
      settled.forEach((entry) => {
        if (entry.status !== 'fulfilled' || !Array.isArray(entry.value)) return;
        entry.value.forEach((game) => {
          if (game?.id && !merged.has(game.id)) {
            merged.set(game.id, game);
          }
        });
      });

      return sortDuelGamesByNewest(Array.from(merged.values())).filter((game) => isUserInDuelGame(game, user));
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

  const deleteDuelGameMutation = useMutation({
    mutationFn: (duelId) => base44.entities.DuelGame.delete(duelId),
    onSuccess: () => {
      toast.success('Duell kustutatud');
      queryClient.invalidateQueries({ queryKey: ['user-duel-games'] });
      queryClient.invalidateQueries({ queryKey: ['my-duel-games'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Duelli kustutamine ebaõnnestus');
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

  if (userLoading || gamesLoading || duelGamesLoading || (isPuttingKingEnabled && (tournamentPlayersLoading || tournamentsLoading))) {
    return <LoadingState />;
  }
  if (!user) {
    return (
      <div className="min-h-screen bg-[#17191b] dark:bg-black flex items-center justify-center p-4">
        <div className="rounded-[24px] border border-[#d7e4e8] bg-white p-6 text-center shadow-fp-card dark:border-[#14363f] dark:bg-black">
          <p className="text-slate-700 mb-4">Kasutaja profiili ei õnnestu laadida.</p>
          <Button onClick={() => navigate(createPageUrl('Login'))}>Logi uuesti sisse</Button>
        </div>
      </div>
    );
  }

  const myDisplayName = user?.display_name || user?.full_name || user?.email || 'Mängija';
  const userRole = user?.app_role || 'user';
  const roleLabels = {
    super_admin: 'Superadmin',
    admin: 'Admin',
    trainer: 'Treener',
    user: 'Mängija'
  };
  const roleLabel = roleLabels[userRole] || roleLabels.user;
  const firstName = myDisplayName.split(' ')[0];
  const canManageGames = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const dashboardLinks = [
    { label: 'Dashboard', to: createPageUrl('Home'), icon: Sparkles },
    { label: 'Games', to: canManageGames ? createPageUrl('ManageGames') : `${createPageUrl('Home')}?mode=join`, icon: Gamepad2 },
    { label: 'Training', to: createPageUrl('JoinTraining'), icon: GraduationCap },
    { label: 'Records', to: createPageUrl('PuttingRecordsPage'), icon: Trophy },
    { label: 'Courses', to: canManageTraining ? createPageUrl('TrainerGroups') : createPageUrl('Profile'), icon: BookOpen },
    { label: 'Profile', to: createPageUrl('Profile'), icon: Award, active: true }
  ];
  const handleLogout = async () => {
    await base44.auth.logout(true);
  };
  const isAdmin = ['admin', 'super_admin'].includes(userRole);
  const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
  const normalizedDisplayName = normalize(myDisplayName);
  const normalizedFullName = normalize(user?.full_name);
  const normalizedEmail = normalize(user?.email);
  const dedupeKeys = (items) => Array.from(new Set((items || []).filter((item) => typeof item === 'string' && item.trim())));
  const pickNumericValue = (values, { lowerIsBetter = false } = {}) => {
    const numeric = (values || []).map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (numeric.length === 0) return 0;
    if (lowerIsBetter) {
      const positive = numeric.filter((value) => value > 0);
      return positive.length > 0 ? Math.min(...positive) : Math.min(...numeric);
    }
    return Math.max(...numeric);
  };

  const getPlayerKeysForGame = (game) => {
    if (!game) return [];
    const keys = [];

    const knownKeys = [myDisplayName, user?.full_name, user?.email];
    knownKeys.forEach((key) => {
      if (!key) return;
      if (
        game?.total_points?.[key] !== undefined ||
        game?.player_putts?.[key] ||
        game?.atw_state?.[key] ||
        game?.live_stats?.[key]
      ) {
        keys.push(key);
      }
    });

    const normalizedCandidates = new Set(
      [normalizedDisplayName, normalizedFullName, normalizedEmail].filter(Boolean)
    );

    (game.players || []).forEach((name) => {
      if (!name) return;
      if (normalizedCandidates.has(normalize(name))) {
        keys.push(name);
      }
    });

    Object.keys(game.total_points || {}).forEach((name) => {
      if (!name) return;
      if (normalizedCandidates.has(normalize(name))) {
        keys.push(name);
      }
    });

    Object.entries(game.player_emails || {}).forEach(([name, email]) => {
      if (normalizedEmail && normalize(email) === normalizedEmail) {
        keys.push(name);
      }
    });

    Object.entries(game.player_uids || {}).forEach(([name, uid]) => {
      if (user?.id && uid === user.id) {
        keys.push(name);
      }
    });

    return dedupeKeys(keys);
  };

  const getPlayerScoreForGame = (game) => {
    const keys = getPlayerKeysForGame(game);
    const values = [];
    keys.forEach((key) => {
      values.push(game?.total_points?.[key]);
      values.push(game?.live_stats?.[key]?.total_points);
      if (game?.game_type === 'around_the_world') {
        values.push(game?.atw_state?.[key]?.best_score);
      }
    });
    return pickNumericValue(values, { lowerIsBetter: game?.game_type === 'time_ladder' });
  };

  const getPlayerPuttsForGame = (game) => {
    const keys = getPlayerKeysForGame(game);
    let best = [];
    keys.forEach((key) => {
      const putts = Array.isArray(game?.player_putts?.[key]) ? game.player_putts[key] : [];
      if (putts.length > best.length) {
        best = putts;
      }
    });
    return best;
  };

  const getPlayerATWStateForGame = (game) => {
    const keys = getPlayerKeysForGame(game);
    let bestState = null;
    keys.forEach((key) => {
      const state = game?.atw_state?.[key];
      if (!state) return;
      if (!bestState) {
        bestState = state;
        return;
      }
      const stateScore = Number(state?.best_score || 0);
      const bestScore = Number(bestState?.best_score || 0);
      if (stateScore > bestScore) {
        bestState = state;
      }
    });
    return bestState;
  };

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

    const scoreKeys = Object.keys(game.total_points || {}).map(normalize);
    if (
      (normalizedDisplayName && scoreKeys.includes(normalizedDisplayName)) ||
      (normalizedFullName && scoreKeys.includes(normalizedFullName)) ||
      (normalizedEmail && scoreKeys.includes(normalizedEmail))
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
  const duelHistoryRows = duelGames.map((game) => {
    const players = Object.values(game?.state?.players || {});
    const ownPlayer = players.find((player) => {
      const playerName = normalize(player?.name);
      const playerEmail = normalize(player?.email);
      return (
        (user?.id && player?.id === user.id) ||
        (normalizedEmail && playerEmail === normalizedEmail) ||
        (normalizedDisplayName && playerName === normalizedDisplayName) ||
        (normalizedFullName && playerName === normalizedFullName)
      );
    });
    const opponents = players.filter((player) => player?.id !== ownPlayer?.id);
    const fallbackWinner = [...players].sort((a, b) => {
      if ((b?.points || 0) !== (a?.points || 0)) return (b?.points || 0) - (a?.points || 0);
      if ((b?.wins || 0) !== (a?.wins || 0)) return (b?.wins || 0) - (a?.wins || 0);
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    })[0];
    const winnerId = game?.winner_id || fallbackWinner?.id || null;
    const status = game?.status || 'lobby';
    const isFinished = status === 'finished';
    const ownPlayerId = ownPlayer?.id || null;
    let resultLabel = 'Käimas';
    let resultClass = 'bg-amber-100 text-amber-700';
    if (isFinished) {
      if (winnerId && ownPlayerId && winnerId === ownPlayerId) {
        resultLabel = 'Võit';
        resultClass = 'bg-emerald-100 text-emerald-700';
      } else if (winnerId && ownPlayerId && winnerId !== ownPlayerId) {
        resultLabel = 'Kaotus';
        resultClass = 'bg-rose-100 text-rose-700';
      } else {
        resultLabel = 'Lõpetatud';
        resultClass = 'bg-slate-100 text-slate-700';
      }
    }

    return {
      id: game.id,
      pin: game.pin || '',
      name: game.name || 'Sõbraduell',
      status,
      date: game.ended_at || game.created_at || game.date || null,
      dateLabel: (() => {
        const dateValue = game.ended_at || game.created_at || game.date || null;
        if (!dateValue) return '-';
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) return '-';
        return format(parsed, 'MMM d, yyyy');
      })(),
      resultLabel,
      resultClass,
      ownPoints: ownPlayer?.points ?? 0,
      ownWins: ownPlayer?.wins ?? 0,
      ownLosses: ownPlayer?.losses ?? 0,
      opponentNames: opponents.map((player) => player?.name || 'Vastane').filter(Boolean).join(', ') || 'Vastane'
    };
  });
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
    const playerState = getPlayerATWStateForGame(game);
    if (playerState) {
      const difficulty = game.atw_config?.difficulty || 'medium';
      const score = getPlayerScoreForGame(game);
      atwStatsByDifficulty[difficulty] = Math.max(atwStatsByDifficulty[difficulty], score);
    }
  });

  const atwStats = atwGames.reduce((acc, game) => {
    const playerState = getPlayerATWStateForGame(game);
    if (playerState) {
      acc.totalLaps += playerState.laps_completed || 0;
      acc.totalTurns += playerState.turns_played || 0;
      const score = getPlayerScoreForGame(game);
      acc.bestScore = Math.max(acc.bestScore, score);
    }
    return acc;
  }, { totalLaps: 0, totalTurns: 0, bestScore: 0 });

  // Calculate statistics
  const totalGames = myGames.length;
  const allPutts = myGames.flatMap((game) => getPlayerPuttsForGame(game));
  const totalPutts = allPutts.length;
  const madePutts = allPutts.filter(p => p.result === 'made').length;
  const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;

  let totalPoints = 0;
  let bestScore = 0;
  myGames.forEach(game => {
    const points = getPlayerScoreForGame(game);
    totalPoints += points;
    if (game.game_type !== 'time_ladder' && points > bestScore) bestScore = points;
  });
  const avgScore = myGames.length > 0 ? Math.round(totalPoints / myGames.length) : 0;

  const trendGames = myGames
    .map((game) => {
      const putts = getPlayerPuttsForGame(game);
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
    .filter((game) => isPlayerInGame(game))
    .map((game) => getPlayerScoreForGame(game));
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
    const putts = getPlayerPuttsForGame(game);
    const made = putts.filter(p => p.result === 'made').length;
    const score = getPlayerScoreForGame(game);
    
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
    const score = getPlayerScoreForGame(game);
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
      const scoreA = getPlayerScoreForGame(a);
      const scoreB = getPlayerScoreForGame(b);
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

  const cardClass = 'rounded-[24px] border border-[#d7e4e8] bg-white p-5 shadow-fp-card dark:border-[#14363f] dark:bg-black';

  return (
    <div className="min-h-screen bg-[#17191b] px-2 py-3 sm:px-4 sm:py-7 dark:bg-black">
      <div className="mx-auto w-full max-w-[1220px] overflow-hidden rounded-[18px] border border-[#d9dee2] bg-[#f3f4f5] shadow-[0_30px_80px_rgba(0,0,0,0.35)] dark:border-[#14363f] dark:bg-black dark:text-slate-100">
        <header className="border-b border-[#e5e9ec] bg-white px-4 py-3 sm:px-6 dark:border-[#14363f] dark:bg-black">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                to={createPageUrl('Home')}
                className="inline-flex items-center gap-3 rounded-xl px-1 py-0.5 transition hover:bg-[#edf2f4] dark:hover:bg-[#07161b]"
                aria-label="Ava avaleht"
              >
                <img src="/wisedisc-mark.svg" alt="Wisedisc logo" className="h-10 w-10 shrink-0" />
                <div className="text-[30px] font-semibold leading-none text-[#1b2639] dark:text-slate-100">Wisedisc</div>
              </Link>
              <nav className="ml-4 hidden items-center gap-1 lg:flex">
                {dashboardLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        item.active
                          ? 'bg-[#d8f3ef] text-[#1f9c8d]'
                          : 'text-slate-600 hover:bg-[#edf2f4] hover:text-slate-800 dark:text-slate-300 dark:hover:bg-[#07161b] dark:hover:text-slate-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e8eb] text-slate-500 transition hover:bg-[#eef4f5] hover:text-slate-700 dark:border-[#14363f] dark:text-slate-300 dark:hover:bg-[#07161b] dark:hover:text-slate-100"
              >
                <Bell className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#e3e8eb] bg-white px-2.5 py-1.5 text-left transition hover:bg-[#f6f9fa] dark:border-[#14363f] dark:bg-black dark:hover:bg-[#07161b]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[#28b39a] to-[#1f9c8d] text-xs font-semibold text-white">
                      {firstName?.slice(0, 2)?.toUpperCase()}
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-xs font-semibold leading-4 text-slate-800 dark:text-slate-100">{myDisplayName}</div>
                      <div className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{roleLabel}</div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[250px] p-1.5">
                  <DropdownMenuLabel className="normal-case">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{myDisplayName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{roleLabel}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate(createPageUrl('Home'))}>
                    <Sparkles className="h-4 w-4 text-slate-500" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate(createPageUrl('PuttingRecordsPage'))}>
                    <Trophy className="h-4 w-4 text-slate-500" />
                    <span>Rekordid</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between px-2 py-2">
                    <LanguageToggle />
                    <ThemeToggle />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} className="text-red-600 dark:text-red-400">
                    <LogOut className="h-4 w-4" />
                    <span>Logi välja</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1 overflow-auto pb-1 lg:hidden">
            {dashboardLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium ${
                    item.active
                      ? 'bg-[#d8f3ef] text-[#1f9c8d]'
                      : 'text-slate-600 hover:bg-[#edf2f4] dark:text-slate-300 dark:hover:bg-[#07161b]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="px-4 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
          <section className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-[#1b2639] sm:text-[50px] sm:leading-[56px] dark:text-slate-100">
              Profile overview, {firstName}!
            </h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-xl dark:text-slate-300">
              Kõik sinu tulemused, areng ja mängude ajalugu ühes vaates.
            </p>
          </section>

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
               <Select value={filterFormat} onValueChange={(value) => { setFilterFormat(value); setCurrentPage(1); }}>
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
               <Select value={filterPuttType} onValueChange={(value) => { setFilterPuttType(value); setCurrentPage(1); }}>
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
                      const putts = getPlayerPuttsForGame(game);
                      const made = putts.filter(p => p.result === 'made').length;
                      const percentage = putts.length > 0 ? ((made / putts.length) * 100).toFixed(0) : 0;
                      const score = getPlayerScoreForGame(game);
                      const isTimeLadder = game.game_type === 'time_ladder';
                      const scoreLabel = isTimeLadder ? formatDuration(score) : score;
                      const percentageLabel = isTimeLadder ? '—' : `${percentage}%`;
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
                             {scoreLabel}
                           </td>
                           <td className="py-3 px-2 text-right text-slate-700">
                             {percentageLabel}
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

        {/* Solo Duel History */}
        {duelHistoryRows.length > 0 && (
          <div className={`${cardClass} mt-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">SOLO sõbraduellid</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {duelHistoryRows.length}
              </span>
            </div>
            <div className="space-y-2">
              {duelHistoryRows.map((duel) => (
                <div
                  key={duel.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{duel.name}</div>
                      <div className="text-xs text-slate-500">
                        vs {duel.opponentNames}
                        {duel.pin ? ` • PIN ${duel.pin}` : ''}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${duel.resultClass}`}>
                      {duel.resultLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      P {duel.ownPoints} • V {duel.ownWins} • K {duel.ownLosses}
                    </span>
                    <div className="flex items-center gap-3">
                      <span>{duel.dateLabel}</span>
                      <Link
                        to={`${createPageUrl('DuelReport')}?id=${duel.id}`}
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm('Kustuta see SOLO duell?')) return;
                          deleteDuelGameMutation.mutate(duel.id);
                        }}
                        className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-700"
                        disabled={deleteDuelGameMutation.isPending}
                        aria-label="Kustuta duell"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        <div className={`${cardClass} mt-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Saavutused ({unlockedAchievements.length}/{achievements.length})
            </h3>
          </div>
          <AchievementsList achievements={achievements} />
        </div>

        <div className="mt-5 flex justify-end">
          <VersionBadge inline />
        </div>
      </main>
    </div>
   </div>
  );
}
