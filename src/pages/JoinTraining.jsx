import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Users, LogOut, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { createPageUrl } from '@/utils';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import BackButton from '@/components/ui/back-button';
import { getDayFullLabel, getSlotAvailability, getWeekKey } from '@/lib/training-utils';
import { cn } from '@/lib/utils';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  deleteField,
  arrayRemove,
  runTransaction
} from 'firebase/firestore';

export default function JoinTraining() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pin, setPin] = React.useState('');
  const [isJoining, setIsJoining] = React.useState(false);
  const [joiningGameId, setJoiningGameId] = React.useState(null);
  const [showJoinForm, setShowJoinForm] = React.useState(false);
  const [pendingGroup, setPendingGroup] = React.useState(null);
  const [pendingSlots, setPendingSlots] = React.useState([]);
  const [selectedSlotId, setSelectedSlotId] = React.useState('');
  const [publicAction, setPublicAction] = React.useState({});
  const weekKey = React.useMemo(() => getWeekKey(), []);

  React.useEffect(() => {
    if (!pendingGroup || pendingSlots.length !== 1) return;
    const slot = pendingSlots[0];
    const maxSpots = Number(slot?.max_spots || 0);
    const rosterCount = Array.isArray(slot?.roster_uids) ? slot.roster_uids.length : 0;
    if (maxSpots === 0 || rosterCount < maxSpots) {
      setSelectedSlotId(slot.id);
    }
  }, [pendingGroup, pendingSlots]);


  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const trainingGroupNames = React.useMemo(() => {
    const groups = user?.training_groups;
    if (!groups || typeof groups !== 'object') return {};
    return groups;
  }, [user]);

  const trainingGroupEntries = React.useMemo(
    () => Object.entries(trainingGroupNames).map(([id, name]) => ({ id, name })),
    [trainingGroupNames]
  );

  const groupIds = React.useMemo(() => Object.keys(trainingGroupNames), [trainingGroupNames]);

  const { data: publicGroups = [] } = useQuery({
    queryKey: ['training-public-groups'],
    queryFn: async () => {
      const groupsRef = collection(db, 'training_groups');
      const q = query(groupsRef, where('has_public_slots', '==', true), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 60000
  });

  const publicSlots = React.useMemo(() => {
    return publicGroups.flatMap((group) =>
      (group.slots || [])
        .filter((slot) => slot?.is_public)
        .map((slot) => ({ group, slot }))
    );
  }, [publicGroups]);

  const { data: trainingGames = [], isLoading: isLoadingGames } = useQuery({
    queryKey: ['training-games', groupIds.join('|')],
    enabled: groupIds.length > 0,
    queryFn: async () => {
      const allGames = [];
      const chunkSize = 10;
      for (let i = 0; i < groupIds.length; i += chunkSize) {
        const chunk = groupIds.slice(i, i + chunkSize);
        const games = await base44.entities.Game.filter({
          training_group_id: { $in: chunk },
          status: { $in: ['setup', 'active'] }
        }, '-date', 50);
        allGames.push(...games);
      }
      return allGames.filter((game) =>
        game?.pin &&
        game.pin !== '0000' &&
        game.join_closed !== true &&
        game.status !== 'closed'
      );
    },
    staleTime: 15000
  });

  const { data: trainingGroupDetails = {}, isLoading: isLoadingGroupDetails } = useQuery({
    queryKey: ['training-group-details', groupIds.join('|')],
    enabled: groupIds.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        groupIds.map(async (groupId) => {
          const snap = await getDoc(doc(db, 'training_groups', groupId));
          if (!snap.exists()) return null;
          return { id: snap.id, ...snap.data() };
        })
      );
      return entries.reduce((acc, entry) => {
        if (!entry) return acc;
        acc[entry.id] = entry;
        return acc;
      }, {});
    },
    staleTime: 30000
  });

  const isPrivileged = ['trainer', 'admin', 'super_admin'].includes(user?.app_role || '');
  const confirmedByGroup = React.useMemo(() => {
    if (!user?.id) return {};
    const map = {};
    groupIds.forEach((groupId) => {
      const detail = trainingGroupDetails[groupId];
      if (!detail) {
        map[groupId] = false;
        return;
      }
      const slots = Array.isArray(detail.slots) ? detail.slots : [];
      const weekData = detail.attendance?.[weekKey] || {};
      map[groupId] = slots.some((slot) => {
        const roster = Array.isArray(slot?.roster_uids) ? slot.roster_uids : [];
        if (roster.includes(user.id)) return true;
        const claimed = Array.isArray(weekData?.[slot.id]?.claimed_uids) ? weekData[slot.id].claimed_uids : [];
        return claimed.includes(user.id);
      });
    });
    return map;
  }, [groupIds, trainingGroupDetails, user?.id, weekKey]);

  const resetPendingJoin = () => {
    setPendingGroup(null);
    setPendingSlots([]);
    setSelectedSlotId('');
  };

  const finalizeJoin = async (group, slotId) => {
    if (!group?.id || !user?.id) return;
    const displayName = user?.display_name || user?.full_name || user?.email || 'Mängija';
    const updates = {
      member_uids: arrayUnion(user.id),
      [`members.${user.id}`]: {
        name: displayName,
        email: user?.email || '',
        joined_at: serverTimestamp()
      }
    };

    if (slotId) {
      const groupSlots = Array.isArray(group.slots) ? group.slots : [];
      const targetSlot = groupSlots.find((slot) => slot.id === slotId);
      if (targetSlot) {
        const roster = Array.isArray(targetSlot.roster_uids) ? targetSlot.roster_uids : [];
        const maxSpots = Number(targetSlot.max_spots || 0);
        if (maxSpots > 0 && roster.length >= maxSpots) {
          throw new Error('Valitud trenn on täis');
        }
        const nextSlots = groupSlots.map((slot) => {
          if (slot.id !== slotId) return slot;
          if (roster.includes(user.id)) return slot;
          return { ...slot, roster_uids: [...roster, user.id] };
        });
        updates.slots = nextSlots;
        updates.has_public_slots = nextSlots.some((slot) => slot.is_public);
      }
    }

    await updateDoc(doc(db, 'training_groups', group.id), updates);
    await updateDoc(doc(db, 'users', user.id), {
      [`training_groups.${group.id}`]: group?.name || 'Treening'
    });
  };

  const handleJoin = async () => {
    const cleanedPin = pin.replace(/\D/g, '').slice(0, 4);
    if (cleanedPin.length !== 4) {
      toast.error('Sisesta 4-kohaline PIN');
      return;
    }
    if (!user?.id) {
      toast.error('Palun logi sisse');
      return;
    }

    setIsJoining(true);
    try {
      const hadGroups = groupIds.length > 0;
      const q = query(collection(db, 'training_groups'), where('pin', '==', cleanedPin), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('PIN ei leitud');
        return;
      }

      const docSnap = snap.docs[0];
      const group = { id: docSnap.id, ...docSnap.data() };
      const slots = Array.isArray(group.slots) ? group.slots : [];
      if (slots.length > 0) {
        setPendingGroup(group);
        setPendingSlots(slots);
        setSelectedSlotId('');
        return;
      }

      await finalizeJoin(group, null);
      toast.success(`Liitusid trenniga "${group?.name || 'Treening'}"`);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['training-group-details'] });
      queryClient.invalidateQueries({ queryKey: ['training-games'] });
      resetPendingJoin();
      setPin('');
      if (hadGroups) {
        setShowJoinForm(false);
      } else {
        navigate(-1);
      }
    } catch (error) {
      toast.error(error?.message || 'Liitumine ebaõnnestus');
    } finally {
      setIsJoining(false);
    }
  };

  const handleConfirmJoin = async (skipSlot = false) => {
    if (!pendingGroup) return;
    if (!skipSlot && !selectedSlotId) {
      toast.error('Vali trenn');
      return;
    }
    setIsJoining(true);
    try {
      const hadGroups = groupIds.length > 0;
      await finalizeJoin(pendingGroup, skipSlot ? null : selectedSlotId);
      toast.success(`Liitusid trenniga "${pendingGroup?.name || 'Treening'}"`);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['training-group-details'] });
      queryClient.invalidateQueries({ queryKey: ['training-games'] });
      resetPendingJoin();
      setPin('');
      if (hadGroups) {
        setShowJoinForm(false);
      } else {
        navigate(-1);
      }
    } catch (error) {
      toast.error(error?.message || 'Liitumine ebaõnnestus');
    } finally {
      setIsJoining(false);
    }
  };

  const getPlayerCount = (game) => {
    if (!game) return 0;
    return (
      game.players?.length ||
      Object.keys(game.player_putts || {}).length ||
      Object.keys(game.atw_state || {}).length ||
      0
    );
  };

  const joinTrainingGame = async (game) => {
    if (!game?.id) return;
    if (!user?.id) {
      toast.error('Palun logi sisse');
      return;
    }
    const playerName = user?.display_name || user?.full_name || user?.email || 'Mängija';
    setJoiningGameId(game.id);
    try {
      const currentGame = game;
      const hasPlayer = currentGame.players?.includes(playerName);
      const updatedPlayerUids = {
        ...(currentGame.player_uids || {}),
        ...(user?.id ? { [playerName]: user.id } : {})
      };
      const updatedPlayerEmails = {
        ...(currentGame.player_emails || {}),
        ...(user?.email ? { [playerName]: user.email } : {})
      };

      if (hasPlayer) {
        await base44.entities.Game.update(currentGame.id, {
          player_uids: updatedPlayerUids,
          player_emails: updatedPlayerEmails
        });
      } else {
        const gameType = currentGame.game_type || 'classic';
        const format = GAME_FORMATS[gameType];
        const startDistance = format?.startDistance ?? 0;
        const updatedPlayers = [...(currentGame.players || []), playerName];
        const updatedDistances = { ...(currentGame.player_distances || {}), [playerName]: startDistance };
        const updatedPutts = { ...(currentGame.player_putts || {}), [playerName]: [] };
        const updatedPoints = { ...(currentGame.total_points || {}), [playerName]: 0 };
        const updateData = {
          players: updatedPlayers,
          player_distances: updatedDistances,
          player_putts: updatedPutts,
          total_points: updatedPoints,
          player_uids: updatedPlayerUids,
          player_emails: updatedPlayerEmails
        };
        if (gameType === 'around_the_world') {
          updateData.atw_state = {
            ...(currentGame.atw_state || {}),
            [playerName]: {
              current_distance_index: 0,
              direction: 'UP',
              laps_completed: 0,
              turns_played: 0,
              total_makes: 0,
              total_putts: 0,
              current_distance_points: 0,
              current_round_draft: { attempts: [], is_finalized: false },
              history: [],
              best_score: 0,
              best_laps: 0,
              best_accuracy: 0,
              attempts_count: 0
            }
          };
        }
        await base44.entities.Game.update(currentGame.id, updateData);
      }

      navigate(`${createPageUrl('Home')}?mode=player&gameId=${currentGame.id}&from=training`);
    } catch (error) {
      toast.error(error?.message || 'Mänguga liitumine ebaõnnestus');
    } finally {
      setJoiningGameId(null);
    }
  };

  const handleLeaveGroup = async (groupId, groupName) => {
    if (!user?.id) return;
    if (!confirm(`Kas eemaldame sind trennist "${groupName || 'Treening'}"?`)) {
      return;
    }
    try {
      await updateDoc(doc(db, 'training_groups', groupId), {
        member_uids: arrayRemove(user.id),
        [`members.${user.id}`]: deleteField()
      });
      await updateDoc(doc(db, 'users', user.id), {
        [`training_groups.${groupId}`]: deleteField()
      });
      toast.success('Lahkusid trennist');
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['training-games'] });
    } catch (error) {
      toast.error(error?.message || 'Trennist lahkumine ebaõnnestus');
    }
  };

  const ensureGroupMember = async (group) => {
    if (!user?.id || !group?.id) return;
    const isMember = group?.member_uids?.includes(user.id) || group?.members?.[user.id];
    if (isMember) return;
    const displayName = user?.display_name || user?.full_name || user?.email || 'Trenniline';
    await updateDoc(doc(db, 'training_groups', group.id), {
      member_uids: arrayUnion(user.id),
      [`members.${user.id}`]: {
        name: displayName,
        email: user?.email || '',
        joined_at: serverTimestamp()
      }
    });
    await updateDoc(doc(db, 'users', user.id), {
      [`training_groups.${group.id}`]: group?.name || 'Treening'
    });
    queryClient.invalidateQueries({ queryKey: ['user'] });
  };

  const updatePublicAttendance = async (groupId, slotId, updater) => {
    setPublicAction((prev) => ({ ...prev, [`${groupId}-${slotId}`]: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error('Gruppi ei leitud');
        const groupData = snap.data();
        const currentWeek = getWeekKey();
        const weekData = groupData.attendance?.[currentWeek] || {};
        const slotData = weekData[slotId] || {
          released_uids: [],
          claimed_uids: [],
          waitlist_uids: [],
          waitlist_meta: {},
          request_uids: [],
          request_meta: {}
        };
        const nextSlotData = updater(slotData, groupData, currentWeek);
        weekData[slotId] = nextSlotData;
        transaction.update(groupRef, {
          [`attendance.${currentWeek}`]: weekData
        });
      });
      queryClient.invalidateQueries({ queryKey: ['training-public-groups'] });
    } catch (error) {
      toast.error(error?.message || 'Uuendus ebaõnnestus');
    } finally {
      setPublicAction((prev) => ({ ...prev, [`${groupId}-${slotId}`]: false }));
    }
  };

  const handlePublicClaim = async (group, slot) => {
    if (!user?.id) return;
    await ensureGroupMember(group);
    const displayName = user?.display_name || user?.full_name || user?.email || 'Trenniline';
    const userEmail = user?.email || '';
    await updatePublicAttendance(group.id, slot.id, (slotData, groupData, currentWeek) => {
      const availability = getSlotAvailability(slot, groupData, currentWeek);
      if (availability.available <= 0) {
        throw new Error('Vabu kohti pole');
      }
      const requests = new Set(slotData.request_uids || []);
      requests.add(user.id);
      const waitlist = (slotData.waitlist_uids || []).filter((uid) => uid !== user.id);
      const waitlistMeta = { ...(slotData.waitlist_meta || {}) };
      delete waitlistMeta[user.id];
      return {
        ...slotData,
        request_uids: Array.from(requests),
        request_meta: {
          ...(slotData.request_meta || {}),
          [user.id]: {
            name: displayName,
            email: userEmail,
            type: 'roster',
            requested_at: new Date().toISOString()
          }
        },
        waitlist_uids: waitlist,
        waitlist_meta: waitlistMeta
      };
    });
  };

  const handlePublicWaitlist = async (group, slot) => {
    if (!user?.id) return;
    await ensureGroupMember(group);
    const displayName = user?.display_name || user?.full_name || user?.email || 'Trenniline';
    const userEmail = user?.email || '';
    await updatePublicAttendance(group.id, slot.id, (slotData) => {
      const waitlist = new Set(slotData.waitlist_uids || []);
      waitlist.add(user.id);
      return {
        ...slotData,
        waitlist_uids: Array.from(waitlist),
        waitlist_meta: {
          ...(slotData.waitlist_meta || {}),
          [user.id]: {
            name: displayName,
            email: userEmail,
            type: 'roster',
            joined_at: new Date().toISOString()
          }
        }
      };
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
      <div className="max-w-xl mx-auto pt-6 pb-12">
        <div className="mb-6">
          <BackButton fallbackTo={createPageUrl('Home')} forceFallback />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Liitu trenniga</h1>
          <p className="text-slate-500">Sisesta treeneri PIN, et liituda grupiga.</p>
        </div>

        {trainingGroupEntries.length > 0 && (
          <div className="mb-6 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-semibold text-slate-500 uppercase">Sinu trennid</div>
              <button
                type="button"
                onClick={() => setShowJoinForm((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-black dark:border-white/10 dark:text-emerald-300"
              >
                <Plus className="w-3 h-3" />
                {showJoinForm ? 'Peida PIN' : 'Lisa uus PIN'}
              </button>
            </div>
            <div className="space-y-2">
              {trainingGroupEntries.map((group) => (
                <div
                  key={group.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-black dark:text-emerald-300 dark:border dark:border-white/10"
                >
                  <div className="inline-flex items-center gap-2">
                    <GraduationCap className="w-3 h-3" />
                    {group.name}
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoadingGroupDetails && !trainingGroupDetails[group.id] ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        Laen...
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`${createPageUrl('TrainerGroupDashboard')}?id=${group.id}`)}
                        disabled={!isPrivileged && !confirmedByGroup[group.id]}
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-semibold',
                          !isPrivileged && !confirmedByGroup[group.id]
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-emerald-600 hover:text-emerald-700'
                        )}
                      >
                        {(!isPrivileged && !confirmedByGroup[group.id]) ? 'Ootab kinnitust' : 'Ava trenn'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLeaveGroup(group.id, group.name)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-600"
                    >
                      <LogOut className="w-3 h-3" />
                      Lahku
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(trainingGroupEntries.length === 0 || showJoinForm) && (
          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm space-y-4 dark:bg-black dark:border-white/10">
            {trainingGroupEntries.length > 0 && (
              <div className="text-xs font-semibold text-slate-500 uppercase">Lisa uus trenn</div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">PIN</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                disabled={Boolean(pendingGroup)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
              />
            </div>
            {!pendingGroup && (
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {isJoining ? 'Liitun...' : 'Liitu trenniga'}
              </button>
            )}

            {pendingGroup && (
              <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm space-y-3 dark:bg-black dark:border-white/10">
                <div className="text-xs font-semibold text-slate-500 uppercase">Vali trenn</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pendingSlots.map((slot) => {
                    const maxSpots = Number(slot?.max_spots || 0);
                    const rosterCount = Array.isArray(slot?.roster_uids) ? slot.roster_uids.length : 0;
                    const isFull = maxSpots > 0 && rosterCount >= maxSpots;
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        disabled={isFull}
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-left text-xs font-semibold transition',
                          isSelected
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-700',
                          isFull && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="text-sm font-semibold">
                          {getDayFullLabel(slot.day)} • {slot.time}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Püsikohti: {rosterCount}/{maxSpots || '-'}
                        </div>
                        {isFull && (
                          <div className="text-[11px] text-amber-600 mt-1">Täis</div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmJoin(false)}
                    disabled={isJoining || !selectedSlotId}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {isJoining ? 'Liitun...' : 'Liitu valitud trenniga'}
                  </button>
                  {pendingSlots.every((slot) => {
                    const maxSpots = Number(slot?.max_spots || 0);
                    const rosterCount = Array.isArray(slot?.roster_uids) ? slot.roster_uids.length : 0;
                    return maxSpots > 0 && rosterCount >= maxSpots;
                  }) && (
                    <button
                      type="button"
                      onClick={() => handleConfirmJoin(true)}
                      disabled={isJoining}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      Liitu ilma kohata
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetPendingJoin}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                  >
                    Muuda PIN
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {groupIds.length > 0 && (
          <div className="mt-8">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Aktiivsed trennimängud</h2>
              <p className="text-xs text-slate-500">Kliki, et liituda otse PIN-i sisestamata.</p>
            </div>
            {isLoadingGames ? (
              <div className="text-sm text-slate-500">Laen mänge...</div>
            ) : trainingGames.length === 0 ? (
              <div className="rounded-2xl border border-white/70 bg-white/70 p-4 text-sm text-slate-500 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
                Hetkel aktiivseid trennimänge pole.
              </div>
            ) : (
              <div className="space-y-3">
                {trainingGames.map((game) => {
                  const format = GAME_FORMATS[game.game_type] || {};
                  const groupName = trainingGroupNames?.[game.training_group_id] || 'Treening';
                  const playerCount = getPlayerCount(game);
                  return (
                    <div
                      key={game.id}
                      className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 dark:bg-black dark:border-white/10"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{game.name}</div>
                        <div className="text-xs text-slate-500">
                          {groupName} · {format.name || game.game_type}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          <Users className="w-3 h-3" />
                          {playerCount} {playerCount === 1 ? 'mängija' : 'mängijat'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-black dark:text-slate-300 dark:border dark:border-white/10">
                          PIN: {game.pin}
                        </span>
                        <button
                          type="button"
                          onClick={() => joinTrainingGame(game)}
                          disabled={joiningGameId === game.id}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {joiningGameId === game.id ? 'Liitun...' : 'Liitu'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {publicSlots.length > 0 && (
          <div className="mt-10">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Vabad trennid</h2>
              <p className="text-xs text-slate-500">
                Avalikud vabad kohad treenerite trennides.
              </p>
            </div>
            <div className="space-y-3">
              {publicSlots.map(({ group, slot }) => {
                const availability = getSlotAvailability(slot, group, weekKey);
                const isClaimed = availability.claimed.includes(user?.id);
                const isWaitlisted = availability.waitlist.includes(user?.id);
                const isRequested = availability.requests.includes(user?.id);
                const actionKey = `${group.id}-${slot.id}`;
                const dayLabel = getDayFullLabel(slot.day);
                const trainerLabel = group?.trainer_name || group?.created_by || 'Treener';
                return (
                  <div
                    key={`${group.id}-${slot.id}`}
                    className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 dark:bg-black dark:border-white/10"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {dayLabel} • {slot.time}
                      </div>
                      <div className="text-xs text-slate-500">
                        {trainerLabel} · {group?.name || 'Treening'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Vabu kohti: {availability.available} · Ootelist: {availability.waitlist.length}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {availability.available > 0 && !isClaimed && !isRequested && (
                        <button
                          type="button"
                          onClick={() => handlePublicClaim(group, slot)}
                          disabled={publicAction[actionKey]}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {publicAction[actionKey] ? 'Saadan...' : 'Broneeri koht'}
                        </button>
                      )}
                      {isRequested && (
                        <span className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
                          Ootab kinnitust
                        </span>
                      )}
                      {isClaimed && (
                        <span className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Koht broneeritud
                        </span>
                      )}
                      {availability.available === 0 && !isRequested && (
                        <button
                          type="button"
                          onClick={() => handlePublicWaitlist(group, slot)}
                          disabled={publicAction[actionKey] || isWaitlisted}
                          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-200"
                        >
                          {isWaitlisted ? 'Ootelistus' : 'Ootelist'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
