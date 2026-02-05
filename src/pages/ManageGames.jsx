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
  deleteGameAndLeaderboardEntries,
  getLeaderboardEmail,
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
      toast.success('Mäng märgitud lõpetatuks');
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

  const REQUEST_INTERVAL_MS = 150;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
  const normalizeIdentityEmail = (value) => {
    const normalized = normalizeEmail(value);
    if (!normalized || normalized === 'unknown') return '';
    return normalized;
  };
  const isRateLimitError = (error) => {
    const status = error?.status || error?.response?.status;
    const message = String(error?.message || '');
    return status === 429 || message.includes('429') || message.toLowerCase().includes('too many');
  };
  const withRateLimitRetry = async (fn, { retries = 3, delayMs = 300 } = {}) => {
    let attempt = 0;
    let waitMs = delayMs;
    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (!isRateLimitError(error) || attempt >= retries) {
          throw error;
        }
        await sleep(waitMs);
        waitMs *= 2;
        attempt += 1;
      }
    }
  };
  const requestQueueRef = React.useRef(Promise.resolve());
  const lastRequestAtRef = React.useRef(0);
  const enqueueRequest = React.useCallback(async (fn) => {
    const run = async () => {
      const elapsed = Date.now() - lastRequestAtRef.current;
      const waitMs = Math.max(0, REQUEST_INTERVAL_MS - elapsed);
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      const result = await fn();
      lastRequestAtRef.current = Date.now();
      return result;
    };

    const chained = requestQueueRef.current.then(run, run);
    requestQueueRef.current = chained.catch(() => {});
    return chained;
  }, []);
  const queuedRequest = React.useCallback(
    (fn, options) => withRateLimitRetry(() => enqueueRequest(fn), options),
    [enqueueRequest]
  );

  const resolveGamePlayers = (game) => {
    const fromPlayers = Array.isArray(game.players) ? game.players : [];
    const fromPutts = Object.keys(game.player_putts || {});
    const fromAtw = Object.keys(game.atw_state || {});
    return Array.from(new Set([...fromPlayers, ...fromPutts, ...fromAtw].filter(Boolean)));
  };

  const getEntryIdentityKey = (entry) => {
    if (entry?.player_uid) return `uid:${entry.player_uid}`;
    const email = normalizeIdentityEmail(entry?.player_email);
    if (email) return `email:${email}`;
    if (entry?.player_name) return `name:${entry.player_name.trim().toLowerCase()}`;
    return `id:${entry?.id}`;
  };

  const getResolvedIdentityKey = (resolvedPlayer) => {
    if (resolvedPlayer?.playerUid) return `uid:${resolvedPlayer.playerUid}`;
    const email = normalizeIdentityEmail(resolvedPlayer?.playerEmail);
    if (email) return `email:${email}`;
    if (resolvedPlayer?.playerName) return `name:${resolvedPlayer.playerName.trim().toLowerCase()}`;
    return '';
  };

  const fetchLeaderboardEntries = async (filter) => {
    const entries = [];
    let skip = 0;
    const limit = 200;
    while (entries.length < 2000) {
      const chunk = await queuedRequest(
        () => base44.entities.LeaderboardEntry.filter(filter, '-score', limit, skip),
        { retries: 4, delayMs: 350 }
      );
      if (!chunk?.length) break;
      entries.push(...chunk);
      if (chunk.length < limit) break;
      skip += chunk.length;
    }
    return entries;
  };

  const syncGameToLeaderboards = async (game, profileCache = {}) => {
    const results = [];
    const players = resolveGamePlayers(game);
    let eligiblePlayers = 0;
    const generalByKey = new Map();
    const discgolfByKey = new Map();

    try {
      const existingGeneralEntries = await fetchLeaderboardEntries({
        game_id: game.id,
        game_type: game.game_type,
        leaderboard_type: 'general'
      });
      existingGeneralEntries.forEach((entry) => {
        const key = getEntryIdentityKey(entry);
        if (!key) return;
        const current = generalByKey.get(key);
        if (!current || entry.score > current.score) {
          generalByKey.set(key, entry);
        }
      });

      if (isHostedClassicGame(game)) {
        const existingDgEntries = await fetchLeaderboardEntries({
          game_id: game.id,
          game_type: game.game_type,
          leaderboard_type: 'discgolf_ee'
        });
        existingDgEntries.forEach((entry) => {
          const key = getEntryIdentityKey(entry);
          if (!key) return;
          const current = discgolfByKey.get(key);
          if (!current || entry.score > current.score) {
            discgolfByKey.set(key, entry);
          }
        });
      }
    } catch (error) {
      console.warn(`[Sync] "${game?.name}" olemasolevate kirjete laadimine ebaõnnestus:`, error);
    }

    for (const rawPlayerName of players) {
      if (!rawPlayerName) continue;

      const { score, madePutts, totalPutts, accuracy } = getLeaderboardStats(game, rawPlayerName);
      const hasStats = totalPutts > 0 || score > 0;
      const resolvedPlayer = await resolveLeaderboardPlayer({
        game,
        playerName: rawPlayerName,
        cache: profileCache
      });
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
        player_email: getLeaderboardEmail(resolvedPlayer),
        ...(resolvedPlayer.playerGender ? { player_gender: resolvedPlayer.playerGender } : {}),
        ...(game.game_type === 'streak_challenge'
          ? { streak_distance: game.player_distances?.[rawPlayerName] || 0 }
          : {}),
        date: normalizedDate
      };

      if (!hasStats) {
        results.push({ player: resolvedPlayer.playerName, action: 'skipped', reason: 'no_stats' });
        continue;
      }
      eligiblePlayers += 1;

      try {
        const identityKey = getResolvedIdentityKey(resolvedPlayer);
        const existingGeneral = identityKey ? generalByKey.get(identityKey) : null;
        let didWrite = false;

        if (existingGeneral) {
          if (score > existingGeneral.score) {
            await queuedRequest(
              () => base44.entities.LeaderboardEntry.update(existingGeneral.id, {
                ...basePayload,
                leaderboard_type: 'general'
              }),
              { retries: 4, delayMs: 350 }
            );
            results.push({ player: resolvedPlayer.playerName, action: 'updated' });
            didWrite = true;
            if (identityKey) {
              generalByKey.set(identityKey, { ...existingGeneral, ...basePayload, leaderboard_type: 'general' });
            }
          } else {
            results.push({ player: resolvedPlayer.playerName, action: 'skipped', reason: 'lower_score' });
          }
        } else {
          const created = await queuedRequest(
            () => base44.entities.LeaderboardEntry.create({
              ...basePayload,
              leaderboard_type: 'general',
            }),
            { retries: 4, delayMs: 350 }
          );
          results.push({ player: resolvedPlayer.playerName, action: 'created' });
          didWrite = true;
          if (identityKey) {
            generalByKey.set(identityKey, created || { ...basePayload, leaderboard_type: 'general' });
          }
        }

        if (isHostedClassicGame(game)) {
          const existingDg = identityKey ? discgolfByKey.get(identityKey) : null;

          if (existingDg) {
            if (score > existingDg.score) {
              await queuedRequest(
                () => base44.entities.LeaderboardEntry.update(existingDg.id, {
                  ...basePayload,
                  leaderboard_type: 'discgolf_ee',
                  submitted_by: user?.email
                }),
                { retries: 4, delayMs: 350 }
              );
              didWrite = true;
              if (identityKey) {
                discgolfByKey.set(identityKey, { ...existingDg, ...basePayload, leaderboard_type: 'discgolf_ee' });
              }
            }
          } else {
            const createdDg = await queuedRequest(
              () => base44.entities.LeaderboardEntry.create({
                ...basePayload,
                leaderboard_type: 'discgolf_ee',
                submitted_by: user?.email
              }),
              { retries: 4, delayMs: 350 }
            );
            didWrite = true;
            if (identityKey) {
              discgolfByKey.set(identityKey, createdDg || { ...basePayload, leaderboard_type: 'discgolf_ee' });
            }
          }
        }

        if (didWrite) {
          await sleep(REQUEST_INTERVAL_MS);
        }
      } catch (error) {
        results.push({ player: resolvedPlayer.playerName, action: 'error', error });
      }
    }

    return { results, players, eligiblePlayers };
  };

  const submitToDiscgolfMutation = useMutation({
    mutationFn: async (game) => {
      const payload = await syncGameToLeaderboards(game, {});
      return { ...payload, game };
    },
    onSuccess: ({ results, eligiblePlayers, players, game }) => {
      const updated = results.filter(r => r.action === 'updated').length;
      const created = results.filter(r => r.action === 'created').length;
      const errors = results.filter(r => r.action === 'error').length;
      const skippedNoStats = results.filter(r => r.action === 'skipped' && r.reason === 'no_stats').map(r => r.player);
      const skippedLowerScore = results.filter(r => r.action === 'skipped' && r.reason === 'lower_score').length;
      const totalPlayers = players?.length || 0;
      
      let message = 'Edetabelitesse saadetud';
      const detailParts = [];
      if (created > 0) detailParts.push(`${created} uusi`);
      if (updated > 0) detailParts.push(`${updated} uuendatud`);
      if (skippedLowerScore > 0) detailParts.push(`${skippedLowerScore} rekord parem olemas`);
      if (skippedNoStats.length > 0) detailParts.push(`${skippedNoStats.length} stats puudub`);
      if (errors > 0) detailParts.push(`${errors} viga`);
      if (detailParts.length > 0) {
        message += ` (${detailParts.join(', ')})`;
      }
      if (totalPlayers > 0) {
        message += ` • Mängijaid: ${totalPlayers}, statsiga: ${eligiblePlayers}`;
      }

      if (skippedNoStats.length > 0) {
        console.warn(`[Sync] "${game?.name}" - puuduvad stats:`, skippedNoStats);
      }
      const errorPlayers = results.filter(r => r.action === 'error');
      if (errorPlayers.length > 0) {
        console.error(`[Sync] "${game?.name}" - vead:`, errorPlayers);
      }

      if (errors > 0) {
        toast.error(message);
      } else {
        toast.success(message);
      }
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
    },
    onError: (error) => {
      const message = error?.message || 'Saatmine ebaõnnestus';
      toast.error(message);
    }
  });

  const bulkSyncMutation = useMutation({
    mutationFn: async (gamesToSync) => {
      const profileCache = {};
      const summary = {
        games: gamesToSync.length,
        players: 0,
        eligiblePlayers: 0,
        created: 0,
        updated: 0,
        skippedNoStats: 0,
        skippedLowerScore: 0,
        errors: 0
      };

      for (const game of gamesToSync) {
        const payload = await syncGameToLeaderboards(game, profileCache);
        const { results, eligiblePlayers, players } = payload;
        summary.created += results.filter(r => r.action === 'created').length;
        summary.updated += results.filter(r => r.action === 'updated').length;
        summary.errors += results.filter(r => r.action === 'error').length;
        summary.players += players?.length || 0;
        summary.eligiblePlayers += eligiblePlayers || 0;

        const skippedNoStats = results.filter(r => r.action === 'skipped' && r.reason === 'no_stats').map(r => r.player);
        summary.skippedNoStats += skippedNoStats.length;
        summary.skippedLowerScore += results.filter(r => r.action === 'skipped' && r.reason === 'lower_score').length;
        if (skippedNoStats.length > 0) {
          console.warn(`[Bulk Sync] "${game?.name}" - puuduvad stats:`, skippedNoStats);
        }
        const errorPlayers = results.filter(r => r.action === 'error');
        if (errorPlayers.length > 0) {
          console.error(`[Bulk Sync] "${game?.name}" - vead:`, errorPlayers);
        }
      }

      return summary;
    },
    onSuccess: (summary) => {
      const detailParts = [`${summary.games} mängu`];
      if (summary.created > 0) detailParts.push(`${summary.created} uusi`);
      if (summary.updated > 0) detailParts.push(`${summary.updated} uuendatud`);
      if (summary.skippedLowerScore > 0) detailParts.push(`${summary.skippedLowerScore} rekord parem olemas`);
      if (summary.skippedNoStats > 0) detailParts.push(`${summary.skippedNoStats} stats puudub`);
      if (summary.errors > 0) detailParts.push(`${summary.errors} viga`);
      let message = `Mass-sünk valmis (${detailParts.join(', ')})`;
      if (summary.players > 0) {
        message += ` • Mängijaid: ${summary.players}, statsiga: ${summary.eligiblePlayers}`;
      }
      if (summary.errors > 0) {
        toast.error(message);
      } else {
        toast.success(message);
      }
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Mass-sünk ebaõnnestus');
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
            <span className="font-medium">Tagasi</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Halda mänge</h1>
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
              Loo grupp valitutest ({selectedGames.length})
            </Button>
            
          </div>
        </div>

        {/* Groups */}
        {groups.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Minu grupid
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
                              <div className="text-sm text-slate-500">{group.game_ids?.length || 0} mänge</div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirm(`Kustuta grupp "${group.name}"?`)) {
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
          <h2 className="text-lg font-bold text-slate-800 mb-3">Aktiivsed mängud</h2>
          {activeGames.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
              <p>Aktiivseid mänge pole</p>
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
                        {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'Kuupäev puudub'}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {game.players?.length || 0} mängijat • PIN: {game.pin}
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
                        Sulge mäng
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Kustuta see mäng?')) {
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
              <h2 className="text-lg font-bold text-slate-800">Lõpetatud mängud</h2>
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
                  {bulkSyncMutation.isPending ? 'Sünkroniseerin...' : `Sünkroniseeri valitud (${selectedSyncGameIds.length})`}
                </Button>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white hover:border-emerald-300"
                >
                  <option value="all">Kõik kuud</option>
                  {sortedMonths.map((month) => {
                    const [year, monthNum] = month.split('-');
                    const monthName = new Date(year, parseInt(monthNum) - 1).toLocaleDateString('et-EE', { month: 'long', year: 'numeric' });
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
                        aria-label="Vali kõik lõpetatud mängud"
                        className="w-4 h-4 rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">Mäng</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">Kuupäev</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">Formaat</th>
                    <th className="text-center py-3 px-4 text-slate-600 font-semibold">Mängijad</th>
                    <th className="text-right py-3 px-4 text-slate-600 font-semibold">Tegevused</th>
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
                          aria-label={`Vali ${game.name}`}
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
                            {isGameSubmitted(game.id) ? 'Sünkroniseeri uuesti' : 'Saada'}
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm('Kustuta see mäng?')) {
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
              <h3 className="text-xl font-bold text-slate-800 mb-4">Loo mängugrupp</h3>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="nt Neljapäevane treening"
                className="mb-4"
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowGroupDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Tühista
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Loo
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
