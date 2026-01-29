import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Target, Award } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PuttingRecords() {
  const [selectedView, setSelectedView] = useState('general_classic');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const MAX_FETCH = 500;
  const [fetchLimit, setFetchLimit] = useState(PAGE_SIZE);

  const viewTypes = [
    { id: 'general_classic', label: 'Classic', leaderboardType: 'general', gameType: 'classic' },
    { id: 'general_back_and_forth', label: 'Back & Forth', leaderboardType: 'general', gameType: 'back_and_forth' },
    { id: 'general_short', label: 'Short', leaderboardType: 'general', gameType: 'short' },
    { id: 'general_streak_challenge', label: 'Streak', leaderboardType: 'general', gameType: 'streak_challenge' },
    { id: 'general_random_distance', label: 'Random', leaderboardType: 'general', gameType: 'random_distance' },
    { id: 'general_around_the_world', label: 'Around World', leaderboardType: 'general', gameType: 'around_the_world' },
    { id: 'discgolf_ee', label: 'DG.ee', leaderboardType: 'discgolf_ee', gameType: 'classic' }
  ];

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const currentView = viewTypes.find(v => v.id === selectedView);
  const displayLimit = PAGE_SIZE * page;

  useEffect(() => {
    setPage(1);
    setFetchLimit(PAGE_SIZE);
  }, [selectedView, selectedGender, selectedMonth]);

  const { data: leaderboardEntries = [] } = useQuery({
    queryKey: ['leaderboard-entries', selectedView, fetchLimit],
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
      return base44.entities.LeaderboardEntry.filter(filter, '-score', fetchLimit);
    },
    refetchInterval: 30000
  });

  const { data: discgolfEntries = [] } = useQuery({
    queryKey: ['leaderboard-entries-discgolf', currentView?.leaderboardType, fetchLimit],
    queryFn: async () => {
      if (!currentView || currentView.leaderboardType !== 'general') return [];
      return base44.entities.LeaderboardEntry.filter(
        { leaderboard_type: 'discgolf_ee', game_type: 'classic' },
        '-score',
        fetchLimit
      );
    },
    refetchInterval: 30000
  });

  const leaderboardGameIds = useMemo(() => {
    return Array.from(new Set(leaderboardEntries.map(entry => entry.game_id).filter(Boolean)));
  }, [leaderboardEntries]);

  const { data: gamesById = {} } = useQuery({
    queryKey: ['leaderboard-games', leaderboardGameIds.join('|')],
    queryFn: async () => {
      if (leaderboardGameIds.length === 0) return {};
      const results = await Promise.all(
        leaderboardGameIds.map(async (id) => {
          try {
            const games = await base44.entities.Game.filter({ id });
            return games?.[0] || null;
          } catch {
            return null;
          }
        })
      );
      const map = {};
      results.forEach(game => {
        if (game?.id) map[game.id] = game;
      });
      return map;
    },
    enabled: leaderboardGameIds.length > 0,
    staleTime: 60000
  });

  const userRole = user?.app_role || 'user';
  const canDelete = ['admin', 'super_admin'].includes(userRole);

  // Generate last 6 months for filter
  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    monthOptions.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: format(date, 'MMMM yyyy')
    });
  }

  const filteredEntries = leaderboardEntries.filter(entry => {
    if (!currentView) return false;
    if (entry.leaderboard_type !== currentView.leaderboardType) return false;
    
    if (currentView.leaderboardType === 'discgolf_ee') {
      // DG.ee view: only classic records
      if (entry.game_type !== 'classic') return false;
    } else {
      if (entry.game_type !== currentView.gameType) return false;
    }
    
    if (selectedGender !== 'all') {
      if (selectedGender === 'N') {
        if (entry.player_gender !== 'N') return false;
      } else if (selectedGender === 'M') {
        if (entry.player_gender === 'N') return false;
      }
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
    const mappedUid = entry?.player_name ? game?.player_uids?.[entry.player_name] : null;
    const mappedEmail = entry?.player_name ? game?.player_emails?.[entry.player_name] : null;
    const uidKey = entry?.player_uid || mappedUid ? `uid:${entry.player_uid || mappedUid}` : null;
    if (uidKey) return uidKey;

    const hostEmail = game?.host_user;
    const email = entry?.player_email && entry.player_email !== 'unknown'
      ? entry.player_email
      : (mappedEmail || null);
    const emailKey = email && email !== hostEmail ? `email:${email}` : null;
    const nameKey = entry?.player_name
      ? `name:${entry.player_name.trim().toLowerCase()}`
      : null;

    return emailKey || nameKey || `id:${entry.id}`;
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
  const sortedEntries = uniqueEntries.slice(0, displayLimit);
  const canFetchMore = leaderboardEntries.length >= fetchLimit && fetchLimit < MAX_FETCH;
  const hasMoreToShow = uniqueEntries.length > displayLimit;
  const canLoadMore = hasMoreToShow || canFetchMore;

  useEffect(() => {
    if (!canFetchMore) return;
    if (uniqueEntries.length >= displayLimit) return;
    setFetchLimit(prev => Math.min(prev * 2, MAX_FETCH));
  }, [canFetchMore, displayLimit, uniqueEntries.length]);

  // Helper to check if a general entry has a corresponding DG.ee entry
  const hasDiscgolfEntry = (entry) => {
    if (entry.leaderboard_type !== 'general') return false;
    return discgolfEntries.some(e => 
      e.leaderboard_type === 'discgolf_ee' && 
      e.game_id === entry.game_id &&
      (e.player_uid && entry.player_uid ? e.player_uid === entry.player_uid : e.player_name === entry.player_name)
    );
  };

  const isHostedGame = (entry) => {
    if (!entry?.game_id) return false;
    const game = gamesById[entry.game_id];
    return !!(game?.pin && game.pin !== '0000');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h2 className="text-2xl font-bold text-slate-800">Putting Records</h2>
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
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="M">Mehed</SelectItem>
                    <SelectItem value="N">Naised</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {sortedEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No records yet. Be the first!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">#</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">Player</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">Score</th>
                        {!isATWView && (
                          <th className="text-center py-3 px-2 text-slate-600 font-semibold">
                            {currentView.gameType === 'streak_challenge' ? 'Distance' : 'Accuracy'}
                          </th>
                        )}
                        {!isATWView && (
                          <th className="text-center py-3 px-2 text-slate-600 font-semibold">Putts</th>
                        )}
                        <th className="text-right py-3 px-2 text-slate-600 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map((entry, idx) => (
                        <tr key={entry.id} className={`border-b border-slate-100 ${idx < 3 ? 'bg-amber-50' : 'hover:bg-slate-50'} cursor-pointer transition-colors`}>
                          <td className="py-3 px-2">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                idx === 1 ? 'bg-slate-300 text-slate-700' :
                                idx === 2 ? 'bg-orange-300 text-orange-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {idx + 1}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-2 font-medium text-slate-700">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              <div className="flex items-center gap-2">
                                <span>{entry.player_name}</span>
                                <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                  {entry.player_gender || 'M'}
                                </span>
                                {(isHostedGame(entry) || hasDiscgolfEntry(entry)) && (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canLoadMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setPage(prev => prev + 1)}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Näita rohkem
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
