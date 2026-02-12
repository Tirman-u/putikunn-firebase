import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Target, Award, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import {
  getLeaderboardEmail,
  getLeaderboardStats,
  normalizeLeaderboardGender,
  resolveLeaderboardPlayer
} from '@/lib/leaderboard-utils';
import { formatDuration } from '@/lib/time-format';

export default function PuttingRecords() {
  const TIME_REPAIR_STORAGE_KEY = 'putikunn:time-records-repair:v1';
  const [selectedView, setSelectedView] = useState('general_classic');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [dgMode, setDgMode] = useState('classic');
  const [page, setPage] = useState(1);
  const [hasAutoRepairedTimeRecords, setHasAutoRepairedTimeRecords] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(TIME_REPAIR_STORAGE_KEY) === 'done';
  });
  const queryClient = useQueryClient();
  const PAGE_SIZE = 20;
  const MAX_FETCH = 2000;
  const FETCH_BATCH_SIZE = 200;

  const viewTypes = [
    { id: 'general_classic', label: 'Classic', leaderboardType: 'general', gameType: 'classic' },
    { id: 'general_mini_league', label: 'Mini Liiga', leaderboardType: 'general', gameType: 'mini_league' },
    { id: 'general_back_and_forth', label: 'Back & Forth', leaderboardType: 'general', gameType: 'back_and_forth' },
    { id: 'general_short', label: 'Short', leaderboardType: 'general', gameType: 'short' },
    { id: 'general_streak_challenge', label: 'Streak', leaderboardType: 'general', gameType: 'streak_challenge' },
    { id: 'general_random_distance', label: 'Random', leaderboardType: 'general', gameType: 'random_distance' },
    { id: 'general_time_ladder', label: 'Aja väljakutse', leaderboardType: 'general', gameType: 'time_ladder' },
    { id: 'general_around_the_world', label: 'Around the World', leaderboardType: 'general', gameType: 'around_the_world' },
    { id: 'discgolf_ee', label: 'DG.ee', leaderboardType: 'general', gameType: 'classic', hostedOnly: true }
  ];

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const currentView = viewTypes.find(v => v.id === selectedView);
  const effectiveView = useMemo(() => {
    if (!currentView) return null;
    if (currentView.id === 'discgolf_ee') {
      return { ...currentView, gameType: dgMode };
    }
    return currentView;
  }, [currentView, dgMode]);

  useEffect(() => {
    setPage(1);
  }, [selectedView, selectedGender, selectedMonth, dgMode]);

  useEffect(() => {
    if (selectedView === 'discgolf_ee') {
      setDgMode('classic');
    }
  }, [selectedView]);

  const fetchLeaderboardRows = async (filter, sortOrder) => {
    const rows = [];
    let skip = 0;

    while (rows.length < MAX_FETCH) {
      const limit = Math.min(FETCH_BATCH_SIZE, MAX_FETCH - rows.length);
      const chunk = await base44.entities.LeaderboardEntry.filter(filter, sortOrder, limit, skip);
      if (!chunk?.length) break;

      rows.push(...chunk);
      skip += chunk.length;

      if (chunk.length < limit) break;
    }

    return rows;
  };

  const fetchGameRows = async (filter, sortOrder) => {
    const rows = [];
    let skip = 0;

    while (rows.length < MAX_FETCH) {
      const limit = Math.min(FETCH_BATCH_SIZE, MAX_FETCH - rows.length);
      const chunk = await base44.entities.Game.filter(filter, sortOrder, limit, skip);
      if (!chunk?.length) break;

      rows.push(...chunk);
      skip += chunk.length;

      if (chunk.length < limit) break;
    }

    return rows;
  };

  const { data: leaderboardEntries = [] } = useQuery({
    queryKey: ['leaderboard-entries', selectedView, dgMode],
    queryFn: async () => {
      if (!effectiveView) return [];
      const filter = {
        leaderboard_type: effectiveView.leaderboardType,
        game_type: effectiveView.gameType
      };
      const sortOrder = effectiveView.gameType === 'time_ladder' ? 'score' : '-score';
      return fetchLeaderboardRows(filter, sortOrder);
    },
    staleTime: 120000,
    refetchInterval: 120000
  });

  const isATWView = effectiveView?.gameType === 'around_the_world';
  const isTimeView = effectiveView?.gameType === 'time_ladder';
  const needsGameData = Boolean(effectiveView?.hostedOnly || isATWView || isTimeView);

  const leaderboardGameIds = useMemo(() => {
    if (!needsGameData) return [];
    return Array.from(new Set(leaderboardEntries.map(entry => entry.game_id).filter(Boolean)));
  }, [leaderboardEntries, needsGameData]);

  const { data: gamesById = {}, isLoading: isGamesLoading } = useQuery({
    queryKey: ['leaderboard-games', leaderboardGameIds.join('|')],
    queryFn: async () => {
      if (leaderboardGameIds.length === 0) return {};
      const map = {};
      const chunkSize = 50;
      for (let i = 0; i < leaderboardGameIds.length; i += chunkSize) {
        const chunk = leaderboardGameIds.slice(i, i + chunkSize);
        try {
          const games = await base44.entities.Game.filter({ id: { $in: chunk } });
          (games || []).forEach((game) => {
            if (game?.id) map[game.id] = game;
          });
        } catch {
          // ignore chunk failures; missing games will be filtered out
        }
      }
      return map;
    },
    enabled: leaderboardGameIds.length > 0 && needsGameData,
    staleTime: 300000
  });

  const userRole = user?.app_role || 'user';
  const canDelete = ['admin', 'super_admin'].includes(userRole);
  const canRepairTimeRecords = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const deleteRecordMutation = useMutation({
    mutationFn: async (entry) => {
      if (!entry?.id) return 0;
      await base44.entities.LeaderboardEntry.delete(entry.id);
      return 1;
    },
    onSuccess: (deletedCount) => {
      toast.success(`Kustutatud (${deletedCount})`);
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard-games'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Kustutamine ebaonnestus');
    }
  });

  const resolveGamePlayers = React.useCallback((game) => {
    const players = new Set();
    (game?.players || []).forEach((name) => players.add(name));
    Object.keys(game?.total_points || {}).forEach((name) => players.add(name));
    Object.keys(game?.player_uids || {}).forEach((name) => players.add(name));
    Object.keys(game?.player_emails || {}).forEach((name) => players.add(name));
    Object.keys(game?.live_stats || {}).forEach((name) => players.add(name));
    return Array.from(players).filter(Boolean);
  }, []);

  const repairTimeLadderMutation = useMutation({
    mutationFn: async () => {
      const timeGames = await fetchGameRows({ game_type: 'time_ladder' }, '-date');
      const existingEntries = await fetchLeaderboardRows(
        { leaderboard_type: 'general', game_type: 'time_ladder' },
        'score'
      );

      const timeGamesById = {};
      timeGames.forEach((game) => {
        if (game?.id) {
          timeGamesById[game.id] = game;
        }
      });

      let fixedDiscs = 0;
      for (const entry of existingEntries) {
        const directDiscs = Number(entry?.time_ladder_discs_per_turn);
        if (Number.isFinite(directDiscs) && directDiscs > 0) continue;
        const game = timeGamesById[entry?.game_id];
        const gameDiscs = Number(game?.time_ladder_config?.discs_per_turn);
        if (!Number.isFinite(gameDiscs) || gameDiscs <= 0) continue;
        await base44.entities.LeaderboardEntry.update(entry.id, {
          time_ladder_discs_per_turn: gameDiscs
        });
        entry.time_ladder_discs_per_turn = gameDiscs;
        fixedDiscs += 1;
      }

      const getEntryDiscs = (entry) => {
        const directDiscs = Number(entry?.time_ladder_discs_per_turn);
        if (Number.isFinite(directDiscs) && directDiscs > 0) return directDiscs;
        const gameDiscs = Number(timeGamesById[entry?.game_id]?.time_ladder_config?.discs_per_turn);
        if (Number.isFinite(gameDiscs) && gameDiscs > 0) return gameDiscs;
        return null;
      };

      const bestExistingByKey = new Map();
      existingEntries.forEach((entry) => {
        const entryKey = `${getPlayerKey(entry)}|discs:${getEntryDiscs(entry) || 'unknown'}`;
        const existing = bestExistingByKey.get(entryKey);
        const entryScore = Number(entry?.score || 0);
        const existingScore = Number(existing?.score || 0);
        const entryDate = new Date(entry?.date || 0).getTime();
        const existingDate = new Date(existing?.date || 0).getTime();
        const isBetter = !existing || entryScore < existingScore || (entryScore === existingScore && entryDate > existingDate);
        if (isBetter) {
          bestExistingByKey.set(entryKey, entry);
        }
      });

      const profileCache = {};
      let created = 0;
      let updated = 0;
      for (const game of timeGames) {
        const discs = Number(game?.time_ladder_config?.discs_per_turn);
        if (!Number.isFinite(discs) || discs <= 0) continue;
        const gamePlayers = resolveGamePlayers(game);

        for (const rawPlayerName of gamePlayers) {
          const stats = getLeaderboardStats(game, rawPlayerName);
          const score = Number(stats?.score || 0);
          if (!Number.isFinite(score) || score <= 0) continue;

          const resolvedPlayer = await resolveLeaderboardPlayer({
            game,
            playerName: rawPlayerName,
            cache: profileCache
          });
          const identityKey = getResolvedPlayerKey(resolvedPlayer);
          if (!identityKey) continue;

          const payload = {
            game_id: game.id,
            player_name: resolvedPlayer.playerName,
            ...(resolvedPlayer.playerUid ? { player_uid: resolvedPlayer.playerUid } : {}),
            player_email: getLeaderboardEmail(resolvedPlayer),
            ...(resolvedPlayer.playerGender ? { player_gender: resolvedPlayer.playerGender } : {}),
            game_type: 'time_ladder',
            score,
            accuracy: Math.round((Number(stats?.accuracy || 0)) * 10) / 10,
            made_putts: Number(stats?.madePutts || 0),
            total_putts: Number(stats?.totalPutts || 0),
            time_ladder_discs_per_turn: discs,
            leaderboard_type: 'general',
            date: new Date(game.date || new Date().toISOString()).toISOString()
          };

          const key = `${identityKey}|discs:${discs}`;
          const existing = bestExistingByKey.get(key);
          if (!existing?.id) {
            const createdEntry = await base44.entities.LeaderboardEntry.create(payload);
            bestExistingByKey.set(key, createdEntry || payload);
            created += 1;
            continue;
          }

          const existingScore = Number(existing.score || 0);
          const existingDate = new Date(existing.date || 0).getTime();
          const payloadDate = new Date(payload.date || 0).getTime();
          const isBetter = score < existingScore || (score === existingScore && payloadDate > existingDate);
          if (isBetter) {
            await base44.entities.LeaderboardEntry.update(existing.id, payload);
            bestExistingByKey.set(key, { ...existing, ...payload });
            updated += 1;
          }
        }
      }

      return {
        scannedGames: timeGames.length,
        fixedDiscs,
        created,
        updated
      };
    },
    onSuccess: (result) => {
      toast.success(
        `Aja väljakutse parandatud (${result.scannedGames} mängu, +${result.created} uut, ${result.updated} uuendatud, ${result.fixedDiscs} ketaste fix)`
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TIME_REPAIR_STORAGE_KEY, 'done');
      }
      setHasAutoRepairedTimeRecords(true);
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard-games'] });
    },
    onError: (error) => {
      setHasAutoRepairedTimeRecords(false);
      toast.error(error?.message || 'Aja väljakutse parandamine ebaõnnestus');
    }
  });

  useEffect(() => {
    if (!isTimeView || !canRepairTimeRecords) return;
    if (repairTimeLadderMutation.isPending || hasAutoRepairedTimeRecords) return;
    setHasAutoRepairedTimeRecords(true);
    repairTimeLadderMutation.mutate();
  }, [
    isTimeView,
    canRepairTimeRecords,
    repairTimeLadderMutation,
    hasAutoRepairedTimeRecords
  ]);

  const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
  const currentUserEmail = normalizeText(user?.email);
  const currentUserName = normalizeText(user?.full_name || user?.display_name);
  const currentUserId = user?.id;

  const monthOptions = useMemo(() => {
    const monthSet = new Set();
    leaderboardEntries.forEach((entry) => {
      if (!entry?.date) return;
      monthSet.add(format(new Date(entry.date), 'yyyy-MM'));
    });

    return Array.from(monthSet)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => {
        const [year, month] = value.split('-');
        return {
          value,
          label: format(new Date(Number(year), Number(month) - 1, 1), 'MMMM yyyy')
        };
      });
  }, [leaderboardEntries]);

  const getResolvedGender = (entry) => {
    return normalizeLeaderboardGender(entry?.player_gender) || null;
  };

  const getResolvedPlayerName = (entry) => {
    if (entry?.player_name) return entry.player_name;
    if (entry?.player_email && entry.player_email !== 'unknown') return entry.player_email;
    return 'Mängija';
  };

  const isCurrentUserEntry = (entry) => {
    if (!user) return false;
    if (currentUserId && entry?.player_uid && entry.player_uid === currentUserId) return true;
    const entryEmail = normalizeText(entry?.player_email);
    if (currentUserEmail && entryEmail && currentUserEmail === entryEmail) return true;
    const entryName = normalizeText(entry?.player_name);
    if (currentUserName && entryName && currentUserName === entryName) return true;
    return false;
  };

  const isHostedEntry = (entry) => {
    if (entry?.is_hosted !== undefined) return Boolean(entry.is_hosted);
    const game = entry?.game_id ? gamesById?.[entry.game_id] : null;
    return Boolean(game?.pin && game.pin !== '0000');
  };

  const filteredEntries = leaderboardEntries.filter(entry => {
    if (!effectiveView) return false;
    if (entry.leaderboard_type !== effectiveView.leaderboardType) return false;
    
    if (entry.game_type !== effectiveView.gameType) return false;
    if (effectiveView.hostedOnly && !isHostedEntry(entry)) return false;
    
    const resolvedGender = getResolvedGender(entry);
    if (selectedGender !== 'all') {
      if (selectedGender === 'N' && resolvedGender !== 'N') return false;
      if (selectedGender === 'M' && resolvedGender !== 'M') return false;
    }
    
    if (selectedMonth !== 'all' && entry.date) {
      const entryDate = new Date(entry.date);
      const [year, month] = selectedMonth.split('-');
      const monthStart = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const monthEnd = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      if (entryDate < monthStart || entryDate > monthEnd) return false;
    }
    
    return true;
  });

  const getAtwDiscsLabel = (entry) => {
    if (!isATWView) return null;
    const game = entry?.game_id ? gamesById?.[entry.game_id] : null;
    const discs = game?.atw_config?.discs_per_turn;
    if (!discs) return null;
    return discs === 1 ? '1 ketas' : `${discs} ketast`;
  };

  const getTimeDiscsCount = (entry) => {
    if (!isTimeView) return null;
    const directValue = Number(entry?.time_ladder_discs_per_turn);
    if (Number.isFinite(directValue) && directValue > 0) return directValue;
    const game = entry?.game_id ? gamesById?.[entry.game_id] : null;
    const gameValue = Number(game?.time_ladder_config?.discs_per_turn);
    if (Number.isFinite(gameValue) && gameValue > 0) return gameValue;
    return null;
  };

  const getTimeDiscsLabel = (entry) => {
    const discs = getTimeDiscsCount(entry);
    if (!discs) return '-';
    return discs === 1 ? '1 ketas' : `${discs} ketast`;
  };

  const getPlayerKey = (entry) => {
    if (entry?.player_uid) return `uid:${entry.player_uid}`;

    const email = normalizeText(entry?.player_email);
    if (email && email !== 'unknown') {
      return `email:${email}`;
    }

    const resolvedName = normalizeText(entry?.player_name);
    if (resolvedName) return `name:${resolvedName}`;

    return `id:${entry.id}`;
  };

  const getResolvedPlayerKey = (resolvedPlayer) => {
    if (resolvedPlayer?.playerUid) return `uid:${resolvedPlayer.playerUid}`;
    const email = normalizeText(resolvedPlayer?.playerEmail);
    if (email && email !== 'unknown') return `email:${email}`;
    const name = normalizeText(resolvedPlayer?.playerName);
    if (name) return `name:${name}`;
    return '';
  };

  const getRecordKey = (entry) => {
    const playerKey = getPlayerKey(entry);
    if (!isTimeView) return playerKey;
    return `${playerKey}|discs:${getTimeDiscsCount(entry) || 'unknown'}`;
  };

  // Group by player (and for time challenge also by discs config) and keep the best score for each group
  const bestScoresByPlayer = {};
  filteredEntries.forEach(entry => {
    const key = getRecordKey(entry);
    const existing = bestScoresByPlayer[key];
    const entryScore = Number(entry.score || 0);
    const existingScore = Number(existing?.score || 0);
    const isBetter = isTimeView
      ? (!existing || entryScore < existingScore || (entryScore === existingScore && entry.date > existing.date))
      : (!existing || entryScore > existingScore || (entryScore === existingScore && entry.date > existing.date));
    if (isBetter) {
      bestScoresByPlayer[key] = entry;
    }
  });

  const uniqueEntries = Object.values(bestScoresByPlayer).sort((a, b) => {
    const aScore = Number(a.score || 0);
    const bScore = Number(b.score || 0);
    if (isTimeView) {
      if (aScore !== bScore) return aScore - bScore;
      return (getTimeDiscsCount(a) || Number.MAX_SAFE_INTEGER) - (getTimeDiscsCount(b) || Number.MAX_SAFE_INTEGER);
    }
    return bScore - aScore;
  });
  const totalPages = Math.max(1, Math.ceil(uniqueEntries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const sortedEntries = uniqueEntries.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h2 className="text-2xl font-bold text-slate-800">Puttingu rekordid</h2>
      </div>

      <Tabs value={selectedView} onValueChange={setSelectedView}>
        <TabsList className="grid grid-cols-3 md:grid-cols-4 w-full mb-6 h-auto gap-1">
          {viewTypes.map(type => (
            <TabsTrigger key={type.id} value={type.id}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {viewTypes.map(type => (
          <TabsContent key={type.id} value={type.id}>
            <div className="space-y-4">
              {type.id === 'discgolf_ee' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-sm">
                    {[
                      { id: 'classic', label: 'Classic' },
                      { id: 'short', label: 'Short' }
                    ].map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDgMode(option.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                          dgMode === option.id
                            ? 'bg-white text-slate-800 shadow'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 flex-wrap">
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Sugu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Kõik</SelectItem>
                    <SelectItem value="M">Mehed</SelectItem>
                    <SelectItem value="N">Naised</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Kuu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Kogu aeg</SelectItem>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTimeView && canRepairTimeRecords && (
                  <button
                    type="button"
                    onClick={() => repairTimeLadderMutation.mutate()}
                    disabled={repairTimeLadderMutation.isPending}
                    className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {repairTimeLadderMutation.isPending ? 'Parandan...' : 'Paranda vanad time kirjed'}
                  </button>
                )}
              </div>

              {sortedEntries.length === 0 ? (
                isGamesLoading && leaderboardEntries.length > 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                    <p>Laen mänge...</p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Rekordeid veel pole. Ole esimene!</p>
                  </div>
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">#</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">Mängija</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">Tulemus</th>
                        {isTimeView && (
                          <th className="text-center py-3 px-2 text-slate-600 font-semibold">Kettad</th>
                        )}
                        {!isATWView && !isTimeView && (
                          <th className="text-center py-3 px-2 text-slate-600 font-semibold">
                            {effectiveView?.gameType === 'streak_challenge' ? 'Distants' : 'Täpsus'}
                          </th>
                        )}
                        {!isATWView && !isTimeView && (
                          <th className="text-center py-3 px-2 text-slate-600 font-semibold">Putid</th>
                        )}
                        <th className="text-right py-3 px-2 text-slate-600 font-semibold">Kuupäev</th>
                        {canDelete && (
                          <th className="text-right py-3 px-2 text-slate-600 font-semibold">Kustuta</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map((entry, idx) => {
                        const absoluteRank = pageStart + idx + 1;
                        const isCurrentUser = isCurrentUserEntry(entry);
                        const isTopRank = absoluteRank <= 3;
                        const rowBase = isTopRank ? 'bg-amber-50' : (isCurrentUser ? 'bg-emerald-50/70' : '');
                        const rowHover = isCurrentUser ? 'hover:bg-emerald-100/70' : 'hover:bg-slate-50';
                        const rowHighlight = isCurrentUser ? 'ring-1 ring-emerald-200/70' : '';
                        return (
                        <tr
                          key={entry.id}
                          className={`border-b border-slate-100 ${rowBase} ${rowHover} ${rowHighlight} cursor-pointer transition-colors`}
                        >
                          <td className="py-3 px-2">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}&from=leaderboard`} className="block">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                absoluteRank === 1 ? 'bg-yellow-400 text-yellow-900' :
                                absoluteRank === 2 ? 'bg-slate-300 text-slate-700' :
                                absoluteRank === 3 ? 'bg-orange-300 text-orange-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {absoluteRank}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-2 font-medium text-slate-700">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}&from=leaderboard`} className="block">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{getResolvedPlayerName(entry)}</span>
                                {isHostedEntry(entry) && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                                    <Award className="w-3 h-3" />
                                    DG.ee
                                  </span>
                                )}
                                {getAtwDiscsLabel(entry) && (
                                  <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                                    {getAtwDiscsLabel(entry)}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}&from=leaderboard`} className="block">
                              <span className="text-lg font-bold text-emerald-600">
                                {isTimeView ? formatDuration(entry.score) : entry.score}
                              </span>
                            </Link>
                          </td>
                          {isTimeView && (
                            <td className="py-3 px-2 text-center text-slate-700">
                              <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}&from=leaderboard`} className="block">
                                {getTimeDiscsLabel(entry)}
                              </Link>
                            </td>
                          )}
                          {!isATWView && !isTimeView && (
                            <td className="py-3 px-2 text-center text-slate-700">
                              <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}&from=leaderboard`} className="block">
                                {effectiveView?.gameType === 'streak_challenge' 
                                  ? `${entry.streak_distance || 0}m` 
                                  : (entry.accuracy ? `${entry.accuracy.toFixed(1)}%` : '-')
                                }
                              </Link>
                            </td>
                          )}
                          {!isATWView && !isTimeView && (
                            <td className="py-3 px-2 text-center text-slate-600">
                              <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}&from=leaderboard`} className="block">
                                {entry.made_putts}/{entry.total_putts}
                              </Link>
                            </td>
                          )}
                          <td className="py-3 px-2 text-right text-slate-500 text-xs">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}&from=leaderboard`} className="block">
                              {entry.date ? format(new Date(entry.date), 'MMM d, yyyy') : '-'}
                            </Link>
                          </td>
                          {canDelete && (
                            <td className="py-3 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const player = getResolvedPlayerName(entry) || 'tundmatu';
                                  if (!confirm(`Kustuta "${player}" sellest tabelist?`)) {
                                    return;
                                  }
                                  deleteRecordMutation.mutate(entry);
                                }}
                                disabled={deleteRecordMutation.isPending}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                                title="Kustuta kirje"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={safePage === 1}
                    className="px-3 py-2 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Eelmine
                  </button>
                  <span className="text-sm text-slate-600 min-w-[90px] text-center">
                    Leht {safePage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={safePage === totalPages}
                    className="px-3 py-2 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Järgmine
                  </button>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
