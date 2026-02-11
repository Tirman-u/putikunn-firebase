import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Trophy, Users, Activity, Pencil, Trash2, Check, X, Plus, Megaphone, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, runTransaction, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { createPageUrl } from '@/utils';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { toast } from 'sonner';
import {
  TRAINING_DAYS,
  getDayFullLabel,
  getSlotAvailability,
  getWeekKey,
  createSlotId
} from '@/lib/training-utils';

const getGamePlayers = (game) => {
  if (!game) return [];
  if (Array.isArray(game.players)) return game.players;
  return Object.keys(game.total_points || {});
};

const buildTopPlayers = (games) => {
  const bestByPlayer = {};
  games.forEach((game) => {
    getGamePlayers(game).forEach((name) => {
      const score = game.total_points?.[name] ?? 0;
      if (!bestByPlayer[name] || score > bestByPlayer[name]) {
        bestByPlayer[name] = score;
      }
    });
  });
  return Object.entries(bestByPlayer)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
};


export default function TrainerGroupDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const groupId = searchParams.get('id');
  const weekKey = React.useMemo(() => getWeekKey(), []);
  const [announcementDraft, setAnnouncementDraft] = React.useState('');
  const [isSavingAnnouncement, setIsSavingAnnouncement] = React.useState(false);
  const [newSlot, setNewSlot] = React.useState({
    day: 'mon',
    time: '18:00',
    maxSpots: 8,
    price: '',
    duration: 90
  });
  const [editingSlotId, setEditingSlotId] = React.useState(null);
  const [editingSlot, setEditingSlot] = React.useState(null);
  const [isSavingSlot, setIsSavingSlot] = React.useState(false);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = React.useState({});
  const [slotSearch, setSlotSearch] = React.useState({});
  const [addingRoster, setAddingRoster] = React.useState({});
  const [selectedMember, setSelectedMember] = React.useState(null);
  const [isAssigningMember, setIsAssigningMember] = React.useState(false);
  const [collapsedSlots, setCollapsedSlots] = React.useState({});
  const defaultCollapsed = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  }, []);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const isGroupMember = Boolean(user?.training_groups && groupId && user.training_groups[groupId]);
  const canViewGroup = canManageTraining || isGroupMember;

  React.useEffect(() => {
    if (user && !canViewGroup) {
      navigate(createPageUrl('Home'));
    }
  }, [user, canViewGroup, navigate]);

  const { data: group } = useQuery({
    queryKey: ['training-group', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'training_groups', groupId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    staleTime: 30000
  });

  React.useEffect(() => {
    if (group?.announcement) {
      setAnnouncementDraft(group.announcement);
    }
  }, [group?.announcement]);

  const { data: games = [] } = useQuery({
    queryKey: ['training-group-games', groupId],
    enabled: !!groupId,
    queryFn: async () =>
      base44.entities.Game.filter({ training_group_id: groupId }, '-date', 50),
    staleTime: 20000
  });

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['all-users'],
    enabled: canManageTraining,
    queryFn: () => base44.entities.User.list(),
    staleTime: 120000
  });
  const searchableUsers = React.useMemo(
    () => allUsers.filter((entry) => !entry.merged_into),
    [allUsers]
  );

  const activeGames = React.useMemo(
    () =>
      games.filter(
        (game) =>
          game?.status &&
          ['setup', 'active'].includes(game.status) &&
          game.pin !== '0000' &&
          game.join_closed !== true
      ),
    [games]
  );

  const recentGames = React.useMemo(() => games.slice(0, 10), [games]);

  const membersCount = Object.keys(group?.members || {}).length;
  const uniquePlayers = React.useMemo(() => {
    const set = new Set();
    games.forEach((game) => {
      getGamePlayers(game).forEach((name) => set.add(name));
    });
    return set.size;
  }, [games]);

  const topPlayers = React.useMemo(() => buildTopPlayers(games), [games]);

  if (user && !canViewGroup) {
    return null;
  }

  if (!groupId) {
    return null;
  }

  const slots = Array.isArray(group?.slots) ? group.slots : [];

  React.useEffect(() => {
    if (!slots.length) return;
    setCollapsedSlots((prev) => {
      const next = { ...prev };
      slots.forEach((slot) => {
        if (next[slot.id] === undefined) {
          next[slot.id] = defaultCollapsed;
        }
      });
      return next;
    });
  }, [slots, defaultCollapsed]);

  const toggleSlotCollapse = React.useCallback((slotId) => {
    setCollapsedSlots((prev) => ({
      ...prev,
      [slotId]: !prev[slotId]
    }));
  }, []);
  const attendanceBySlot = (slot) => getSlotAvailability(slot, group, weekKey);
  const normalizeSlotData = (slotData = {}) => ({
    ...slotData,
    released_uids: Array.isArray(slotData.released_uids) ? slotData.released_uids : [],
    claimed_uids: Array.isArray(slotData.claimed_uids) ? slotData.claimed_uids : [],
    claimed_meta: slotData.claimed_meta || {},
    waitlist_uids: Array.isArray(slotData.waitlist_uids) ? slotData.waitlist_uids : [],
    waitlist_meta: slotData.waitlist_meta || {},
    request_uids: Array.isArray(slotData.request_uids) ? slotData.request_uids : [],
    request_meta: slotData.request_meta || {}
  });
  const memberRosterSlots = slots.filter((slot) =>
    Array.isArray(slot?.roster_uids) && slot.roster_uids.includes(user?.id)
  );
  const memberClaimedSlots = slots.filter((slot) =>
    (group?.attendance?.[weekKey]?.[slot.id]?.claimed_uids || []).includes(user?.id)
  );
  const hasConfirmedSpot = canManageTraining || memberRosterSlots.length > 0 || memberClaimedSlots.length > 0;
  const hasActiveSwap = memberClaimedSlots.length > 0;
  const memberRosterSlotIds = memberRosterSlots.map((slot) => slot.id);
  const getMemberLabel = React.useCallback(
    (uid, meta = null) =>
      meta?.name || group?.members?.[uid]?.name || group?.members?.[uid]?.email || meta?.email || uid,
    [group]
  );
  const handleSelectMember = React.useCallback((uid, sourceSlotId = null) => {
    setSelectedMember((prev) => {
      if (prev?.uid === uid && prev?.sourceSlotId === sourceSlotId) {
        return null;
      }
      return { uid, sourceSlotId };
    });
  }, []);
  const memberIds = React.useMemo(() => {
    if (group?.member_uids?.length) return group.member_uids;
    return Object.keys(group?.members || {});
  }, [group?.member_uids, group?.members]);
  const rosterUidSet = React.useMemo(() => {
    const set = new Set();
    slots.forEach((slot) => {
      (slot?.roster_uids || []).forEach((uid) => set.add(uid));
    });
    return set;
  }, [slots]);
  const unassignedMembers = React.useMemo(
    () =>
      memberIds
        .filter((uid) => !rosterUidSet.has(uid))
        .map((uid) => ({ uid, ...((group?.members || {})[uid] || {}) })),
    [memberIds, rosterUidSet, group?.members]
  );

  const updateGroupSlots = async (nextSlots) => {
    if (!groupId) return;
    setIsSavingSlot(true);
    try {
      const hasPublic = nextSlots.some((slot) => slot.is_public);
      await updateDoc(doc(db, 'training_groups', groupId), {
        slots: nextSlots,
        has_public_slots: hasPublic
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleAddSlot = async () => {
    if (!newSlot.day || !newSlot.time || Number(newSlot.maxSpots) < 1) return;
    const nextSlots = [
      ...slots,
      {
        id: createSlotId(),
        day: newSlot.day,
        time: newSlot.time,
        max_spots: Number(newSlot.maxSpots),
        duration_minutes: Number(newSlot.duration) || 90,
        price: newSlot.price,
        is_public: false,
        roster_uids: []
      }
    ];
    await updateGroupSlots(nextSlots);
    setNewSlot((prev) => ({
      ...prev,
      time: prev.time,
      price: prev.price
    }));
  };

  const startEditingSlot = (slot) => {
    setEditingSlotId(slot.id);
    setEditingSlot({
      ...slot,
      max_spots: slot.max_spots,
      duration_minutes: slot.duration_minutes || 90,
      price: slot.price || ''
    });
  };

  const cancelEditingSlot = () => {
    setEditingSlotId(null);
    setEditingSlot(null);
  };

  const handleSaveSlot = async () => {
    if (!editingSlotId || !editingSlot) return;
    const nextSlots = slots.map((slot) =>
      slot.id === editingSlotId
        ? {
            ...slot,
            day: editingSlot.day,
            time: editingSlot.time,
            max_spots: Number(editingSlot.max_spots) || 1,
            duration_minutes: Number(editingSlot.duration_minutes) || 90,
            price: editingSlot.price || '',
            is_public: Boolean(editingSlot.is_public)
          }
        : slot
    );
    await updateGroupSlots(nextSlots);
    cancelEditingSlot();
  };

  const handleDeleteSlot = async (slotId) => {
    if (!confirm('Kustuta see trenniaeg?')) return;
    const nextSlots = slots.filter((slot) => slot.id !== slotId);
    await updateGroupSlots(nextSlots);
  };

  const handleTogglePublicSlot = async (slotId) => {
    const nextSlots = slots.map((slot) =>
      slot.id === slotId ? { ...slot, is_public: !slot.is_public } : slot
    );
    await updateGroupSlots(nextSlots);
  };

  const updateAttendance = async (slotId, updater) => {
    if (!groupId) return;
    setIsUpdatingAttendance((prev) => ({ ...prev, [slotId]: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error('Gruppi ei leitud');
        const data = snap.data();
        const currentWeek = getWeekKey();
        const weekData = data.attendance?.[currentWeek] || {};
        const slotData = normalizeSlotData(weekData[slotId]);
        const nextSlotData = updater(slotData, data, currentWeek);
        weekData[slotId] = nextSlotData;
        transaction.update(groupRef, {
          [`attendance.${currentWeek}`]: weekData
        });
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } catch (error) {
      toast.error(error?.message || 'Uuendus ebaõnnestus');
    } finally {
      setIsUpdatingAttendance((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const updateAttendanceMulti = async (updater) => {
    if (!groupId) return;
    setIsUpdatingAttendance((prev) => ({ ...prev, global: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error('Gruppi ei leitud');
        const data = snap.data();
        const currentWeek = getWeekKey();
        const weekData = { ...(data.attendance?.[currentWeek] || {}) };
        const nextWeekData = updater(weekData, data, currentWeek);
        transaction.update(groupRef, {
          [`attendance.${currentWeek}`]: nextWeekData
        });
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } catch (error) {
      toast.error(error?.message || 'Uuendus ebaõnnestus');
    } finally {
      setIsUpdatingAttendance((prev) => ({ ...prev, global: false }));
    }
  };

  const handleToggleRelease = async (slotId) => {
    const userId = user?.id;
    if (!userId) return;
    await updateAttendanceMulti((weekData) => {
      const slotData = normalizeSlotData(weekData[slotId]);
      const released = new Set(slotData.released_uids || []);
      const wasReleased = released.has(userId);
      if (wasReleased) {
        released.delete(userId);
      } else {
        released.add(userId);
      }
      weekData[slotId] = {
        ...slotData,
        released_uids: Array.from(released)
      };
      if (wasReleased) {
        Object.keys(weekData).forEach((otherId) => {
          const otherData = normalizeSlotData(weekData[otherId]);
          if (!otherData.claimed_uids?.includes(userId)) return;
          weekData[otherId] = {
            ...otherData,
            claimed_uids: otherData.claimed_uids.filter((uid) => uid !== userId),
            claimed_meta: { ...(otherData.claimed_meta || {}) }
          };
          if (weekData[otherId].claimed_meta?.[userId]) {
            delete weekData[otherId].claimed_meta[userId];
          }
        });
      }
      return weekData;
    });
  };

  const handleRequestSpot = async (slotId, requestType = 'claim') => {
    const userId = user?.id;
    if (!userId) return;
    const userName = user?.display_name || user?.full_name || user?.email || 'Trenniline';
    const userEmail = user?.email || '';
    await updateAttendance(slotId, (slotData) => {
      const requests = new Set(slotData.request_uids || []);
      requests.add(userId);
      const waitlist = (slotData.waitlist_uids || []).filter((uid) => uid !== userId);
      const waitlistMeta = { ...(slotData.waitlist_meta || {}) };
      delete waitlistMeta[userId];
      return {
        ...slotData,
        request_uids: Array.from(requests),
        request_meta: {
          ...(slotData.request_meta || {}),
          [userId]: {
            name: userName,
            email: userEmail,
            type: requestType,
            requested_at: new Date().toISOString()
          }
        },
        waitlist_uids: waitlist,
        waitlist_meta: waitlistMeta
      };
    });
  };

  const handleRequestRoster = async (slotId) => {
    await handleRequestSpot(slotId, 'roster');
  };

  const handleLeaveClaimedSpot = async (slotId) => {
    const userId = user?.id;
    if (!userId) return;
    await updateAttendance(slotId, (slotData) => {
      const claimed = (slotData.claimed_uids || []).filter((uid) => uid !== userId);
      return { ...slotData, claimed_uids: claimed };
    });
  };

  const handleJoinWaitlist = async (slotId) => {
    const userId = user?.id;
    if (!userId) return;
    const userName = user?.display_name || user?.full_name || user?.email || 'Trenniline';
    const userEmail = user?.email || '';
    await updateAttendance(slotId, (slotData) => {
      const waitlist = new Set(slotData.waitlist_uids || []);
      waitlist.add(userId);
      return {
        ...slotData,
        waitlist_uids: Array.from(waitlist),
        waitlist_meta: {
          ...(slotData.waitlist_meta || {}),
          [userId]: {
            name: userName,
            email: userEmail,
            joined_at: new Date().toISOString()
          }
        }
      };
    });
  };

  const handleApproveWaitlist = async (slotId, targetUid) => {
    let approvedMeta = null;
    let approvedType = 'claim';
    await updateAttendance(slotId, (slotData, groupData, currentWeek) => {
      const slot = (groupData.slots || []).find((s) => s.id === slotId);
      const availability = getSlotAvailability(slot, groupData, currentWeek);
      if (availability.available <= 0) {
        throw new Error('Vabu kohti pole');
      }
      const waitlist = (slotData.waitlist_uids || []).filter((uid) => uid !== targetUid);
      const waitlistMeta = { ...(slotData.waitlist_meta || {}) };
      approvedMeta = waitlistMeta[targetUid] || null;
      approvedType = approvedMeta?.type || 'claim';
      delete waitlistMeta[targetUid];

      if (approvedType === 'roster') {
        const maxSpots = Number(slot?.max_spots || 0);
        const rosterCount = Array.isArray(slot?.roster_uids) ? slot.roster_uids.length : 0;
        if (rosterCount >= maxSpots) {
          throw new Error('Püsikohti pole');
        }
        return {
          ...slotData,
          waitlist_uids: waitlist,
          waitlist_meta: waitlistMeta
        };
      }

      const claimed = new Set(slotData.claimed_uids || []);
      claimed.add(targetUid);
      const claimedMeta = {
        ...(slotData.claimed_meta || {}),
        ...(approvedMeta ? { [targetUid]: approvedMeta } : {})
      };
      return {
        ...slotData,
        claimed_uids: Array.from(claimed),
        claimed_meta: claimedMeta,
        waitlist_uids: waitlist,
        waitlist_meta: waitlistMeta
      };
    });
    if (approvedMeta) {
      if (approvedType === 'roster') {
        await addUserToRoster(slotId, targetUid);
      }
      await addUserToGroupMembers(targetUid, approvedMeta);
    }
  };

  const handleApproveRequest = async (slotId, targetUid) => {
    let approvedMeta = null;
    let approvedType = 'claim';
    await updateAttendance(slotId, (slotData, groupData, currentWeek) => {
      const slot = (groupData.slots || []).find((s) => s.id === slotId);
      const availability = getSlotAvailability(slot, groupData, currentWeek);
      if (availability.available <= 0) {
        throw new Error('Vabu kohti pole');
      }
      const requests = (slotData.request_uids || []).filter((uid) => uid !== targetUid);
      const requestMeta = { ...(slotData.request_meta || {}) };
      approvedMeta = requestMeta[targetUid] || null;
      approvedType = approvedMeta?.type || 'claim';
      delete requestMeta[targetUid];
      if (approvedType === 'roster') {
        const maxSpots = Number(slot?.max_spots || 0);
        const rosterCount = Array.isArray(slot?.roster_uids) ? slot.roster_uids.length : 0;
        if (rosterCount >= maxSpots) {
          throw new Error('Püsikohti pole');
        }
        return {
          ...slotData,
          request_uids: requests,
          request_meta: requestMeta
        };
      }
      const claimed = new Set(slotData.claimed_uids || []);
      claimed.add(targetUid);
      const claimedMeta = {
        ...(slotData.claimed_meta || {}),
        ...(approvedMeta ? { [targetUid]: approvedMeta } : {})
      };
      return {
        ...slotData,
        claimed_uids: Array.from(claimed),
        claimed_meta: claimedMeta,
        request_uids: requests,
        request_meta: requestMeta
      };
    });
    if (approvedMeta) {
      if (approvedType === 'roster') {
        await addUserToRoster(slotId, targetUid);
      }
      await addUserToGroupMembers(targetUid, approvedMeta);
    }
  };

  const handleRejectRequest = async (slotId, targetUid) => {
    await updateAttendance(slotId, (slotData) => {
      const requests = (slotData.request_uids || []).filter((uid) => uid !== targetUid);
      const requestMeta = { ...(slotData.request_meta || {}) };
      delete requestMeta[targetUid];
      return {
        ...slotData,
        request_uids: requests,
        request_meta: requestMeta
      };
    });
  };

  const handleRequestToWaitlist = async (slotId, targetUid, meta) => {
    await updateAttendance(slotId, (slotData) => {
      const requests = (slotData.request_uids || []).filter((uid) => uid !== targetUid);
      const requestMeta = { ...(slotData.request_meta || {}) };
      delete requestMeta[targetUid];
      const waitlist = new Set(slotData.waitlist_uids || []);
      waitlist.add(targetUid);
      return {
        ...slotData,
        request_uids: requests,
        request_meta: requestMeta,
        waitlist_uids: Array.from(waitlist),
        waitlist_meta: {
          ...(slotData.waitlist_meta || {}),
          [targetUid]: meta || {
            name: targetUid,
            email: '',
            joined_at: new Date().toISOString()
          }
        }
      };
    });
  };

  const addUserToGroupMembers = async (uid, meta) => {
    if (!groupId || !uid) return;
    try {
      const memberName = meta?.name || meta?.email || uid;
      await updateDoc(doc(db, 'training_groups', groupId), {
        member_uids: arrayUnion(uid),
        [`members.${uid}`]: {
          name: memberName,
          email: meta?.email || '',
          joined_at: serverTimestamp()
        }
      });
      await updateDoc(doc(db, 'users', uid), {
        [`training_groups.${groupId}`]: group?.name || 'Treening'
      });
    } catch (error) {
      toast.error(error?.message || 'Liikme lisamine ebaõnnestus');
    }
  };

  const handleAddMember = async (entry) => {
    if (!entry?.id) return;
    if (addingMemberId) return;
    const alreadyMember = group?.members?.[entry.id] || group?.member_uids?.includes(entry.id);
    if (alreadyMember) return;
    setAddingMemberId(entry.id);
    try {
      const displayName = entry.display_name || entry.full_name || entry.email || entry.id;
      await addUserToGroupMembers(entry.id, { name: displayName, email: entry.email || '' });
      toast.success('Trenniline lisatud');
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } finally {
      setAddingMemberId(null);
    }
  };

  const addUserToRoster = async (slotId, uid) => {
    if (!groupId || !slotId || !uid) return;
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error('Gruppi ei leitud');
        const data = snap.data();
        const currentSlots = Array.isArray(data.slots) ? data.slots : [];
        const nextSlots = currentSlots.map((slot) => {
          if (slot.id !== slotId) return slot;
          const roster = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
          if (roster.includes(uid)) return slot;
          const maxSpots = Number(slot.max_spots || 0);
          if (roster.length >= maxSpots) {
            throw new Error('Püsikohad täis');
          }
          return { ...slot, roster_uids: [...roster, uid] };
        });
        transaction.update(groupRef, { slots: nextSlots });
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } catch (error) {
      toast.error(error?.message || 'Püsikoha kinnitamine ebaõnnestus');
    }
  };

  const moveRosterMember = async (sourceSlotId, targetSlotId, uid) => {
    if (!groupId || !sourceSlotId || !targetSlotId || !uid) return;
    if (sourceSlotId === targetSlotId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error('Gruppi ei leitud');
        const data = snap.data();
        const currentSlots = Array.isArray(data.slots) ? data.slots : [];
        const targetSlot = currentSlots.find((slot) => slot.id === targetSlotId);
        if (!targetSlot) throw new Error('Trenni ei leitud');
        const targetRoster = Array.isArray(targetSlot.roster_uids) ? targetSlot.roster_uids : [];
        const targetMax = Number(targetSlot.max_spots || 0);
        if (targetMax > 0 && targetRoster.length >= targetMax) {
          throw new Error('Püsikohad täis');
        }
        const nextSlots = currentSlots.map((slot) => {
          if (slot.id === sourceSlotId) {
            const roster = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
            return { ...slot, roster_uids: roster.filter((memberId) => memberId !== uid) };
          }
          if (slot.id === targetSlotId) {
            const roster = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
            if (roster.includes(uid)) return slot;
            return { ...slot, roster_uids: [...roster, uid] };
          }
          return slot;
        });
        transaction.update(groupRef, { slots: nextSlots });
      });
      await updateAttendance(sourceSlotId, (slotData) => {
        const released = (slotData.released_uids || []).filter((memberId) => memberId !== uid);
        return { ...slotData, released_uids: released };
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } catch (error) {
      toast.error(error?.message || 'Liigutamine ebaõnnestus');
    }
  };

  const handleAssignSelected = async (targetSlotId) => {
    if (!selectedMember?.uid || !targetSlotId) return;
    setIsAssigningMember(true);
    try {
      if (selectedMember.sourceSlotId) {
        await moveRosterMember(selectedMember.sourceSlotId, targetSlotId, selectedMember.uid);
      } else {
        await addUserToRoster(targetSlotId, selectedMember.uid);
      }
      setSelectedMember(null);
    } finally {
      setIsAssigningMember(false);
    }
  };

  const handleAddRosterMember = async (slotId, entry) => {
    if (!entry?.id || !groupId) return;
    const slot = slots.find((item) => item.id === slotId);
    if (!slot) return;
    const roster = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
    const maxSpots = Number(slot.max_spots || 0);
    if (roster.includes(entry.id)) return;
    if (roster.length >= maxSpots) {
      toast.error('Püsikohad täis');
      return;
    }
    setAddingRoster((prev) => ({ ...prev, [slotId]: entry.id }));
    try {
      const displayName = entry.display_name || entry.full_name || entry.email || entry.id;
      await addUserToGroupMembers(entry.id, { name: displayName, email: entry.email || '' });
      await addUserToRoster(slotId, entry.id);
      setSlotSearch((prev) => ({ ...prev, [slotId]: '' }));
      toast.success('Trenniline lisatud');
    } finally {
      setAddingRoster((prev) => ({ ...prev, [slotId]: null }));
    }
  };

  const handleSwapClaim = async (targetSlotId) => {
    const userId = user?.id;
    if (!userId) return;
    const userName = user?.display_name || user?.full_name || user?.email || 'Trenniline';
    const userEmail = user?.email || '';
    await updateAttendanceMulti((weekData, groupData, currentWeek) => {
      const slotsList = Array.isArray(groupData.slots) ? groupData.slots : [];
      const targetSlot = slotsList.find((slot) => slot.id === targetSlotId);
      if (!targetSlot) return weekData;
      const availability = getSlotAvailability(targetSlot, groupData, currentWeek);
      if (availability.available <= 0) {
        throw new Error('Vabu kohti pole');
      }

      const rosterSlotIds = slotsList
        .filter((slot) => Array.isArray(slot.roster_uids) && slot.roster_uids.includes(userId))
        .map((slot) => slot.id);
      if (rosterSlotIds.length === 0) {
        throw new Error('Sul pole püsikohta');
      }

      Object.keys(weekData).forEach((slotId) => {
        const slotData = normalizeSlotData(weekData[slotId]);
        const nextClaimed = slotData.claimed_uids.filter((uid) => uid !== userId);
        const nextRequests = slotData.request_uids.filter((uid) => uid !== userId);
        const nextWaitlist = slotData.waitlist_uids.filter((uid) => uid !== userId);
        const nextClaimedMeta = { ...(slotData.claimed_meta || {}) };
        if (nextClaimedMeta?.[userId]) {
          delete nextClaimedMeta[userId];
        }
        const nextRequestMeta = { ...(slotData.request_meta || {}) };
        if (nextRequestMeta?.[userId]) {
          delete nextRequestMeta[userId];
        }
        const nextWaitlistMeta = { ...(slotData.waitlist_meta || {}) };
        if (nextWaitlistMeta?.[userId]) {
          delete nextWaitlistMeta[userId];
        }
        weekData[slotId] = {
          ...slotData,
          claimed_uids: nextClaimed,
          claimed_meta: nextClaimedMeta,
          request_uids: nextRequests,
          request_meta: nextRequestMeta,
          waitlist_uids: nextWaitlist,
          waitlist_meta: nextWaitlistMeta
        };
      });

      rosterSlotIds.forEach((slotId) => {
        const slotData = normalizeSlotData(weekData[slotId]);
        const released = new Set(slotData.released_uids || []);
        released.add(userId);
        weekData[slotId] = {
          ...slotData,
          released_uids: Array.from(released)
        };
      });

      const targetData = normalizeSlotData(weekData[targetSlotId]);
      const claimed = new Set(targetData.claimed_uids || []);
      claimed.add(userId);
      weekData[targetSlotId] = {
        ...targetData,
        claimed_uids: Array.from(claimed),
        claimed_meta: {
          ...(targetData.claimed_meta || {}),
          [userId]: {
            name: userName,
            email: userEmail,
            type: 'swap',
            claimed_at: new Date().toISOString()
          }
        }
      };

      return weekData;
    });
  };

  const handleRemoveWaitlist = async (slotId, targetUid) => {
    await updateAttendance(slotId, (slotData) => {
      const waitlist = (slotData.waitlist_uids || []).filter((uid) => uid !== targetUid);
      const waitlistMeta = { ...(slotData.waitlist_meta || {}) };
      delete waitlistMeta[targetUid];
      return {
        ...slotData,
        waitlist_uids: waitlist,
        waitlist_meta: waitlistMeta
      };
    });
  };

  const handleRemoveRosterMember = async (slotId, targetUid) => {
    if (!confirm('Eemalda püsikohalt?')) return;
    const nextSlots = slots.map((slot) => {
      if (slot.id !== slotId) return slot;
      const roster = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
      return { ...slot, roster_uids: roster.filter((uid) => uid !== targetUid) };
    });
    await updateGroupSlots(nextSlots);
    await updateAttendance(slotId, (slotData) => {
      const released = (slotData.released_uids || []).filter((uid) => uid !== targetUid);
      return { ...slotData, released_uids: released };
    });
  };

  const handleRemoveClaimedMember = async (slotId, targetUid) => {
    await updateAttendanceMulti((weekData, groupData) => {
      const slotsList = Array.isArray(groupData.slots) ? groupData.slots : [];
      const rosterSlotIds = slotsList
        .filter((slot) => Array.isArray(slot.roster_uids) && slot.roster_uids.includes(targetUid))
        .map((slot) => slot.id);
      const nextWeek = { ...weekData };

      const slotData = normalizeSlotData(nextWeek[slotId]);
      const claimed = slotData.claimed_uids.filter((uid) => uid !== targetUid);
      const claimedMeta = { ...(slotData.claimed_meta || {}) };
      delete claimedMeta[targetUid];
      nextWeek[slotId] = {
        ...slotData,
        claimed_uids: claimed,
        claimed_meta: claimedMeta
      };

      rosterSlotIds.forEach((rosterSlotId) => {
        const rosterData = normalizeSlotData(nextWeek[rosterSlotId]);
        const released = rosterData.released_uids.filter((uid) => uid !== targetUid);
        if (released.length !== rosterData.released_uids.length) {
          nextWeek[rosterSlotId] = {
            ...rosterData,
            released_uids: released
          };
        }
      });

      return nextWeek;
    });
  };


  const handleSaveAnnouncement = async () => {
    if (!groupId) return;
    setIsSavingAnnouncement(true);
    try {
      await updateDoc(doc(db, 'training_groups', groupId), {
        announcement: announcementDraft || '',
        announcement_updated_at: serverTimestamp()
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
      toast.success('Teade salvestatud');
    } catch (error) {
      toast.error(error?.message || 'Teate salvestamine ebaõnnestus');
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_rgba(255,255,255,1)_55%)] px-4 pb-12 dark:bg-black dark:text-slate-100">
      <div className="max-w-5xl mx-auto pt-6">
        <div className="mb-6 flex items-center gap-2">
          <BackButton
            fallbackTo={createPageUrl(canManageTraining ? 'TrainerGroups' : 'JoinTraining')}
            forceFallback
          />
          <HomeButton />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">{group?.name || 'Treening'}</h1>
          <p className="text-sm text-slate-500">
            {canManageTraining ? 'Treeneri dashboard' : 'Treeningu vaade'}
          </p>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-8 dark:bg-black dark:border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-emerald-500" />
              Teadete tahvel
            </div>
            {canManageTraining && (
              <button
                type="button"
                onClick={handleSaveAnnouncement}
                disabled={isSavingAnnouncement}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSavingAnnouncement ? 'Salvestan...' : 'Salvesta'}
              </button>
            )}
          </div>
          {canManageTraining ? (
            <textarea
              value={announcementDraft}
              onChange={(event) => setAnnouncementDraft(event.target.value)}
              placeholder="Lisa trennilistele info..."
              className="w-full min-h-[88px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
            />
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-200">
              {group?.announcement?.trim() || 'Teateid pole hetkel.'}
            </div>
          )}
        </div>

        {!canManageTraining && !hasConfirmedSpot && (
          <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-6">
            Ootab kinnitust – treener peab koha kinnitama, enne kui trenn avaneb.
          </div>
        )}

        {(canManageTraining || hasConfirmedSpot) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 uppercase mb-2">Aktiivsed mängud</div>
              <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                <Activity className="w-5 h-5 text-emerald-500" />
                {activeGames.length}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 uppercase mb-2">Kõik mängud</div>
              <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                {games.length}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 uppercase mb-2">Mängijaid kokku</div>
              <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                <Users className="w-5 h-5 text-emerald-500" />
                {uniquePlayers || membersCount}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-8 dark:bg-black dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Treeningu ajad</div>
              <div className="text-xs text-slate-500">
                Kestvus vaikimisi 1.5h • Nädal {weekKey}
              </div>
            </div>
            {canManageTraining && (
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                Kuuluta vaba koht, et see ilmuks “Vabad trennid” nimekirjas.
              </div>
            )}
          </div>

          {slots.length === 0 && (
            <div className="text-sm text-slate-500">Aegu pole veel lisatud.</div>
          )}

          {canManageTraining ? (
            <div className="space-y-3">
              {unassignedMembers.length > 0 && (
                <div className="rounded-[20px] border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Sortimata liikmed</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {unassignedMembers.map((member) => {
                      const isSelected =
                        selectedMember?.uid === member.uid && !selectedMember?.sourceSlotId;
                      return (
                        <button
                          key={`unassigned-${member.uid}`}
                          type="button"
                          onClick={() => handleSelectMember(member.uid, null)}
                          className={`rounded-2xl border border-dashed px-3 py-3 text-xs text-slate-600 shadow-sm text-left transition ${
                            isSelected
                              ? 'border-emerald-300 ring-2 ring-emerald-200'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="text-[10px] uppercase text-slate-400">Sortimata</div>
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {getMemberLabel(member.uid)}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">Vali trenn</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedMember && (
                <div className="rounded-[20px] border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Määra trenn</div>
                  <div className="text-[11px] text-slate-500 mb-3">
                    Valitud: {getMemberLabel(selectedMember.uid)}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {slots.map((slot) => {
                      const rosterCount = Array.isArray(slot.roster_uids) ? slot.roster_uids.length : 0;
                      const maxSpots = Number(slot.max_spots || 0);
                      const isFull = maxSpots > 0 && rosterCount >= maxSpots;
                      const isCurrent = selectedMember?.sourceSlotId === slot.id;
                      return (
                        <button
                          key={`assign-${selectedMember.uid}-${slot.id}`}
                          type="button"
                          disabled={isAssigningMember || isFull || isCurrent}
                          onClick={() => handleAssignSelected(slot.id)}
                          className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${
                            isCurrent
                              ? 'border-slate-200 text-slate-400'
                              : isFull
                                ? 'border-slate-200 text-slate-400'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            {getDayFullLabel(slot.day)} • {slot.time}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Püsikohti: {rosterCount}/{maxSpots || '-'}
                          </div>
                          {isCurrent && (
                            <div className="text-[10px] text-slate-400 mt-1">Praegune</div>
                          )}
                          {isFull && !isCurrent && (
                            <div className="text-[10px] text-amber-600 mt-1">Täis</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Tühista
                    </button>
                  </div>
                </div>
              )}

              {slots.map((slot) => {
              const availability = attendanceBySlot(slot);
              const maxSpots = availability.maxSpots || Number(slot.max_spots) || 0;
              const attendance = group?.attendance?.[weekKey]?.[slot.id] || {};
              const releasedSet = new Set(attendance.released_uids || []);
              const rosterIds = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
              const activeRosterIds = rosterIds.filter((uid) => !releasedSet.has(uid));
              const releasedRosterIds = rosterIds.filter((uid) => releasedSet.has(uid));
              const isRosterMember = rosterIds.includes(user?.id);
              const isReleased = releasedSet.has(user?.id);
              const waitlistEntries = (attendance.waitlist_uids || []).map((uid) => {
                const meta = attendance?.waitlist_meta?.[uid];
                return { uid, ...meta, kind: 'waitlist' };
              });
              const requestEntries = (attendance.request_uids || []).map((uid) => {
                const meta = attendance?.request_meta?.[uid];
                return { uid, ...meta, kind: 'request' };
              });
              const pendingEntries = [...requestEntries, ...waitlistEntries];
              const seatAssignments = [];
              activeRosterIds.slice(0, maxSpots).forEach((uid) => {
                seatAssignments.push({ type: 'roster', uid });
              });
              (attendance.claimed_uids || []).forEach((uid) => {
                if (seatAssignments.length >= maxSpots) return;
                seatAssignments.push({
                  type: 'claim',
                  uid,
                  meta: attendance?.claimed_meta?.[uid] || null
                });
              });
              const remainingSeats = Math.max(0, maxSpots - seatAssignments.length);
              for (let i = 0; i < remainingSeats; i += 1) {
                seatAssignments.push({
                  type: 'free',
                  releasedBy: releasedRosterIds[i] || null
                });
              }
              const slotSearchValue = slotSearch[slot.id] || '';
              const normalizedSlotSearch = slotSearchValue.trim().toLowerCase();
              const slotSearchResults =
                normalizedSlotSearch.length < 2
                  ? []
                  : searchableUsers
                      .filter((entry) => {
                        const haystack = `${entry.display_name || ''} ${entry.full_name || ''} ${entry.email || ''}`.toLowerCase();
                        return haystack.includes(normalizedSlotSearch);
                      })
                      .slice(0, 6);
              const canAnnounce = availability.available > 0;
              const isOwnSlot = memberRosterSlotIds.includes(slot.id);
              const canMemberSwap = !canManageTraining && memberRosterSlots.length > 0 && !hasActiveSwap;
              const isCollapsed = collapsedSlots[slot.id] ?? false;
              const isExpanded = !isCollapsed || editingSlotId === slot.id;

              return (
                <div
                  key={slot.id}
                  className="rounded-2xl border border-slate-100 bg-white px-3 py-3 dark:bg-black dark:border-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSlotCollapse(slot.id)}
                      aria-expanded={isExpanded}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                        />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {getDayFullLabel(slot.day)} • {slot.time}
                        </div>
                        <div className="text-xs text-slate-500">
                          {slot.duration_minutes || 90} min • Max {slot.max_spots} kohta
                        </div>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 font-semibold">
                        Vabu: {availability.available}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 font-semibold">
                        Püsikohti: {availability.roster.length}/{maxSpots}
                      </span>
                      {slot.is_public && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 font-semibold">
                          Avalik
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      {editingSlotId === slot.id && canManageTraining && editingSlot ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <select
                        value={editingSlot.day}
                        onChange={(event) => setEditingSlot((prev) => ({ ...prev, day: event.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                      >
                        {TRAINING_DAYS.map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.full}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={editingSlot.time}
                        onChange={(event) => setEditingSlot((prev) => ({ ...prev, time: event.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                      />
                      <input
                        type="number"
                        min={1}
                        value={editingSlot.max_spots}
                        onChange={(event) => setEditingSlot((prev) => ({ ...prev, max_spots: event.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                        placeholder="Kohti"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveSlot}
                          disabled={isSavingSlot}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white"
                        >
                          <Check className="w-3 h-3" /> Salvesta
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSlot}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700"
                        >
                          <X className="w-3 h-3" /> Tühista
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {canManageTraining ? (
                        <>
                          {slot.is_public ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePublicSlot(slot.id)}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Eemalda kuulutus
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTogglePublicSlot(slot.id)}
                              disabled={!canAnnounce}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Kuuluta vaba koht
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditingSlot(slot)}
                            className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            <Pencil className="w-3 h-3 inline-block mr-1" />
                            Muuda
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="w-3 h-3 inline-block mr-1" />
                            Kustuta
                          </button>
                        </>
                      ) : (
                        <>
                          {isRosterMember && (
                            <button
                              type="button"
                              disabled={isUpdatingAttendance[slot.id]}
                              onClick={() => handleToggleRelease(slot.id)}
                              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700"
                            >
                              {isReleased ? 'Tulen siiski' : 'Täna trenni ei jõua'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                      )}

                  <div className="mt-4">
                    {canManageTraining ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {seatAssignments.map((seat, seatIndex) => {
                          if (seat.type === 'roster') {
                            const label = getMemberLabel(seat.uid);
                            const isSelected =
                              selectedMember?.uid === seat.uid && selectedMember?.sourceSlotId === slot.id;
                            return (
                              <div
                                key={`${slot.id}-roster-${seat.uid}`}
                                className={`rounded-2xl border px-3 py-3 text-xs shadow-sm dark:bg-black dark:border-white/10 ${
                                  isSelected
                                    ? 'border-emerald-300 ring-2 ring-emerald-200 bg-emerald-50/40'
                                    : 'border-slate-200 bg-slate-50'
                                }`}
                              >
                                <div className="text-[10px] uppercase text-slate-400">Püsikoht</div>
                                <div className="text-sm font-semibold text-slate-800 truncate">{label}</div>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectMember(seat.uid, slot.id)}
                                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                                  >
                                    {isSelected ? 'Valitud' : 'Vali'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRosterMember(slot.id, seat.uid)}
                                    className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                                  >
                                    Eemalda
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          if (seat.type === 'claim') {
                            const label = getMemberLabel(seat.uid, seat.meta);
                            return (
                              <div
                                key={`${slot.id}-claim-${seat.uid}-${seatIndex}`}
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700 shadow-sm"
                              >
                                <div className="text-[10px] uppercase text-emerald-500">1x</div>
                                <div className="text-sm font-semibold text-emerald-900 truncate">{label}</div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveClaimedMember(slot.id, seat.uid)}
                                  className="mt-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                                >
                                  Eemalda
                                </button>
                              </div>
                            );
                          }

                          const releasedLabel = seat.releasedBy ? getMemberLabel(seat.releasedBy) : null;
                          return (
                            <div
                              key={`${slot.id}-free-${seatIndex}`}
                              className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-400"
                            >
                              <div className="text-[10px] uppercase text-slate-400">Vaba</div>
                              {releasedLabel && (
                                <div className="text-[10px] text-slate-400 mt-1 truncate">
                                  püsikoht: {releasedLabel}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {seatAssignments.map((seat, seatIndex) => {
                          if (seat.type === 'roster') {
                            const label = getMemberLabel(seat.uid);
                            return (
                              <div
                                key={`${slot.id}-roster-${seat.uid}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 shadow-sm"
                              >
                                <div className="text-[10px] uppercase text-slate-400">Püsikoht</div>
                                <div className="text-sm font-semibold text-slate-800 truncate">{label}</div>
                              </div>
                            );
                          }

                          if (seat.type === 'claim') {
                            const label = getMemberLabel(seat.uid, seat.meta);
                            return (
                              <div
                                key={`${slot.id}-claim-${seat.uid}-${seatIndex}`}
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700 shadow-sm"
                              >
                                <div className="text-[10px] uppercase text-emerald-500">1x</div>
                                <div className="text-sm font-semibold text-emerald-900 truncate">{label}</div>
                              </div>
                            );
                          }

                          const releasedLabel = seat.releasedBy ? getMemberLabel(seat.releasedBy) : null;
                          const canClaimSeat = canMemberSwap && !isOwnSlot;
                          return (
                            <div
                              key={`${slot.id}-free-${seatIndex}`}
                              className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-400 flex flex-col gap-2"
                            >
                              <div className="text-[10px] uppercase text-slate-400">Vaba</div>
                              {releasedLabel && (
                                <div className="text-[10px] text-slate-400 truncate">
                                  püsikoht: {releasedLabel}
                                </div>
                              )}
                              {canClaimSeat && (
                                <button
                                  type="button"
                                  onClick={() => handleSwapClaim(slot.id)}
                                  className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white"
                                >
                                  Asendan koha
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {canManageTraining && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="text-[11px] font-semibold text-slate-500 mb-2">
                          Lisa trenniline siia trenni
                        </div>
                        <input
                          value={slotSearchValue}
                          onChange={(event) =>
                            setSlotSearch((prev) => ({ ...prev, [slot.id]: event.target.value }))
                          }
                          placeholder="Otsi nime või e-posti"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
                        />
                        <div className="mt-2 space-y-2">
                          {normalizedSlotSearch.length > 0 && normalizedSlotSearch.length < 2 && (
                            <div className="text-[11px] text-slate-500">
                              Sisesta vähemalt 2 tähte.
                            </div>
                          )}
                          {normalizedSlotSearch.length >= 2 && isLoadingUsers && (
                            <div className="text-[11px] text-slate-500">Laen kasutajaid...</div>
                          )}
                          {normalizedSlotSearch.length >= 2 && !isLoadingUsers && slotSearchResults.length === 0 && (
                            <div className="text-[11px] text-slate-500">Sobivaid kasutajaid ei leitud.</div>
                          )}
                          {normalizedSlotSearch.length >= 2 &&
                            slotSearchResults.map((entry) => {
                              const displayName = entry.display_name || entry.full_name || entry.email || entry.id;
                              const alreadyInRoster = rosterIds.includes(entry.id);
                              const isAdding = addingRoster[slot.id] === entry.id;
                              return (
                                <div
                                  key={`${slot.id}-${entry.id}`}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-700 dark:bg-black dark:border-white/10"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-800">{displayName}</div>
                                    <div className="text-[11px] text-slate-500">{entry.email || ''}</div>
                                  </div>
                                  {alreadyInRoster ? (
                                    <span className="rounded-full border border-emerald-200 px-3 py-1 text-[10px] font-semibold text-emerald-700">
                                      Juba slotis
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isAdding}
                                      onClick={() => handleAddRosterMember(slot.id, entry)}
                                      className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      {isAdding ? 'Lisan...' : 'Lisa'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {canManageTraining && pendingEntries.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 dark:bg-black dark:border-white/10">
                        <div className="text-xs font-semibold text-slate-500 mb-2">
                          Ootelist ({pendingEntries.length})
                        </div>
                        <div className="space-y-2">
                          {pendingEntries.map((entry) => (
                            <div
                              key={`${entry.kind}-${entry.uid}`}
                              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs text-slate-700 dark:bg-black dark:border dark:border-white/10"
                            >
                              <div>
                                <div className="font-semibold">{entry.name || entry.uid}</div>
                                <div className="text-[11px] text-slate-400">{entry.email || ''}</div>
                                {entry.type === 'roster' && (
                                  <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                                    Püsikoha taotlus
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={availability.available <= 0}
                                  onClick={() =>
                                    entry.kind === 'request'
                                      ? handleApproveRequest(slot.id, entry.uid)
                                      : handleApproveWaitlist(slot.id, entry.uid)
                                  }
                                  className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                                >
                                  Kinnita
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    entry.kind === 'request'
                                      ? handleRejectRequest(slot.id, entry.uid)
                                      : handleRemoveWaitlist(slot.id, entry.uid)
                                  }
                                  className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-600"
                                >
                                  {entry.kind === 'request' ? 'Keeldu' : 'Eemalda'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
                  );
                })}
              </div>
           ) : (
            <div className="space-y-3">
              {slots.map((slot) => {
                const availability = attendanceBySlot(slot);
                const maxSpots = availability.maxSpots || Number(slot.max_spots) || 0;
                const attendance = group?.attendance?.[weekKey]?.[slot.id] || {};
                const releasedSet = new Set(attendance.released_uids || []);
                const rosterIds = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
                const activeRosterIds = rosterIds.filter((uid) => !releasedSet.has(uid));
                const releasedRosterIds = rosterIds.filter((uid) => releasedSet.has(uid));
                const isRosterMember = rosterIds.includes(user?.id);
                const isReleased = releasedSet.has(user?.id);
                const waitlistEntries = (attendance.waitlist_uids || []).map((uid) => {
                  const meta = attendance?.waitlist_meta?.[uid];
                  return { uid, ...meta, kind: 'waitlist' };
                });
                const requestEntries = (attendance.request_uids || []).map((uid) => {
                  const meta = attendance?.request_meta?.[uid];
                  return { uid, ...meta, kind: 'request' };
                });
                const pendingEntries = [...requestEntries, ...waitlistEntries];
                const seatAssignments = [];
                activeRosterIds.slice(0, maxSpots).forEach((uid) => {
                  seatAssignments.push({ type: 'roster', uid });
                });
                (attendance.claimed_uids || []).forEach((uid) => {
                  if (seatAssignments.length >= maxSpots) return;
                  seatAssignments.push({
                    type: 'claim',
                    uid,
                    meta: attendance?.claimed_meta?.[uid] || null
                  });
                });
                const remainingSeats = Math.max(0, maxSpots - seatAssignments.length);
                for (let i = 0; i < remainingSeats; i += 1) {
                  seatAssignments.push({
                    type: 'free',
                    releasedBy: releasedRosterIds[i] || null
                  });
                }
                const isOwnSlot = memberRosterSlotIds.includes(slot.id);
                const canMemberSwap = memberRosterSlots.length > 0 && !hasActiveSwap;
                const isCollapsed = collapsedSlots[slot.id] ?? false;
                const isExpanded = !isCollapsed;

                return (
                  <div
                    key={slot.id}
                    className="rounded-2xl border border-slate-100 bg-white px-3 py-3 dark:bg-black dark:border-white/10"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSlotCollapse(slot.id)}
                        aria-expanded={isExpanded}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                          />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {getDayFullLabel(slot.day)} • {slot.time}
                          </div>
                          <div className="text-xs text-slate-500">
                            {slot.duration_minutes || 90} min • Max {slot.max_spots} kohta
                          </div>
                        </div>
                      </button>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 font-semibold">
                          Vabu: {availability.available}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 font-semibold">
                          Püsikohti: {availability.roster.length}/{maxSpots}
                        </span>
                        {slot.is_public && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 font-semibold">
                            Avalik
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {isRosterMember && (
                            <button
                              type="button"
                              disabled={isUpdatingAttendance[slot.id]}
                              onClick={() => handleToggleRelease(slot.id)}
                              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700"
                            >
                              {isReleased ? 'Tulen siiski' : 'Täna trenni ei jõua'}
                            </button>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                          {seatAssignments.map((seat, seatIndex) => {
                            if (seat.type === 'roster') {
                              const label = getMemberLabel(seat.uid);
                              return (
                                <div
                                  key={`${slot.id}-roster-${seat.uid}`}
                                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-sm"
                                >
                                  <div className="text-[10px] uppercase text-slate-400">Püsikoht</div>
                                  <div className="text-sm font-semibold text-slate-800 truncate">{label}</div>
                                </div>
                              );
                            }

                            if (seat.type === 'claim') {
                              const label = getMemberLabel(seat.uid, seat.meta);
                              return (
                                <div
                                  key={`${slot.id}-claim-${seat.uid}-${seatIndex}`}
                                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 shadow-sm"
                                >
                                  <div className="text-[10px] uppercase text-emerald-500">1x</div>
                                  <div className="text-sm font-semibold text-emerald-900 truncate">{label}</div>
                                </div>
                              );
                            }

                            const releasedLabel = seat.releasedBy ? getMemberLabel(seat.releasedBy) : null;
                            const canClaimSeat = canMemberSwap && !isOwnSlot;
                            return (
                              <div
                                key={`${slot.id}-free-${seatIndex}`}
                                className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 flex flex-col gap-2"
                              >
                                <div className="text-[10px] uppercase text-slate-400">Vaba</div>
                                {releasedLabel && (
                                  <div className="text-[10px] text-slate-400 truncate">
                                    püsikoht: {releasedLabel}
                                  </div>
                                )}
                                {canClaimSeat && (
                                  <button
                                    type="button"
                                    onClick={() => handleSwapClaim(slot.id)}
                                    className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white"
                                  >
                                    Asendan koha
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {pendingEntries.length > 0 && (
                          <div className="mt-3 text-[11px] text-slate-500">
                            Ootelist: {pendingEntries.length}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canManageTraining && (
            <div className="mt-6 rounded-[22px] border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10">
              <div className="text-xs font-semibold text-slate-500 mb-3">Lisa uus aeg</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={newSlot.day}
                  onChange={(event) => setNewSlot((prev) => ({ ...prev, day: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                >
                  {TRAINING_DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.full}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newSlot.time}
                  onChange={(event) => setNewSlot((prev) => ({ ...prev, time: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                />
                <input
                  type="number"
                  min={1}
                  value={newSlot.maxSpots}
                  onChange={(event) => setNewSlot((prev) => ({ ...prev, maxSpots: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                  placeholder="Kohti"
                />
                <button
                  type="button"
                  onClick={handleAddSlot}
                  disabled={isSavingSlot}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="w-3 h-3" /> Lisa
                </button>
              </div>
            </div>
          )}
        </div>

        {(canManageTraining || hasConfirmedSpot) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-slate-800">Aktiivsed trennimängud</div>
              <span className="text-xs text-slate-400">{activeGames.length} mängu</span>
            </div>
            {activeGames.length === 0 ? (
              <div className="text-sm text-slate-500">Aktiivseid mänge pole.</div>
            ) : (
              <div className="space-y-2">
                {activeGames.map((game) => {
                  const format = GAME_FORMATS[game.game_type] || {};
                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 dark:bg-black dark:border-white/10"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{game.name}</div>
                        <div className="text-xs text-slate-500">{format.name || game.game_type}</div>
                      </div>
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        PIN: {game.pin}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-slate-800">Top mängijad</div>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            {topPlayers.length === 0 ? (
              <div className="text-sm text-slate-500">Tulemusi pole veel.</div>
            ) : (
              <div className="space-y-2">
                {topPlayers.map((player, idx) => (
                  <div
                    key={`${player.name}-${idx}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2 dark:bg-black dark:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold dark:bg-black dark:text-slate-200 dark:border dark:border-white/10">
                        {idx + 1}
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{player.name}</div>
                    </div>
                    <div className="text-sm font-bold text-emerald-600">{player.score}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-slate-800">Viimased mängud</div>
              <span className="text-xs text-slate-400">{games.length} kokku</span>
            </div>
            {recentGames.length === 0 ? (
              <div className="text-sm text-slate-500">Mänge pole veel.</div>
            ) : (
              <div className="space-y-2">
                {recentGames.map((game) => {
                  const format = GAME_FORMATS[game.game_type] || {};
                  return (
                    <div
                      key={game.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 dark:bg-black dark:border-white/10"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{game.name}</div>
                        <div className="text-xs text-slate-500">{format.name || game.game_type}</div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {game.date ? new Date(game.date).toLocaleDateString('et-EE') : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
