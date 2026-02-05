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

export default function PuttingRecords() {
  const [selectedView, setSelectedView] = useState('general_classic');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [page, setPage] = useState(1);
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
    { id: 'general_around_the_world', label: 'Around the World', leaderboardType: 'general', gameType: 'around_the_world' },
    { id: 'discgolf_ee', label: 'DG.ee', leaderboardType: 'discgolf_ee', gameType: 'all' }
  ];

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['leaderboard-users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 120000
  });

  const currentView = viewTypes.find(v => v.id === selectedView);

  useEffect(() => {
    setPage(1);
  }, [selectedView, selectedGender, selectedMonth]);

  const fetchLeaderboardRows = async (filter) => {
    const rows = [];
    let skip = 0;

    while (rows.length < MAX_FETCH) {
      const limit = Math.min(FETCH_BATCH_SIZE, MAX_FETCH - rows.length);
      const chunk = await base44.entities.LeaderboardEntry.filter(filter, '-score', limit, skip);
      if (!chunk?.length) break;

      rows.push(...chunk);
      skip += chunk.length;

      if (chunk.length < limit) break;
    }

    return rows;
  };

  const { data: leaderboardEntries = [] } = useQuery({
    queryKey: ['leaderboard-entries', selectedView],
    queryFn: async () => {
      if (!currentView) return [];
      const filter = {
        leaderboard_type: currentView.leaderboardType,
      };
      if (currentView.leaderboardType === 'discgolf_ee') {
        filter.game_type = 'classic';
      } else {
        filter.game_type = currentView.gameType;
      }
      return fetchLeaderboardRows(filter);
    },
    refetchInterval: 30000
  });

  const leaderboardGameIds = useMemo(() => {
    return Array.from(new Set(leaderboardEntries.map(entry => entry.game_id).filter(Boolean)));
  }, [leaderboardEntries]);

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
    enabled: leaderboardGameIds.length > 0,
    staleTime: 60000
  });

  const userRole = user?.app_role || 'user';
  const canDelete = ['admin', 'super_admin'].includes(userRole);

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

  const usersByUid = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u?.id) {
        map[u.id] = u;
      }
    });
    return map;
  }, [users]);

  const usersByEmail = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u?.email) {
        map[u.email.trim().toLowerCase()] = u;
      }
    });
    return map;
  }, [users]);

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

  const resolveEntryUser = (entry) => {
    const game = entry?.game_id ? gamesById?.[entry.game_id] : null;
    const mappedUid = entry?.player_uid || (entry?.player_name ? game?.player_uids?.[entry.player_name] : null);
    if (mappedUid && usersByUid[mappedUid]) {
      return usersByUid[mappedUid];
    }
    const mappedEmail = (entry?.player_email && entry.player_email !== 'unknown')
      ? entry.player_email
      : (entry?.player_name ? game?.player_emails?.[entry.player_name] : null);
    const normalizedEmail = mappedEmail?.trim().toLowerCase();
    if (normalizedEmail && usersByEmail[normalizedEmail]) {
      return usersByEmail[normalizedEmail];
    }
    return null;
  };

  const getResolvedGender = (entry) => {
    const profile = resolveEntryUser(entry);
    return profile?.gender || entry?.player_gender || null;
  };

  const getResolvedPlayerName = (entry) => {
    const profile = resolveEntryUser(entry);
    return profile?.full_name || entry?.player_name;
  };

  const isCurrentUserEntry = (entry) => {
    if (!user) return false;
    const profile = resolveEntryUser(entry);
    if (currentUserId && profile?.id && profile.id === currentUserId) return true;
    const entryEmail = normalizeText(profile?.email || entry?.player_email);
    if (currentUserEmail && entryEmail && currentUserEmail === entryEmail) return true;
    const entryName = normalizeText(profile?.full_name || entry?.player_name);
    if (currentUserName && entryName && currentUserName === entryName) return true;
    return false;
  };

  const isHostedEntry = (entry) => {
    const game = entry?.game_id ? gamesById?.[entry.game_id] : null;
    return Boolean(game?.pin && game.pin !== '0000');
  };

  const filteredEntries = leaderboardEntries.filter(entry => {
    if (!currentView) return false;
    if (entry.leaderboard_type !== currentView.leaderboardType) return false;
    if (!entry?.game_id || !gamesById?.[entry.game_id]) return false;
    
    if (currentView.leaderboardType === 'discgolf_ee') {
      if (entry.game_type !== 'classic') return false;
      if (!isHostedEntry(entry)) return false;
    } else {
      if (entry.game_type !== currentView.gameType) return false;
    }
    
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

  const isATWView = currentView?.gameType === 'around_the_world';

  const getPlayerKey = (entry) => {
    const game = entry?.game_id ? gamesById?.[entry.game_id] : null;
    const profile = resolveEntryUser(entry);
    if (profile?.id) return `uid:${profile.id}`;

    const mappedEmail = entry?.player_name ? game?.player_emails?.[entry.player_name] : null;
    const hostEmail = game?.host_user;
    const email = normalizeText(profile?.email || entry?.player_email || mappedEmail);
    if (email && email !== 'unknown' && email !== normalizeText(hostEmail)) {
      return `email:${email}`;
    }

    const resolvedName = normalizeText(profile?.full_name || entry?.player_name);
    if (resolvedName) return `name:${resolvedName}`;

    return `id:${entry.id}`;
  };

  // Group by player and keep only the best score for each
  const bestScoresByPlayer = {};
  filteredEntries.forEach(entry => {
    const key = getPlayerKey(entry);
    const existing = bestScoresByPlayer[key];
    if (!existing || entry.score > existing.score || (entry.score === existing.score && entry.date > existing.date)) {
      bestScoresByPlayer[key] = entry;
    }
  });

  const uniqueEntries = Object.values(bestScoresByPlayer).sort((a, b) => b.score - a.score);
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
                        {!isATWView && (
                          <th className="text-center py-3 px-2 text-slate-600 font-semibold">
                            {currentView.gameType === 'streak_challenge' ? 'Distants' : 'Täpsus'}
                          </th>
                        )}
                        {!isATWView && (
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
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
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
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              <div className="flex items-center gap-2">
                                <span>{getResolvedPlayerName(entry)}</span>
                                {isHostedEntry(entry) && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                                    <Award className="w-3 h-3" />
                                    DG.ee
                                  </span>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              <span className="text-lg font-bold text-emerald-600">{entry.score}</span>
                            </Link>
                          </td>
                          {!isATWView && (
                            <td className="py-3 px-2 text-center text-slate-700">
                              <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                                {currentView.gameType === 'streak_challenge' 
                                  ? `${entry.streak_distance || 0}m` 
                                  : (entry.accuracy ? `${entry.accuracy.toFixed(1)}%` : '-')
                                }
                              </Link>
                            </td>
                          )}
                          {!isATWView && (
                            <td className="py-3 px-2 text-center text-slate-600">
                              <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                                {entry.made_putts}/{entry.total_putts}
                              </Link>
                            </td>
                          )}
                          <td className="py-3 px-2 text-right text-slate-500 text-xs">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
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
