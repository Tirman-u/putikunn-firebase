import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfMonth } from 'date-fns';
import { BarChart3, Trophy, Users, Activity, Pencil, Trash2, Check, X, Plus, Megaphone, ChevronDown, CalendarDays } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  arrayUnion,
  deleteField,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { createPageUrl } from '@/utils';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import MultiDatePicker from '@/components/training/MultiDatePicker';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import {
  TRAINING_DAYS,
  applyDirectSlotClaim,
  compareTrainingSlots,
  formatSlotOccurrenceDate,
  getDayValueFromDate,
  getDayFullLabel,
  getEffectiveSlotAttendance,
  getSlotAvailability,
  getSlotWeekKey,
  getWeekKey,
  createSlotId
} from '@/lib/training-utils';
import {
  compareSpecialEvents,
  getSpecialEventAvailability,
  getSpecialEventStart,
  isGroupPoolMember
} from '@/lib/training-special-events';

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

const DAY_FULL_EN = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday'
};

export default function TrainerGroupDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang, t } = useLanguage();
  const tr = React.useCallback((et, en) => (lang === 'en' ? en : et), [lang]);
  const groupId = searchParams.get('id');
  const weekKey = React.useMemo(() => getWeekKey(), []);
  const [announcementDraft, setAnnouncementDraft] = React.useState('');
  const [isSavingAnnouncement, setIsSavingAnnouncement] = React.useState(false);
  const [newSlot, setNewSlot] = React.useState({
    time: '18:00',
    maxSpots: 8,
    price: '',
    duration: 90,
    selectedDates: []
  });
  const [slotPickerMonth, setSlotPickerMonth] = React.useState(() => startOfMonth(new Date()));
  const [newSpecialEvent, setNewSpecialEvent] = React.useState({
    title: '',
    time: '18:00',
    maxSpots: 4,
    duration: 90,
    selectedDates: []
  });
  const [specialEventPickerMonth, setSpecialEventPickerMonth] = React.useState(() => startOfMonth(new Date()));
  const [editingSlotId, setEditingSlotId] = React.useState(null);
  const [editingSlot, setEditingSlot] = React.useState(null);
  const [isSavingSlot, setIsSavingSlot] = React.useState(false);
  const [isSavingSpecialEvent, setIsSavingSpecialEvent] = React.useState(false);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = React.useState({});
  const [slotSearch, setSlotSearch] = React.useState({});
  const [addingRoster, setAddingRoster] = React.useState({});
  const [selectedMember, setSelectedMember] = React.useState(null);
  const [isAssigningMember, setIsAssigningMember] = React.useState(false);
  const [removingMemberId, setRemovingMemberId] = React.useState(null);
  const [removingSpecialEventId, setRemovingSpecialEventId] = React.useState(null);
  const [specialEventAction, setSpecialEventAction] = React.useState({});
  const [collapsedSlots, setCollapsedSlots] = React.useState({});
  const [joiningGameId, setJoiningGameId] = React.useState(null);
  const defaultCollapsed = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  }, []);
  const getDayLabel = React.useCallback((value) => {
    if (lang !== 'en') return getDayFullLabel(value);
    return DAY_FULL_EN[value] || getDayFullLabel(value);
  }, [lang]);
  const slotLocale = lang === 'en' ? 'en-GB' : 'et-EE';
  const getSlotDateLabel = React.useCallback(
    (slot) => formatSlotOccurrenceDate(slot, weekKey, slotLocale) || getDayLabel(slot?.day),
    [getDayLabel, slotLocale, weekKey]
  );
  const getSlotWeekdayLabel = React.useCallback(
    (slot) => formatSlotOccurrenceDate(slot, weekKey, slotLocale, { weekday: 'long' }) || getDayLabel(slot?.day),
    [getDayLabel, slotLocale, weekKey]
  );
  const formatSpecialEventLabel = React.useCallback((event) => {
    const start = getSpecialEventStart(event);
    if (!start) return `${event?.date || ''} • ${event?.time || ''}`.trim();
    const locale = lang === 'en' ? 'en-GB' : 'et-EE';
    const dateLabel = start.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    return `${dateLabel} • ${event?.time || ''}`;
  }, [lang]);

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

  const { data: specialEventsData = [] } = useQuery({
    queryKey: ['training-special-events', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const q = query(collection(db, 'training_special_events'), where('group_id', '==', groupId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((entry) => entry?.status !== 'cancelled')
        .sort(compareSpecialEvents);
    },
    staleTime: 20000
  });
  const specialEvents = React.useMemo(
    () => (Array.isArray(specialEventsData) ? specialEventsData : []),
    [specialEventsData]
  );

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
  const allUsersById = React.useMemo(
    () => searchableUsers.reduce((acc, entry) => {
      if (entry?.id) acc[entry.id] = entry;
      return acc;
    }, {}),
    [searchableUsers]
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

  const slots = Array.isArray(group?.slots) ? group.slots : [];
  const sortedSlots = React.useMemo(
    () => [...slots].sort((left, right) => compareTrainingSlots(left, right, weekKey)),
    [slots, weekKey]
  );
  const upcomingSpecialEvents = React.useMemo(
    () => specialEvents.filter((event) => !getSpecialEventAvailability(event).isPast),
    [specialEvents]
  );
  const pastSpecialEventsCount = React.useMemo(
    () => specialEvents.filter((event) => getSpecialEventAvailability(event).isPast).length,
    [specialEvents]
  );

  const collapsedStorageKey = React.useMemo(() => {
    if (!groupId) return null;
    return `training_slots_collapsed_${groupId}`;
  }, [groupId]);

  const persistCollapsedSlots = React.useCallback((next) => {
    if (!collapsedStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(collapsedStorageKey, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }, [collapsedStorageKey]);

  React.useEffect(() => {
    if (!slots.length) return;
    let stored = {};
    if (collapsedStorageKey && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(collapsedStorageKey);
        stored = raw ? JSON.parse(raw) : {};
      } catch {
        stored = {};
      }
    }
    setCollapsedSlots((prev) => {
      const next = { ...prev };
      slots.forEach((slot) => {
        if (stored?.[slot.id] !== undefined) {
          next[slot.id] = stored[slot.id];
          return;
        }
        if (next[slot.id] === undefined) {
          next[slot.id] = defaultCollapsed;
        }
      });
      return next;
    });
  }, [slots, defaultCollapsed, collapsedStorageKey]);

  const toggleSlotCollapse = React.useCallback((slotId) => {
    setCollapsedSlots((prev) => {
      const next = {
        ...prev,
        [slotId]: !prev[slotId]
      };
      persistCollapsedSlots(next);
      return next;
    });
  }, [persistCollapsedSlots]);
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
  const memberClaimedSlots = slots.filter((slot) => {
    const attendance = getEffectiveSlotAttendance(group, weekKey, slot);
    return attendance.claimed_uids.includes(user?.id);
  });
  const memberReleasedSlots = slots.filter((slot) => {
    const attendance = getEffectiveSlotAttendance(group, weekKey, slot);
    return attendance.released_uids.includes(user?.id);
  });
  const memberRequestedSlots = slots.filter((slot) => {
    const attendance = getEffectiveSlotAttendance(group, weekKey, slot);
    return attendance.request_uids.includes(user?.id);
  });
  const memberWaitlistSlots = slots.filter((slot) => {
    const attendance = getEffectiveSlotAttendance(group, weekKey, slot);
    return attendance.waitlist_uids.includes(user?.id);
  });
  const hasConfirmedSpot = canManageTraining || memberRosterSlots.length > 0 || memberClaimedSlots.length > 0;
  const isPoolMemberOnly = !canManageTraining && isGroupMember && memberRosterSlots.length === 0;
  const hasPendingSpotApproval = memberRequestedSlots.length > 0;
  const hasPoolSpotOpportunity = isPoolMemberOnly && slots.some((slot) => attendanceBySlot(slot).available > 0);
  const hasActiveSwap = memberClaimedSlots.length > 0;
  const hasReleasedOwnSpot = memberReleasedSlots.length > 0;
  const memberRosterSlotIds = memberRosterSlots.map((slot) => slot.id);
  const fallbackMemberIds = React.useMemo(
    () =>
      searchableUsers
        .filter((entry) => entry?.training_groups && groupId && entry.training_groups[groupId])
        .map((entry) => entry.id)
        .filter(Boolean),
    [searchableUsers, groupId]
  );
  const getMemberLabel = React.useCallback(
    (uid, meta = null) =>
      meta?.name ||
      group?.members?.[uid]?.name ||
      group?.members?.[uid]?.email ||
      allUsersById?.[uid]?.display_name ||
      allUsersById?.[uid]?.full_name ||
      allUsersById?.[uid]?.email ||
      meta?.email ||
      uid,
    [group, allUsersById]
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
    const ids = new Set();
    (group?.member_uids || []).forEach((uid) => ids.add(uid));
    Object.keys(group?.members || {}).forEach((uid) => ids.add(uid));
    fallbackMemberIds.forEach((uid) => ids.add(uid));
    return Array.from(ids);
  }, [group?.member_uids, group?.members, fallbackMemberIds]);
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
        .map((uid) => ({
          uid,
          ...((allUsersById?.[uid] || {})),
          ...((group?.members || {})[uid] || {})
        })),
    [memberIds, rosterUidSet, group?.members, allUsersById]
  );

  if (user && !canViewGroup) {
    return null;
  }

  if (!groupId) {
    return null;
  }

  const updateGroupSlots = async (nextSlots) => {
    if (!groupId) return;
    setIsSavingSlot(true);
    try {
      const sortedNextSlots = [...nextSlots].sort((left, right) => compareTrainingSlots(left, right, weekKey));
      const hasPublic = sortedNextSlots.some((slot) => slot.is_public);
      await updateDoc(doc(db, 'training_groups', groupId), {
        slots: sortedNextSlots,
        has_public_slots: hasPublic
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleAddSlot = async () => {
    const selectedDates = Array.isArray(newSlot.selectedDates) ? newSlot.selectedDates : [];
    if (!newSlot.time || Number(newSlot.maxSpots) < 1 || selectedDates.length === 0) {
      toast.error(tr('Vali vähemalt üks kuupäev, kellaaeg ja kohtade arv', 'Select at least one date, time and spot count'));
      return;
    }

    const existingKeys = new Set(
      slots.map((slot) => `${slot.date || ''}|${slot.time || ''}`)
    );
    const datesToAdd = [...selectedDates].sort();
    const nextSlots = [...slots];
    let addedCount = 0;

    datesToAdd.forEach((selectedDate) => {
      const slotKey = `${selectedDate}|${newSlot.time}`;
      if (existingKeys.has(slotKey)) return;
      existingKeys.add(slotKey);
      addedCount += 1;
      nextSlots.push({
        id: createSlotId(),
        date: selectedDate,
        day: getDayValueFromDate(selectedDate),
        time: newSlot.time,
        max_spots: Number(newSlot.maxSpots),
        duration_minutes: Number(newSlot.duration) || 90,
        price: newSlot.price,
        is_public: false,
        roster_uids: []
      });
    });

    if (addedCount === 0) {
      toast.error(tr('Need kuupäevad on juba olemas', 'Those dates already exist'));
      return;
    }

    await updateGroupSlots(nextSlots);
    setNewSlot((prev) => ({
      ...prev,
      time: prev.time,
      price: prev.price,
      selectedDates: []
    }));
    toast.success(
      addedCount === 1
        ? tr('Trenn lisatud', 'Training added')
        : tr(`Lisatud ${addedCount} trenni`, `Added ${addedCount} trainings`)
    );
  };

  const startEditingSlot = (slot) => {
    setEditingSlotId(slot.id);
    setEditingSlot({
      ...slot,
      date: slot.date || '',
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
        ? (() => {
            const nextSlot = {
              ...slot,
              time: editingSlot.time,
              max_spots: Number(editingSlot.max_spots) || 1,
              duration_minutes: Number(editingSlot.duration_minutes) || 90,
              price: editingSlot.price || '',
              is_public: Boolean(editingSlot.is_public)
            };
            if (editingSlot.date) {
              nextSlot.date = editingSlot.date;
              nextSlot.day = getDayValueFromDate(editingSlot.date) || editingSlot.day;
            } else {
              delete nextSlot.date;
              nextSlot.day = editingSlot.day;
            }
            return nextSlot;
          })()
        : slot
    );
    await updateGroupSlots(nextSlots);
    cancelEditingSlot();
  };

  const handleDeleteSlot = async (slotId) => {
    if (!confirm(tr('Kustuta see trenniaeg?', 'Delete this training time?'))) return;
    const nextSlots = slots.filter((slot) => slot.id !== slotId);
    await updateGroupSlots(nextSlots);
  };

  const handleCreateSpecialEvent = async () => {
    if (!groupId || !canManageTraining) return;
    const selectedDates = Array.isArray(newSpecialEvent.selectedDates) ? [...newSpecialEvent.selectedDates].sort() : [];
    const maxSpots = Number(newSpecialEvent.maxSpots) || 0;
    const duration = Number(newSpecialEvent.duration) || 90;
    const title = newSpecialEvent.title.trim() || tr('Välitrenn', 'Outdoor training');
    if (selectedDates.length === 0 || !newSpecialEvent.time || maxSpots < 1) {
      toast.error(tr('Vali vähemalt üks kuupäev, kellaaeg ja kohtade arv', 'Select at least one date, time and spot count'));
      return;
    }

    for (const dateValue of selectedDates) {
      const startsAt = getSpecialEventStart({
        date: dateValue,
        time: newSpecialEvent.time,
        duration_minutes: duration
      });
      if (!startsAt || Number.isNaN(startsAt.getTime())) {
        toast.error(tr('Kuupäev või kellaaeg on vigane', 'Date or time is invalid'));
        return;
      }
      if (startsAt.getTime() <= Date.now()) {
        toast.error(tr('Kõik välitrennid peavad olema tulevikus', 'All special events must be in the future'));
        return;
      }
    }

    setIsSavingSpecialEvent(true);
    try {
      const batch = writeBatch(db);
      selectedDates.forEach((dateValue) => {
        const eventRef = doc(collection(db, 'training_special_events'));
        batch.set(eventRef, {
          group_id: groupId,
          title,
          date: dateValue,
          time: newSpecialEvent.time,
          duration_minutes: duration,
          max_spots: maxSpots,
          status: 'active',
          booked_uids: [],
          booked_meta: {},
          created_by_uid: user?.id || null,
          created_at: serverTimestamp()
        });
      });
      await batch.commit();
      setNewSpecialEvent((prev) => ({
        ...prev,
        title: '',
        maxSpots: 4,
        selectedDates: []
      }));
      queryClient.invalidateQueries({ queryKey: ['training-special-events', groupId] });
      toast.success(
        selectedDates.length === 1
          ? tr('Välitrenn lisatud', 'Special event added')
          : tr(`Lisatud ${selectedDates.length} välitrenni`, `Added ${selectedDates.length} special events`)
      );
    } catch (error) {
      toast.error(error?.message || tr('Välitrenni loomine ebaõnnestus', 'Failed to create special event'));
    } finally {
      setIsSavingSpecialEvent(false);
    }
  };

  const handleDeleteSpecialEvent = async (eventId) => {
    if (!eventId) return;
    if (!confirm(tr('Kustuta see välitrenn?', 'Delete this special event?'))) return;
    setRemovingSpecialEventId(eventId);
    try {
      await deleteDoc(doc(db, 'training_special_events', eventId));
      queryClient.invalidateQueries({ queryKey: ['training-special-events', groupId] });
      toast.success(tr('Välitrenn kustutatud', 'Special event deleted'));
    } catch (error) {
      toast.error(error?.message || tr('Välitrenni kustutamine ebaõnnestus', 'Failed to delete special event'));
    } finally {
      setRemovingSpecialEventId(null);
    }
  };

  const invalidateSpecialEventQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['training-special-events', groupId] });
    queryClient.invalidateQueries({ queryKey: ['training-special-events'] });
    queryClient.invalidateQueries({ queryKey: ['training-special-events-by-group'] });
  };

  const handleRemoveSpecialEventBooking = async (eventId, targetUid) => {
    if (!eventId || !targetUid) return;
    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'training_special_events', eventId);
        const snap = await transaction.get(eventRef);
        if (!snap.exists()) throw new Error(tr('Välitrenni ei leitud', 'Special event not found'));
        const data = snap.data() || {};
        const booked = Array.isArray(data.booked_uids) ? data.booked_uids : [];
        if (!booked.includes(targetUid)) return;
        const nextBooked = booked.filter((uid) => uid !== targetUid);
        const nextMeta = { ...(data.booked_meta || {}) };
        delete nextMeta[targetUid];
        transaction.update(eventRef, {
          booked_uids: nextBooked,
          booked_meta: nextMeta
        });
      });
      queryClient.invalidateQueries({ queryKey: ['training-special-events', groupId] });
      toast.success(tr('Broneering eemaldatud', 'Booking removed'));
    } catch (error) {
      toast.error(error?.message || tr('Broneeringu eemaldamine ebaõnnestus', 'Failed to remove booking'));
    }
  };

  const handleBookOwnSpecialEvent = async (event) => {
    if (!event?.id || !user?.id || !groupId) return;

    if (!isGroupPoolMember(group, user.id, { knownMember: isGroupMember })) {
      toast.error(tr('Välitrenn on ainult pooli liikmetele', 'Special event is only for pool members'));
      return;
    }

    const displayName = user?.display_name || user?.full_name || user?.email || tr('Trenniline', 'Trainee');
    const userEmail = user?.email || '';
    setSpecialEventAction((prev) => ({ ...prev, [event.id]: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'training_special_events', event.id);
        const groupRef = doc(db, 'training_groups', groupId);
        const eventSnap = await transaction.get(eventRef);
        const groupSnap = await transaction.get(groupRef);

        if (!eventSnap.exists()) throw new Error(tr('Välitrenni ei leitud', 'Special event not found'));
        if (!groupSnap.exists()) throw new Error(tr('Gruppi ei leitud', 'Group not found'));

        const eventData = { id: eventSnap.id, ...eventSnap.data() };
        const groupData = groupSnap.data() || {};
        if (!isGroupPoolMember(groupData, user.id, { knownMember: isGroupMember })) {
          throw new Error(tr('Välitrenn on ainult pooli liikmetele', 'Special event is only for pool members'));
        }

        const availability = getSpecialEventAvailability(eventData);
        if (availability.isPast) throw new Error(tr('See välitrenn on juba möödunud', 'This special event has already passed'));
        if (availability.booked.includes(user.id)) return;
        if (availability.available <= 0) throw new Error(tr('Vabu kohti pole', 'No free spots'));

        transaction.update(eventRef, {
          booked_uids: [...availability.booked, user.id],
          booked_meta: {
            ...(eventData.booked_meta || {}),
            [user.id]: {
              name: displayName,
              email: userEmail,
              booked_at: new Date().toISOString()
            }
          }
        });
      });
      invalidateSpecialEventQueries();
      toast.success(tr('Välitrenn broneeritud', 'Special event booked'));
    } catch (error) {
      toast.error(error?.message || tr('Välitrenni broneerimine ebaõnnestus', 'Failed to book special event'));
    } finally {
      setSpecialEventAction((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  const handleCancelOwnSpecialEvent = async (event) => {
    if (!event?.id || !user?.id) return;
    setSpecialEventAction((prev) => ({ ...prev, [event.id]: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'training_special_events', event.id);
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error(tr('Välitrenni ei leitud', 'Special event not found'));
        const eventData = eventSnap.data() || {};
        const booked = Array.isArray(eventData.booked_uids) ? eventData.booked_uids : [];
        if (!booked.includes(user.id)) return;
        const nextBooked = booked.filter((uid) => uid !== user.id);
        const nextMeta = { ...(eventData.booked_meta || {}) };
        delete nextMeta[user.id];
        transaction.update(eventRef, {
          booked_uids: nextBooked,
          booked_meta: nextMeta
        });
      });
      invalidateSpecialEventQueries();
      toast.success(tr('Välitrenni broneering eemaldatud', 'Special event booking removed'));
    } catch (error) {
      toast.error(error?.message || tr('Välitrenni broneeringu eemaldamine ebaõnnestus', 'Failed to remove special event booking'));
    } finally {
      setSpecialEventAction((prev) => ({ ...prev, [event.id]: false }));
    }
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
        if (!snap.exists()) throw new Error(tr('Gruppi ei leitud', 'Group not found'));
        const data = snap.data();
        const slotsList = Array.isArray(data.slots) ? data.slots : [];
        const targetSlot = slotsList.find((slot) => slot.id === slotId);
        const currentWeek = getSlotWeekKey(targetSlot, getWeekKey());
        const weekData = { ...(data.attendance?.[currentWeek] || {}) };
        const slotData = normalizeSlotData(weekData[slotId]);
        const nextSlotData = updater(slotData, data, currentWeek);
        weekData[slotId] = nextSlotData;
        transaction.update(groupRef, {
          [`attendance.${currentWeek}`]: weekData
        });
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } catch (error) {
      toast.error(error?.message || tr('Uuendus ebaõnnestus', 'Update failed'));
    } finally {
      setIsUpdatingAttendance((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const updateAttendanceMulti = async (slotId, updater) => {
    if (!groupId || !slotId) return;
    setIsUpdatingAttendance((prev) => ({ ...prev, global: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error(tr('Gruppi ei leitud', 'Group not found'));
        const data = snap.data();
        const slotsList = Array.isArray(data.slots) ? data.slots : [];
        const targetSlot = slotsList.find((slot) => slot.id === slotId);
        const currentWeek = getSlotWeekKey(targetSlot, getWeekKey());
        const weekData = { ...(data.attendance?.[currentWeek] || {}) };
        const nextWeekData = updater(weekData, data, currentWeek, targetSlot);
        transaction.update(groupRef, {
          [`attendance.${currentWeek}`]: nextWeekData
        });
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } catch (error) {
      toast.error(error?.message || tr('Uuendus ebaõnnestus', 'Update failed'));
    } finally {
      setIsUpdatingAttendance((prev) => ({ ...prev, global: false }));
    }
  };

  const handleToggleRelease = async (slotId) => {
    const userId = user?.id;
    if (!userId) return;
    await updateAttendanceMulti(slotId, (weekData) => {
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
    const userName = user?.display_name || user?.full_name || user?.email || tr('Trenniline', 'Trainee');
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
      const claimedMeta = { ...(slotData.claimed_meta || {}) };
      delete claimedMeta[userId];
      return { ...slotData, claimed_uids: claimed, claimed_meta: claimedMeta };
    });
  };

  const handlePoolSpotClaim = async (targetSlotId) => {
    const userId = user?.id;
    if (!userId) return;
    const userName = user?.display_name || user?.full_name || user?.email || tr('Trenniline', 'Trainee');
    const userEmail = user?.email || '';
    await updateAttendanceMulti(targetSlotId, (weekData, groupData, currentWeek) => {
      const slotsList = Array.isArray(groupData.slots) ? groupData.slots : [];
      const targetSlot = slotsList.find((slot) => slot.id === targetSlotId);
      if (!targetSlot) return weekData;
      const availability = getSlotAvailability(targetSlot, groupData, currentWeek);
      if (availability.available <= 0) {
        throw new Error(tr('Vabu kohti pole', 'No free spots'));
      }

      return applyDirectSlotClaim(weekData, targetSlotId, {
        userId,
        name: userName,
        email: userEmail,
        source: 'pool',
        type: 'claim'
      });
    });
  };

  const handleJoinWaitlist = async (slotId) => {
    const userId = user?.id;
    if (!userId) return;
    const userName = user?.display_name || user?.full_name || user?.email || tr('Trenniline', 'Trainee');
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
        throw new Error(tr('Vabu kohti pole', 'No free spots'));
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
          throw new Error(tr('Püsikohti pole', 'No reserved spots left'));
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
        throw new Error(tr('Vabu kohti pole', 'No free spots'));
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
          throw new Error(tr('Püsikohti pole', 'No reserved spots left'));
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
      await setDoc(
        doc(db, 'users', uid),
        {
          training_groups: {
            [groupId]: group?.name || 'Treening'
          }
        },
        { merge: true }
      );
    } catch (error) {
      toast.error(error?.message || tr('Liikme lisamine ebaõnnestus', 'Failed to add member'));
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
      toast.success(tr('Trenniline lisatud', 'Trainee added'));
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
        if (!snap.exists()) throw new Error(tr('Gruppi ei leitud', 'Group not found'));
        const data = snap.data();
        const currentSlots = Array.isArray(data.slots) ? data.slots : [];
        const nextSlots = currentSlots.map((slot) => {
          if (slot.id !== slotId) return slot;
          const roster = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
          if (roster.includes(uid)) return slot;
          const maxSpots = Number(slot.max_spots || 0);
          if (roster.length >= maxSpots) {
            throw new Error(tr('Püsikohad täis', 'Reserved spots full'));
          }
          return { ...slot, roster_uids: [...roster, uid] };
        });
        transaction.update(groupRef, { slots: nextSlots });
      });
      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
    } catch (error) {
      toast.error(error?.message || tr('Püsikoha kinnitamine ebaõnnestus', 'Failed to confirm reserved spot'));
    }
  };

  const moveRosterMember = async (sourceSlotId, targetSlotId, uid) => {
    if (!groupId || !sourceSlotId || !targetSlotId || !uid) return;
    if (sourceSlotId === targetSlotId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error(tr('Gruppi ei leitud', 'Group not found'));
        const data = snap.data();
        const currentSlots = Array.isArray(data.slots) ? data.slots : [];
        const targetSlot = currentSlots.find((slot) => slot.id === targetSlotId);
        if (!targetSlot) throw new Error(tr('Trenni ei leitud', 'Training not found'));
        const targetRoster = Array.isArray(targetSlot.roster_uids) ? targetSlot.roster_uids : [];
        const targetMax = Number(targetSlot.max_spots || 0);
        if (targetMax > 0 && targetRoster.length >= targetMax) {
          throw new Error(tr('Püsikohad täis', 'Reserved spots full'));
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
      toast.error(error?.message || tr('Liigutamine ebaõnnestus', 'Move failed'));
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
      toast.error(tr('Püsikohad täis', 'Reserved spots full'));
      return;
    }
    setAddingRoster((prev) => ({ ...prev, [slotId]: entry.id }));
    try {
      const displayName = entry.display_name || entry.full_name || entry.email || entry.id;
      await addUserToGroupMembers(entry.id, { name: displayName, email: entry.email || '' });
      await addUserToRoster(slotId, entry.id);
      setSlotSearch((prev) => ({ ...prev, [slotId]: '' }));
      toast.success(tr('Trenniline lisatud', 'Trainee added'));
    } finally {
      setAddingRoster((prev) => ({ ...prev, [slotId]: null }));
    }
  };

  const handleSwapClaim = async (targetSlotId) => {
    const userId = user?.id;
    if (!userId) return;
    const userName = user?.display_name || user?.full_name || user?.email || tr('Trenniline', 'Trainee');
    const userEmail = user?.email || '';
    await updateAttendanceMulti(targetSlotId, (weekData, groupData, currentWeek) => {
      const slotsList = Array.isArray(groupData.slots) ? groupData.slots : [];
      const targetSlot = slotsList.find((slot) => slot.id === targetSlotId);
      if (!targetSlot) return weekData;
      const availability = getSlotAvailability(targetSlot, groupData, currentWeek);
      if (availability.available <= 0) {
        throw new Error(tr('Vabu kohti pole', 'No free spots'));
      }

      const rosterSlotIds = slotsList
        .filter(
          (slot) =>
            Array.isArray(slot.roster_uids) &&
            slot.roster_uids.includes(userId) &&
            getSlotWeekKey(slot, currentWeek) === currentWeek
        )
        .map((slot) => slot.id);
      if (rosterSlotIds.length === 0) {
        throw new Error(tr('Sul pole püsikohta', 'You do not have a reserved spot'));
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

  const handleSecondSessionClaim = async (targetSlotId) => {
    const userId = user?.id;
    if (!userId) return;
    const userName = user?.display_name || user?.full_name || user?.email || tr('Trenniline', 'Trainee');
    const userEmail = user?.email || '';
    await updateAttendanceMulti(targetSlotId, (weekData, groupData, currentWeek) => {
      const slotsList = Array.isArray(groupData.slots) ? groupData.slots : [];
      const targetSlot = slotsList.find((slot) => slot.id === targetSlotId);
      if (!targetSlot) return weekData;
      const availability = getSlotAvailability(targetSlot, groupData, currentWeek);
      if (availability.available <= 0) {
        throw new Error(tr('Vabu kohti pole', 'No free spots'));
      }

      const rosterSlotIds = slotsList
        .filter(
          (slot) =>
            Array.isArray(slot.roster_uids) &&
            slot.roster_uids.includes(userId) &&
            getSlotWeekKey(slot, currentWeek) === currentWeek
        )
        .map((slot) => slot.id);
      if (rosterSlotIds.length === 0) {
        throw new Error(tr('Sul pole püsikohta', 'You do not have a reserved spot'));
      }

      const hasReleased = rosterSlotIds.some((slotId) => {
        const slotData = normalizeSlotData(weekData[slotId]);
        return slotData.released_uids.includes(userId);
      });
      if (hasReleased) {
        throw new Error(tr('Vabasta 1x asendus enne või kasuta "Asendan koha"', 'Release swap is active, use "Claim spot"'));
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
            type: 'double_session',
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
    if (!confirm(tr('Eemalda püsikohalt?', 'Remove from reserved spot?'))) return;
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
    await updateAttendanceMulti(slotId, (weekData, groupData, currentWeek) => {
      const slotsList = Array.isArray(groupData.slots) ? groupData.slots : [];
      const rosterSlotIds = slotsList
        .filter(
          (slot) =>
            Array.isArray(slot.roster_uids) &&
            slot.roster_uids.includes(targetUid) &&
            getSlotWeekKey(slot, currentWeek) === currentWeek
        )
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

  const handleRemoveMemberFromGroup = async (targetUid) => {
    if (!groupId || !targetUid) return;
    if (removingMemberId) return;
    if (!confirm(tr('Eemalda trenniline grupist täielikult?', 'Remove trainee from group completely?'))) return;
    setRemovingMemberId(targetUid);
    try {
      await runTransaction(db, async (transaction) => {
        const groupRef = doc(db, 'training_groups', groupId);
        const snap = await transaction.get(groupRef);
        if (!snap.exists()) throw new Error(tr('Gruppi ei leitud', 'Group not found'));
        const data = snap.data();

        const currentSlots = Array.isArray(data.slots) ? data.slots : [];
        const nextSlots = currentSlots.map((slot) => {
          const roster = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
          if (!roster.includes(targetUid)) return slot;
          return {
            ...slot,
            roster_uids: roster.filter((uid) => uid !== targetUid)
          };
        });

        const memberUids = Array.isArray(data.member_uids) ? data.member_uids : [];
        const nextMemberUids = memberUids.filter((uid) => uid !== targetUid);
        const nextMembers = { ...(data.members || {}) };
        if (nextMembers?.[targetUid]) {
          delete nextMembers[targetUid];
        }

        const attendanceData = data.attendance || {};
        const attendanceUpdates = {};
        Object.entries(attendanceData).forEach(([week, weekRaw]) => {
          if (!weekRaw || typeof weekRaw !== 'object') return;
          const weekData = weekRaw;
          const nextWeekData = {};
          let weekChanged = false;

          Object.entries(weekData).forEach(([slotId, slotRaw]) => {
            const slotData = normalizeSlotData(slotRaw);
            const nextReleased = slotData.released_uids.filter((uid) => uid !== targetUid);
            const nextClaimed = slotData.claimed_uids.filter((uid) => uid !== targetUid);
            const nextWaitlist = slotData.waitlist_uids.filter((uid) => uid !== targetUid);
            const nextRequests = slotData.request_uids.filter((uid) => uid !== targetUid);

            const nextClaimedMeta = { ...(slotData.claimed_meta || {}) };
            const hadClaimedMeta = Boolean(nextClaimedMeta?.[targetUid]);
            if (hadClaimedMeta) delete nextClaimedMeta[targetUid];

            const nextWaitlistMeta = { ...(slotData.waitlist_meta || {}) };
            const hadWaitlistMeta = Boolean(nextWaitlistMeta?.[targetUid]);
            if (hadWaitlistMeta) delete nextWaitlistMeta[targetUid];

            const nextRequestMeta = { ...(slotData.request_meta || {}) };
            const hadRequestMeta = Boolean(nextRequestMeta?.[targetUid]);
            if (hadRequestMeta) delete nextRequestMeta[targetUid];

            const slotChanged =
              nextReleased.length !== slotData.released_uids.length ||
              nextClaimed.length !== slotData.claimed_uids.length ||
              nextWaitlist.length !== slotData.waitlist_uids.length ||
              nextRequests.length !== slotData.request_uids.length ||
              hadClaimedMeta ||
              hadWaitlistMeta ||
              hadRequestMeta;

            if (slotChanged) {
              weekChanged = true;
            }

            nextWeekData[slotId] = {
              ...slotData,
              released_uids: nextReleased,
              claimed_uids: nextClaimed,
              claimed_meta: nextClaimedMeta,
              waitlist_uids: nextWaitlist,
              waitlist_meta: nextWaitlistMeta,
              request_uids: nextRequests,
              request_meta: nextRequestMeta
            };
          });

          if (weekChanged) {
            attendanceUpdates[`attendance.${week}`] = nextWeekData;
          }
        });

        transaction.update(groupRef, {
          slots: nextSlots,
          has_public_slots: nextSlots.some((slot) => slot.is_public),
          member_uids: nextMemberUids,
          members: nextMembers,
          ...attendanceUpdates
        });
      });

      try {
        await updateDoc(doc(db, 'users', targetUid), {
          [`training_groups.${groupId}`]: deleteField()
        });
      } catch (error) {
        // User doc may be missing; group cleanup still succeeded.
      }

      const affectedSpecialEvents = specialEvents.filter((event) =>
        Array.isArray(event?.booked_uids) && event.booked_uids.includes(targetUid)
      );
      if (affectedSpecialEvents.length > 0) {
        await Promise.all(
          affectedSpecialEvents.map(async (event) => {
            const nextBooked = (event.booked_uids || []).filter((uid) => uid !== targetUid);
            const nextBookedMeta = { ...(event.booked_meta || {}) };
            delete nextBookedMeta[targetUid];
            await updateDoc(doc(db, 'training_special_events', event.id), {
              booked_uids: nextBooked,
              booked_meta: nextBookedMeta
            });
          })
        );
      }

      if (selectedMember?.uid === targetUid) {
        setSelectedMember(null);
      }

      queryClient.invalidateQueries({ queryKey: ['training-group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['training-special-events'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success(tr('Trenniline eemaldatud grupist', 'Trainee removed from group'));
    } catch (error) {
      toast.error(error?.message || tr('Eemaldamine ebaõnnestus', 'Removal failed'));
    } finally {
      setRemovingMemberId(null);
    }
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
      toast.success(tr('Teade salvestatud', 'Announcement saved'));
    } catch (error) {
      toast.error(error?.message || tr('Teate salvestamine ebaõnnestus', 'Failed to save announcement'));
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const joinTrainingGame = async (game) => {
    if (!game?.id) return;
    if (!user?.id) {
      toast.error(tr('Palun logi sisse', 'Please sign in'));
      return;
    }
    const playerName = user?.display_name || user?.full_name || user?.email || tr('Mängija', 'Player');
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
      toast.error(error?.message || tr('Mänguga liitumine ebaõnnestus', 'Failed to join game'));
    } finally {
      setJoiningGameId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(31,156,141,0.15),_rgba(247,252,253,1)_55%)] px-4 pb-12 dark:bg-black dark:text-slate-100">
      <div className="max-w-5xl mx-auto pt-6">
        <div className="mb-6 flex items-center gap-2">
          <BackButton
            fallbackTo={createPageUrl(canManageTraining ? 'TrainerGroups' : 'JoinTraining')}
            forceFallback
            label={tr('Tagasi', 'Back')}
          />
          <HomeButton label={tr('Avaleht', 'Home')} />
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{group?.name || tr('Treening', 'Training')}</h1>
            <p className="text-sm text-slate-500">
              {canManageTraining ? tr('Treeneri dashboard', 'Coach dashboard') : tr('Treeningu vaade', 'Training view')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`${createPageUrl('TrainingLeague')}?groupId=${groupId}`)}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 dark:bg-black dark:border-white/10 dark:text-emerald-300"
          >
            <Trophy className="w-4 h-4" />
            {tr('LIIGA', 'LEAGUE')}
          </button>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-8 dark:bg-black dark:border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-emerald-500" />
              {tr('Teadete tahvel', 'Announcements')}
            </div>
            {canManageTraining && (
              <button
                type="button"
                onClick={handleSaveAnnouncement}
                disabled={isSavingAnnouncement}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSavingAnnouncement ? tr('Salvestan...', 'Saving...') : tr('Salvesta', 'Save')}
              </button>
            )}
          </div>
          {canManageTraining ? (
            <textarea
              value={announcementDraft}
              onChange={(event) => setAnnouncementDraft(event.target.value)}
              placeholder={tr('Lisa trennilistele info...', 'Add an announcement for trainees...')}
              className="w-full min-h-[88px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
            />
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-200">
              {group?.announcement?.trim() || tr('Teateid pole hetkel.', 'No announcements right now.')}
            </div>
          )}
        </div>

        {canViewGroup && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 uppercase mb-2">{tr('Aktiivsed mängud', 'Active games')}</div>
              <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                <Activity className="w-5 h-5 text-emerald-500" />
                {activeGames.length}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 uppercase mb-2">{tr('Kõik mängud', 'All games')}</div>
              <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                {games.length}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 uppercase mb-2">{tr('Mängijaid kokku', 'Total players')}</div>
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
              <div className="text-sm font-semibold text-slate-800">{tr('Põhitrennid', 'Primary trainings')}</div>
              <div className="text-xs text-slate-500">
                {tr('Siia lisa tavalised trenniajad, mis juhivad püsikohti, 1x kohti ja attendance’i.', 'Use this for regular training dates that drive reserved spots, one-time spots, and attendance.')}
              </div>
            </div>
            {canManageTraining && (
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                {tr('Kuuluta vaba koht, et see ilmuks “Vabad trennid” nimekirjas.', 'Announce a free spot to show it in the “Free trainings” list.')}
              </div>
            )}
          </div>

          {slots.length === 0 && (
            <div className="text-sm text-slate-500">{tr('Põhitrenne pole veel lisatud.', 'No primary trainings added yet.')}</div>
          )}

          {canManageTraining ? (
            <div className="space-y-3">
              {unassignedMembers.length > 0 && (
                <div className="rounded-[20px] border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{tr('Sortimata liikmed', 'Unassigned members')}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {unassignedMembers.map((member) => {
                      const isSelected =
                        selectedMember?.uid === member.uid && !selectedMember?.sourceSlotId;
                      return (
                        <div
                          key={`unassigned-${member.uid}`}
                          className={`rounded-2xl border border-dashed px-3 py-3 text-xs text-slate-600 shadow-sm text-left transition ${
                            isSelected
                              ? 'border-emerald-300 ring-2 ring-emerald-200'
                              : 'border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectMember(member.uid, null)}
                            className="w-full text-left"
                          >
                            <div className="text-[10px] uppercase text-slate-400">{tr('Sortimata', 'Unassigned')}</div>
                            <div className="text-sm font-semibold text-slate-800 truncate">
                              {getMemberLabel(member.uid)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">{tr('Vali trenn', 'Choose training')}</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberFromGroup(member.uid)}
                            disabled={removingMemberId === member.uid}
                            className="mt-2 inline-flex items-center rounded-full border border-rose-200 px-2.5 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                          >
                            {removingMemberId === member.uid
                              ? tr('Eemaldan...', 'Removing...')
                              : tr('Eemalda grupist', 'Remove from group')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedMember && (
                <div className="rounded-[20px] border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{tr('Määra trenn', 'Assign training')}</div>
                  <div className="text-[11px] text-slate-500 mb-3">
                    {tr('Valitud', 'Selected')}: {getMemberLabel(selectedMember.uid)}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sortedSlots.map((slot) => {
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
                            {getSlotDateLabel(slot)} • {slot.time}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {getSlotWeekdayLabel(slot)} • {' '}
                            {tr('Püsikohti', 'Reserved')}: {rosterCount}/{maxSpots || '-'}
                          </div>
                          {isCurrent && (
                            <div className="text-[10px] text-slate-400 mt-1">{tr('Praegune', 'Current')}</div>
                          )}
                          {isFull && !isCurrent && (
                            <div className="text-[10px] text-amber-600 mt-1">{tr('Täis', 'Full')}</div>
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
                      {tr('Tühista', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}

	              {sortedSlots.map((slot) => {
              const availability = attendanceBySlot(slot);
              const maxSpots = availability.maxSpots || Number(slot.max_spots) || 0;
              const attendance = getEffectiveSlotAttendance(group, weekKey, slot);
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
              const canSecondSessionClaim = canMemberSwap && !hasReleasedOwnSpot;
              const isCollapsed = collapsedSlots[slot.id] ?? false;
              const isExpanded = !isCollapsed || editingSlotId === slot.id;

              return (
                <div
                  key={slot.id}
                  className="rounded-2xl border border-slate-100 bg-white px-3 py-3 dark:bg-black dark:border-white/10"
                >
                  <div
                    className={`flex items-center justify-between gap-3 ${!isExpanded ? 'cursor-pointer' : ''}`}
                    onClick={
                      !isExpanded
                        ? () => toggleSlotCollapse(slot.id)
                        : undefined
                    }
                    role={!isExpanded ? 'button' : undefined}
                    tabIndex={!isExpanded ? 0 : undefined}
                    onKeyDown={
                      !isExpanded
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleSlotCollapse(slot.id);
                            }
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? tr('Ahenda', 'Collapse') : tr('Laienda', 'Expand')}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSlotCollapse(slot.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                          />
                        </button>
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {getSlotDateLabel(slot)} • {slot.time}
                        </div>
                        <div className="text-xs text-slate-500">
                          {getSlotWeekdayLabel(slot)} • {slot.duration_minutes || 90} min • {tr('Max', 'Max')} {slot.max_spots} {tr('kohta', 'spots')}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 font-semibold">
                        {tr('Vabu', 'Free')}: {availability.available}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 font-semibold">
                        {tr('Püsikohti', 'Reserved')}: {availability.roster.length}/{maxSpots}
                      </span>
                      {slot.is_public && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 font-semibold">
                          {tr('Avalik', 'Public')}
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      {editingSlotId === slot.id && canManageTraining && editingSlot ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                      {editingSlot.date ? (
                        <input
                          type="date"
                          value={editingSlot.date}
                          onChange={(event) => setEditingSlot((prev) => ({ ...prev, date: event.target.value }))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                        />
                      ) : (
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
                      )}
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
                        placeholder={tr('Kohti', 'Spots')}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveSlot}
                          disabled={isSavingSlot}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white"
                        >
                          <Check className="w-3 h-3" /> {tr('Salvesta', 'Save')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSlot}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700"
                        >
                          <X className="w-3 h-3" /> {tr('Tühista', 'Cancel')}
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
                              {tr('Eemalda kuulutus', 'Remove announcement')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTogglePublicSlot(slot.id)}
                              disabled={!canAnnounce}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {tr('Kuuluta vaba koht', 'Announce free spot')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditingSlot(slot)}
                            className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            <Pencil className="w-3 h-3 inline-block mr-1" />
                            {tr('Muuda', 'Edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="w-3 h-3 inline-block mr-1" />
                            {tr('Kustuta', 'Delete')}
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
                              {isReleased
                                ? tr('Tulen siiski', 'I can make it')
                                : tr('Täna trenni ei jõua', 'Cannot make training today')}
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
                                <div className="text-[10px] uppercase text-slate-400">{tr('Püsikoht', 'Reserved')}</div>
                                <div className="text-sm font-semibold text-slate-800 truncate">{label}</div>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectMember(seat.uid, slot.id)}
                                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                                  >
                                    {isSelected ? tr('Valitud', 'Selected') : tr('Vali', 'Select')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRosterMember(slot.id, seat.uid)}
                                    className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                                  >
                                    {tr('Eemalda', 'Remove')}
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
                                  {tr('Eemalda', 'Remove')}
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
                              <div className="text-[10px] uppercase text-slate-400">{tr('Vaba', 'Free')}</div>
                              {releasedLabel && (
                                <div className="text-[10px] text-slate-400 mt-1 truncate">
                                  {tr('püsikoht', 'reserved')}: {releasedLabel}
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
                                <div className="text-[10px] uppercase text-slate-400">{tr('Püsikoht', 'Reserved')}</div>
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
                              <div className="text-[10px] uppercase text-slate-400">{tr('Vaba', 'Free')}</div>
                              {releasedLabel && (
                                <div className="text-[10px] text-slate-400 truncate">
                                  {tr('püsikoht', 'reserved')}: {releasedLabel}
                                </div>
                              )}
                              {canClaimSeat && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (canSecondSessionClaim) {
                                      handleSecondSessionClaim(slot.id);
                                      return;
                                    }
                                    handleSwapClaim(slot.id);
                                  }}
                                  className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white"
                                >
                                  {canSecondSessionClaim
                                    ? tr('Teen teise trenni järjest', 'Second session')
                                    : tr('Asendan koha', 'Claim spot')}
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
                          {tr('Lisa trenniline siia trenni', 'Add trainee to this training')}
                        </div>
                        <input
                          value={slotSearchValue}
                          onChange={(event) =>
                            setSlotSearch((prev) => ({ ...prev, [slot.id]: event.target.value }))
                          }
                          placeholder={tr('Otsi nime või e-posti', 'Search name or email')}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
                        />
                        <div className="mt-2 space-y-2">
                          {normalizedSlotSearch.length > 0 && normalizedSlotSearch.length < 2 && (
                            <div className="text-[11px] text-slate-500">
                              {tr('Sisesta vähemalt 2 tähte.', 'Enter at least 2 characters.')}
                            </div>
                          )}
                          {normalizedSlotSearch.length >= 2 && isLoadingUsers && (
                            <div className="text-[11px] text-slate-500">{tr('Laen kasutajaid...', 'Loading users...')}</div>
                          )}
                          {normalizedSlotSearch.length >= 2 && !isLoadingUsers && slotSearchResults.length === 0 && (
                            <div className="text-[11px] text-slate-500">{tr('Sobivaid kasutajaid ei leitud.', 'No matching users found.')}</div>
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
                                      {tr('Juba slotis', 'Already in slot')}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isAdding}
                                      onClick={() => handleAddRosterMember(slot.id, entry)}
                                      className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      {isAdding ? tr('Lisan...', 'Adding...') : tr('Lisa', 'Add')}
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
                          {tr('Ootelist', 'Pending')} ({pendingEntries.length})
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
                                    {tr('Püsikoha taotlus', 'Reserved spot request')}
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
                                  {tr('Kinnita', 'Approve')}
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
                                  {entry.kind === 'request' ? tr('Keeldu', 'Decline') : tr('Eemalda', 'Remove')}
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
              {sortedSlots.map((slot) => {
                const availability = attendanceBySlot(slot);
                const maxSpots = availability.maxSpots || Number(slot.max_spots) || 0;
                const attendance = getEffectiveSlotAttendance(group, weekKey, slot);
                const releasedSet = new Set(attendance.released_uids || []);
                const rosterIds = Array.isArray(slot.roster_uids) ? slot.roster_uids : [];
                const activeRosterIds = rosterIds.filter((uid) => !releasedSet.has(uid));
                const releasedRosterIds = rosterIds.filter((uid) => releasedSet.has(uid));
                const isRosterMember = rosterIds.includes(user?.id);
                const isReleased = releasedSet.has(user?.id);
                const isClaimedByUser = attendance.claimed_uids.includes(user?.id);
                const isRequestedByUser = attendance.request_uids.includes(user?.id);
                const isWaitlistedByUser = attendance.waitlist_uids.includes(user?.id);
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
                const canSecondSessionClaim = canMemberSwap && !hasReleasedOwnSpot;
                const canPoolClaimSeat = isPoolMemberOnly && availability.available > 0;
                const isCollapsed = collapsedSlots[slot.id] ?? false;
                const isExpanded = !isCollapsed;

                return (
                  <div
                    key={slot.id}
                    className="rounded-2xl border border-slate-100 bg-white px-3 py-3 dark:bg-black dark:border-white/10"
                  >
                    <div
                      className={`flex items-center justify-between gap-3 ${!isExpanded ? 'cursor-pointer' : ''}`}
                      onClick={
                        !isExpanded
                          ? () => toggleSlotCollapse(slot.id)
                          : undefined
                      }
                      role={!isExpanded ? 'button' : undefined}
                      tabIndex={!isExpanded ? 0 : undefined}
                      onKeyDown={
                        !isExpanded
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                toggleSlotCollapse(slot.id);
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-3 text-left">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? tr('Ahenda', 'Collapse') : tr('Laienda', 'Expand')}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSlotCollapse(slot.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                            />
                          </button>
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {getSlotDateLabel(slot)} • {slot.time}
                          </div>
                          <div className="text-xs text-slate-500">
                            {getSlotWeekdayLabel(slot)} • {slot.duration_minutes || 90} min • Max {slot.max_spots} kohta
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 font-semibold">
                          {tr('Vabu', 'Free')}: {availability.available}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 font-semibold">
                          {tr('Püsikohti', 'Reserved')}: {availability.roster.length}/{maxSpots}
                        </span>
                        {slot.is_public && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 font-semibold">
                            {tr('Avalik', 'Public')}
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
                              {isReleased
                                ? tr('Tulen siiski', 'I can make it')
                                : tr('Täna trenni ei jõua', 'Cannot make training today')}
                            </button>
                          )}
                          {!isRosterMember && isClaimedByUser && (
                            <button
                              type="button"
                              disabled={isUpdatingAttendance[slot.id]}
                              onClick={() => handleLeaveClaimedSpot(slot.id)}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700"
                            >
                              {tr('Loobu 1x kohast', 'Cancel one-time spot')}
                            </button>
                          )}
                          {!isRosterMember && canPoolClaimSeat && !isClaimedByUser && (
                            <button
                              type="button"
                              disabled={isUpdatingAttendance[slot.id]}
                              onClick={() => handlePoolSpotClaim(slot.id)}
                              className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white"
                            >
                              {tr('Broneeri 1x koht', 'Book one-time spot')}
                            </button>
                          )}
                          {!isRosterMember && !isClaimedByUser && isRequestedByUser && !canPoolClaimSeat && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                              {tr('Ootab kinnitust', 'Waiting for approval')}
                            </span>
                          )}
                          {!isRosterMember && !isClaimedByUser && isWaitlistedByUser && availability.available === 0 && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                              {tr('Ootelistus', 'On waitlist')}
                            </span>
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
                                  <div className="text-[10px] uppercase text-slate-400">{tr('Püsikoht', 'Reserved')}</div>
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
                                <div className="text-[10px] uppercase text-slate-400">{tr('Vaba', 'Free')}</div>
                                {releasedLabel && (
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {tr('püsikoht', 'reserved')}: {releasedLabel}
                                  </div>
                                )}
                                {canClaimSeat && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (canSecondSessionClaim) {
                                        handleSecondSessionClaim(slot.id);
                                        return;
                                      }
                                      handleSwapClaim(slot.id);
                                    }}
                                    className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white"
                                  >
                                    {canSecondSessionClaim
                                      ? tr('Teen teise trenni järjest', 'Second session')
                                      : tr('Asendan koha', 'Claim spot')}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {pendingEntries.length > 0 && (
                          <div className="mt-3 text-[11px] text-slate-500">
                            {tr('Ootelist', 'Pending')}: {pendingEntries.length}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {!canManageTraining && (
          <div className="mb-6 rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">{tr('Välitrennid', 'Outdoor trainings')}</div>
                <div className="text-xs text-slate-500">
                  {tr('Broneeri ühekorra välitrennid siit grupi seest. Võid võtta mitu tulevast välitrenni.', 'Book one-time outdoor trainings here inside the group. You can book multiple upcoming special events.')}
                </div>
              </div>
            </div>

            {upcomingSpecialEvents.length === 0 ? (
              <div className="text-sm text-slate-500">{tr('Tulevasi välitrenne pole hetkel lisatud.', 'No upcoming outdoor trainings added right now.')}</div>
            ) : (
              <div className="space-y-3">
                {upcomingSpecialEvents.map((event) => {
                  const availability = getSpecialEventAvailability(event);
                  const isBooked = availability.booked.includes(user?.id);
                  const isPoolMember = isGroupPoolMember(group, user?.id, { knownMember: isGroupMember });
                  const bookedEntries = availability.booked.map((uid) => ({
                    uid,
                    meta: availability.bookedMeta?.[uid] || null
                  }));

                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {event.title || tr('Välitrenn', 'Outdoor training')}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {formatSpecialEventLabel(event)} • {event.duration_minutes || 90} min
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {tr('Vabu kohti', 'Free spots')}: {availability.available} • {tr('Broneeritud', 'Booked')}: {availability.booked.length}/{availability.maxSpots}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isBooked ? (
                            <button
                              type="button"
                              onClick={() => handleCancelOwnSpecialEvent(event)}
                              disabled={specialEventAction[event.id]}
                              className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {specialEventAction[event.id] ? tr('Eemaldan...', 'Removing...') : tr('Loobu kohast', 'Cancel spot')}
                            </button>
                          ) : !isPoolMember ? (
                            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                              {tr('Ainult pooli liikmetele', 'Only for pool members')}
                            </span>
                          ) : availability.isFull ? (
                            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                              {tr('Täis', 'Full')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBookOwnSpecialEvent(event)}
                              disabled={specialEventAction[event.id]}
                              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {specialEventAction[event.id] ? tr('Broneerin...', 'Booking...') : tr('Broneeri koht', 'Book spot')}
                            </button>
                          )}
                          {isBooked && (
                            <span className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {tr('Sinu broneering', 'Your booking')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        {bookedEntries.length === 0 ? (
                          <div className="text-xs text-slate-500">{tr('Broneeringuid veel pole.', 'No bookings yet.')}</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {bookedEntries.map((entry) => (
                              <div
                                key={`${event.id}-${entry.uid}`}
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800"
                              >
                                <div className="text-[10px] uppercase text-emerald-600">{tr('Broneeritud', 'Booked')}</div>
                                <div className="text-sm font-semibold truncate">{getMemberLabel(entry.uid, entry.meta)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {canManageTraining && (
          <div className="mb-6 rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">{tr('Eraldi välitrennid / erisündmused', 'Separate outdoor trainings / special events')}</div>
                <div className="text-xs text-slate-500">
                  {tr('Kasuta ainult üksikute erisündmuste jaoks. Need ei ole tavalised põhitrenni slotid.', 'Use this only for one-off special events. These are not regular training slots.')}
                </div>
              </div>
              {pastSpecialEventsCount > 0 && (
                <div className="text-[11px] text-slate-400">
                  {tr('Möödunud sündmused ei mõjuta enam pooli', 'Past events no longer affect the pool')}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                    {tr('Vali kuupäevad', 'Pick dates')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewSpecialEvent((prev) => ({ ...prev, selectedDates: [] }))}
                    disabled={!newSpecialEvent.selectedDates?.length}
                    className="text-xs font-semibold text-slate-500 disabled:opacity-40"
                  >
                    {tr('Puhasta', 'Clear')}
                  </button>
                </div>
                <MultiDatePicker
                  month={specialEventPickerMonth}
                  onMonthChange={setSpecialEventPickerMonth}
                  selectedDates={newSpecialEvent.selectedDates}
                  onToggleDate={(dateValue) => {
                    setNewSpecialEvent((prev) => {
                      const selected = new Set(prev.selectedDates || []);
                      if (selected.has(dateValue)) {
                        selected.delete(dateValue);
                      } else {
                        selected.add(dateValue);
                      }
                      return { ...prev, selectedDates: Array.from(selected).sort() };
                    });
                  }}
                  lang={lang}
                />
                {newSpecialEvent.selectedDates?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {newSpecialEvent.selectedDates.map((dateValue) => (
                      <span
                        key={dateValue}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700"
                      >
                        {format(parseISO(dateValue), 'dd.MM')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3 md:col-span-3">
                <div className="text-xs text-slate-400">
                  {tr('Iga valitud kuupäev luuakse eraldi ühekorra välitrennina.', 'Each selected date becomes a separate one-time special event.')}
                </div>
                <input
                  type="text"
                  value={newSpecialEvent.title}
                  onChange={(event) => setNewSpecialEvent((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={tr('Erisündmuse nimi', 'Special event name')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                />
                <input
                  type="time"
                  value={newSpecialEvent.time}
                  onChange={(event) => setNewSpecialEvent((prev) => ({ ...prev, time: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                />
                <input
                  type="number"
                  min={1}
                  value={newSpecialEvent.maxSpots}
                  onChange={(event) => setNewSpecialEvent((prev) => ({ ...prev, maxSpots: event.target.value }))}
                  placeholder={tr('Kohti', 'Spots')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                />
                <input
                  type="number"
                  min={30}
                  step={15}
                  value={newSpecialEvent.duration}
                  onChange={(event) => setNewSpecialEvent((prev) => ({ ...prev, duration: event.target.value }))}
                  placeholder={tr('Kestus minutites', 'Duration in minutes')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={handleCreateSpecialEvent}
                  disabled={isSavingSpecialEvent}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="w-3 h-3" />
                  {isSavingSpecialEvent ? tr('Lisan...', 'Adding...') : tr('Lisa valitud välitrennid', 'Add selected special events')}
                </button>
              </div>
            </div>

            {upcomingSpecialEvents.length === 0 ? (
              <div className="text-sm text-slate-500">{tr('Eraldi välitrenne või erisündmusi pole veel lisatud.', 'No separate outdoor trainings or special events added yet.')}</div>
            ) : (
              <div className="space-y-3">
                {upcomingSpecialEvents.map((event) => {
                  const availability = getSpecialEventAvailability(event);
                  const bookedEntries = availability.booked.map((uid) => ({
                    uid,
                    meta: availability.bookedMeta?.[uid] || null
                  }));

                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {event.title || tr('Välitrenn', 'Special event')}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {formatSpecialEventLabel(event)} • {event.duration_minutes || 90} min
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            {tr('Vabu', 'Free')}: {availability.available}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {tr('Broneeritud', 'Booked')}: {availability.booked.length}/{availability.maxSpots}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSpecialEvent(event.id)}
                            disabled={removingSpecialEventId === event.id}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60"
                          >
                            <Trash2 className="w-3 h-3 inline-block mr-1" />
                            {removingSpecialEventId === event.id ? tr('Kustutan...', 'Deleting...') : tr('Kustuta', 'Delete')}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        {bookedEntries.length === 0 ? (
                          <div className="text-xs text-slate-500">{tr('Broneeringuid veel pole.', 'No bookings yet.')}</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {bookedEntries.map((entry) => (
                              <div
                                key={`${event.id}-${entry.uid}`}
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800"
                              >
                                <div className="text-[10px] uppercase text-emerald-600">{tr('Broneeritud', 'Booked')}</div>
                                <div className="text-sm font-semibold truncate">{getMemberLabel(entry.uid, entry.meta)}</div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSpecialEventBooking(event.id, entry.uid)}
                                  className="mt-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                                >
                                  {tr('Eemalda', 'Remove')}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {canViewGroup && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-slate-800">{tr('Aktiivsed trennimängud', 'Active training games')}</div>
              <span className="text-xs text-slate-400">{tr(`${activeGames.length} mängu`, `${activeGames.length} games`)}</span>
            </div>
            {activeGames.length === 0 ? (
              <div className="text-sm text-slate-500">{tr('Aktiivseid mänge pole.', 'No active games.')}</div>
            ) : (
              <div className="space-y-2">
                {activeGames.map((game) => {
                  const format = GAME_FORMATS[game.game_type] || {};
                  return (
                    <div
                      key={game.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 dark:bg-black dark:border-white/10"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{game.name}</div>
                        <div className="text-xs text-slate-500">
                          {t(`format.${game.game_type}.name`, format.name || game.game_type)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          PIN: {game.pin}
                        </div>
                        <button
                          type="button"
                          onClick={() => joinTrainingGame(game)}
                          disabled={joiningGameId === game.id}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60 dark:bg-black dark:border-white/10 dark:text-emerald-300"
                        >
                          {joiningGameId === game.id ? tr('Liitun...', 'Joining...') : tr('Liitu', 'Join')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-slate-800">{tr('Top mängijad', 'Top players')}</div>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            {topPlayers.length === 0 ? (
              <div className="text-sm text-slate-500">{tr('Tulemusi pole veel.', 'No results yet.')}</div>
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
              <div className="text-sm font-semibold text-slate-800">{tr('Viimased mängud', 'Recent games')}</div>
              <span className="text-xs text-slate-400">{tr(`${games.length} kokku`, `${games.length} total`)}</span>
            </div>
            {recentGames.length === 0 ? (
              <div className="text-sm text-slate-500">{tr('Mänge pole veel.', 'No games yet.')}</div>
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
                        <div className="text-xs text-slate-500">
                          {t(`format.${game.game_type}.name`, format.name || game.game_type)}
                        </div>
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

        {canManageTraining && (
          <div className="mt-6 rounded-[22px] border border-slate-100 bg-white px-4 py-4 dark:bg-black dark:border-white/10">
            <div className="text-xs font-semibold text-slate-500 mb-1">{tr('Lisa põhitrennid kalendrisse', 'Add primary trainings to calendar')}</div>
            <div className="mb-3 text-xs text-slate-400">
              {tr('Vali kuupäevad, millele tahad tavalise trennikohaga sessioonid luua.', 'Pick the dates where you want standard training sessions with spots.')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <CalendarDays className="h-4 w-4 text-emerald-600" />
                      {tr('Vali kuupäevad', 'Pick dates')}
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewSlot((prev) => ({ ...prev, selectedDates: [] }))}
                      disabled={!newSlot.selectedDates?.length}
                      className="text-xs font-semibold text-slate-500 disabled:opacity-40"
                    >
                      {tr('Puhasta', 'Clear')}
                    </button>
                  </div>
                  <MultiDatePicker
                    month={slotPickerMonth}
                    onMonthChange={setSlotPickerMonth}
                    selectedDates={newSlot.selectedDates}
                    onToggleDate={(dateValue) => {
                      setNewSlot((prev) => {
                        const selected = new Set(prev.selectedDates || []);
                        if (selected.has(dateValue)) {
                          selected.delete(dateValue);
                        } else {
                          selected.add(dateValue);
                        }
                        return { ...prev, selectedDates: Array.from(selected).sort() };
                      });
                    }}
                    lang={lang}
                  />
                  {newSlot.selectedDates?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {newSlot.selectedDates.map((dateValue) => (
                        <span
                          key={dateValue}
                          className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700"
                        >
                          {format(parseISO(dateValue), 'dd.MM')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3 md:col-span-2">
                  <input
                    type="time"
                    value={newSlot.time}
                    onChange={(event) => setNewSlot((prev) => ({ ...prev, time: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newSlot.maxSpots}
                    onChange={(event) => setNewSlot((prev) => ({ ...prev, maxSpots: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                    placeholder={tr('Kohti', 'Spots')}
                  />
                  <input
                    type="number"
                    min={30}
                    step={15}
                    value={newSlot.duration}
                    onChange={(event) => setNewSlot((prev) => ({ ...prev, duration: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:bg-black dark:border-white/10"
                    placeholder={tr('Kestus minutites', 'Duration in minutes')}
                  />
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    disabled={isSavingSlot}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    <Plus className="w-3 h-3" /> {tr('Lisa valitud kuupäevad', 'Add selected dates')}
                  </button>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
