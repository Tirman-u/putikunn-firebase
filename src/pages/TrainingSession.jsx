import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { format } from 'date-fns';
import { Calendar, Plus, Timer, ClipboardList } from 'lucide-react';
import { db } from '@/lib/firebase';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSlotAttendance, getWeekKey } from '@/lib/training-utils';
import {
  SCORE_DIRECTIONS,
  computeRankCutPoints,
  computeHcPoints,
  formatSlotLabel,
  getCutCount,
  getParticipantId,
  isScoreBetter,
  round1
} from '@/lib/training-league';
import { getLeaderboardStats } from '@/lib/leaderboard-utils';
import { toast } from 'sonner';

const getGamePlayers = (game) => {
  const players = new Set();
  (game?.players || []).forEach((name) => players.add(name));
  Object.keys(game?.total_points || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_uids || {}).forEach((name) => players.add(name));
  return Array.from(players).filter(Boolean);
};

export default function TrainingSession() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const dateKeyParam = searchParams.get('dateKey') || '';
  const queryClient = useQueryClient();

  const [appPin, setAppPin] = React.useState('');
  const [appName, setAppName] = React.useState('');
  const [appLowerIsBetter, setAppLowerIsBetter] = React.useState(false);
  const [offlineName, setOfflineName] = React.useState('');
  const [offlineMode, setOfflineMode] = React.useState('points');
  const [offlinePoints, setOfflinePoints] = React.useState({});
  const [offlineRanks, setOfflineRanks] = React.useState({});
  const [offlineCutPercent, setOfflineCutPercent] = React.useState(70);
  const [offlineCutBonus, setOfflineCutBonus] = React.useState(0.3);
  const [isSavingApp, setIsSavingApp] = React.useState(false);
  const [isSavingOffline, setIsSavingOffline] = React.useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = React.useState({});
  const [mode, setMode] = React.useState('app');
  const [applyAppToSameDate, setApplyAppToSameDate] = React.useState(true);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const { data: session } = useQuery({
    queryKey: ['training-session', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'training_sessions', sessionId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    staleTime: 30000
  });

  const { data: season } = useQuery({
    queryKey: ['training-season', session?.season_id],
    enabled: !!session?.season_id,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'training_seasons', session.season_id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    staleTime: 30000
  });

  const { data: group } = useQuery({
    queryKey: ['training-group', season?.group_id],
    enabled: !!season?.group_id,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'training_groups', season.group_id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    staleTime: 30000
  });

  const { data: events = [] } = useQuery({
    queryKey: ['training-events', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const q = query(
        collection(db, 'training_events'),
        where('session_id', '==', sessionId)
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 5000
  });

  const { data: seasonEvents = [] } = useQuery({
    queryKey: ['training-events-season', season?.id],
    enabled: !!season?.id,
    queryFn: async () => {
      const q = query(
        collection(db, 'training_events'),
        where('season_id', '==', season.id)
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 5000
  });

  const { data: results = [] } = useQuery({
    queryKey: ['training-event-results', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const q = query(
        collection(db, 'training_event_results'),
        where('session_id', '==', sessionId)
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 5000
  });

  const { data: stats = [] } = useQuery({
    queryKey: ['training-season-stats', season?.id],
    enabled: !!season?.id,
    queryFn: async () => {
      const q = query(
        collection(db, 'training_season_stats'),
        where('season_id', '==', season.id)
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 5000
  });

  const { data: seasonSessions = [] } = useQuery({
    queryKey: ['training-sessions-all', season?.id],
    enabled: !!season?.id,
    queryFn: async () => {
      const q = query(collection(db, 'training_sessions'), where('season_id', '==', season.id));
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 10000
  });

  const statsByParticipant = React.useMemo(() => {
    const map = {};
    stats.forEach((entry) => {
      map[entry.participant_id] = entry;
    });
    return map;
  }, [stats]);

  const members = React.useMemo(() => {
    const map = group?.members || {};
    return Object.entries(map).map(([uid, info]) => ({ uid, ...info }));
  }, [group?.members]);

  const membersByEmail = React.useMemo(() => {
    const map = {};
    members.forEach((member) => {
      if (member?.email) {
        map[member.email.trim().toLowerCase()] = member;
      }
    });
    return map;
  }, [members]);

  const membersByUid = React.useMemo(() => {
    const map = {};
    members.forEach((member) => {
      if (member?.uid) {
        map[member.uid] = member;
      }
    });
    return map;
  }, [members]);

  const slot = React.useMemo(() => {
    if (!group?.slots || !session?.slot_id) return null;
    return group.slots.find((item) => item.id === session.slot_id) || null;
  }, [group?.slots, session?.slot_id]);

  const slotById = React.useMemo(() => {
    const map = {};
    (group?.slots || []).forEach((slotItem) => {
      if (slotItem?.id) {
        map[slotItem.id] = slotItem;
      }
    });
    return map;
  }, [group?.slots]);

  const sessionWeekKey = React.useMemo(() => {
    if (session?.date) {
      return getWeekKey(new Date(session.date));
    }
    return getWeekKey();
  }, [session?.date]);

  const slotAttendance = React.useMemo(() => {
    if (!group || !session?.slot_id) return {};
    return getSlotAttendance(group, sessionWeekKey, session.slot_id) || {};
  }, [group, session?.slot_id, sessionWeekKey]);

  const slotMemberIds = React.useMemo(() => {
    const roster = Array.isArray(slot?.roster_uids) ? slot.roster_uids : [];
    const claimed = Array.isArray(slotAttendance?.claimed_uids) ? slotAttendance.claimed_uids : [];
    return Array.from(new Set([...roster, ...claimed]));
  }, [slot?.roster_uids, slotAttendance?.claimed_uids]);

  const filteredMembers = React.useMemo(() => {
    if (!slotMemberIds.length) return members;
    return members.filter((member) => slotMemberIds.includes(member.uid));
  }, [members, slotMemberIds]);

  const { data: groupGames = [], isLoading: isLoadingGroupGames } = useQuery({
    queryKey: ['training-group-games-list', season?.group_id],
    enabled: Boolean(season?.group_id && canManageTraining),
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ training_group_id: season.group_id }, '-date', 20);
      return games;
    },
    staleTime: 15000
  });

  const resultsByEvent = React.useMemo(() => {
    const map = {};
    results.forEach((entry) => {
      if (!map[entry.event_id]) map[entry.event_id] = [];
      map[entry.event_id].push(entry);
    });
    return map;
  }, [results]);

  const getSessionDateKey = React.useCallback((value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, []);

  const daySessions = React.useMemo(() => {
    if (!session?.id) return [];
    const targetDateKey = dateKeyParam || getSessionDateKey(session.date);
    if (!targetDateKey) return [session];
    const matches = seasonSessions
      .filter((entry) => getSessionDateKey(entry.date) === targetDateKey)
      .sort((a, b) => {
        const labelA = formatSlotLabel(slotById[a.slot_id]);
        const labelB = formatSlotLabel(slotById[b.slot_id]);
        return labelA.localeCompare(labelB);
      });
    return matches.length > 0 ? matches : [session];
  }, [dateKeyParam, getSessionDateKey, seasonSessions, session, slotById]);

  const isDayGroupedView = daySessions.length > 1 || Boolean(dateKeyParam);

  const appTargetSessions = React.useMemo(() => {
    if (!session?.id) return [];
    if (isDayGroupedView) {
      return daySessions;
    }
    if (!applyAppToSameDate) return [session];
    const dayKey = getSessionDateKey(session.date);
    if (!dayKey) return [session];
    const matches = seasonSessions.filter((entry) => getSessionDateKey(entry.date) === dayKey);
    return matches.length > 0 ? matches : [session];
  }, [isDayGroupedView, daySessions, session, applyAppToSameDate, getSessionDateKey, seasonSessions]);

  const daySlotLabels = React.useMemo(() => (
    daySessions
      .map((entry) => formatSlotLabel(slotById[entry.slot_id]))
      .filter(Boolean)
  ), [daySessions, slotById]);

  const offlineRankEntries = React.useMemo(() => (
    Object.entries(offlineRanks)
      .map(([uid, value]) => ({ uid, rank: Number(value) }))
      .filter((entry) => Number.isFinite(entry.rank) && entry.rank > 0)
  ), [offlineRanks]);

  const offlineParticipantsCount = offlineRankEntries.length;
  const offlineCutPercentValue = Math.min(100, Math.max(0, Number(offlineCutPercent) || 0));
  const offlineCutBonusValue = Math.max(0, Number(offlineCutBonus) || 0);
  const offlineCutCount = getCutCount({
    participantsCount: offlineParticipantsCount,
    cutPercent: offlineCutPercentValue
  });

  const createAppEventFromGame = async (game, options = {}) => {
    const targetSession = options.session || session;
    const existingEvents = Array.isArray(options.existingEvents) ? options.existingEvents : events;
    if (!targetSession || !season || !group) {
      return { ok: false, message: 'Treeningu andmed puuduvad' };
    }
    if (!game?.id) {
      return { ok: false, message: 'Mäng puudub' };
    }
    const existingEvent = existingEvents.find((entry) => entry?.source_game_id === game.id);
    if (existingEvent) {
      return { ok: false, message: 'See mäng on juba lisatud' };
    }
    const players = getGamePlayers(game);
    if (players.length === 0) {
      return { ok: false, message: 'Mängijalist tühi' };
    }

    const metricKey = game.game_type || 'unknown';
    const scoreDirection = appLowerIsBetter ? SCORE_DIRECTIONS.LOWER : SCORE_DIRECTIONS.HIGHER;
    const eventName = appName.trim() || game.name || metricKey;

    const batch = writeBatch(db);
    const eventRef = doc(collection(db, 'training_events'));
    batch.set(eventRef, {
      session_id: targetSession.id,
      season_id: season.id,
      group_id: season.group_id,
      slot_id: targetSession.slot_id,
      type: 'app',
      name: eventName,
      metric_key: metricKey,
      score_direction: scoreDirection,
      source_game_id: game.id,
      created_by_uid: user?.id || null,
      created_at: serverTimestamp()
    });

    players.forEach((playerName) => {
      const stats = getLeaderboardStats(game, playerName);
      const score = stats?.score ?? 0;
      const uid = game?.player_uids?.[playerName];
      const email = game?.player_emails?.[playerName];
      const memberByUid = uid ? membersByUid[uid] : null;
      const memberByEmail = email ? membersByEmail[email.trim().toLowerCase()] : null;
      const displayName = memberByUid?.name || memberByEmail?.name || playerName;
      const participantId = getParticipantId({ uid, email, name: displayName });
      const existing = statsByParticipant[participantId];
      const seasonBest = existing?.best_by_metric?.[metricKey];
      const { hc, hcBonus, points } = computeHcPoints({
        score,
        seasonBest,
        direction: scoreDirection
      });

      const shouldUpdateBest = isScoreBetter({
        score,
        best: seasonBest,
        direction: scoreDirection
      });
      const nextBestByMetric = {
        ...(existing?.best_by_metric || {}),
        ...(shouldUpdateBest ? { [metricKey]: score } : {})
      };

      const nextPointsBySlot = {
        ...(existing?.points_by_slot || {}),
        [targetSession.slot_id]: round1((existing?.points_by_slot?.[targetSession.slot_id] || 0) + points)
      };

      const nextStats = {
        season_id: season.id,
        participant_id: participantId,
        user_id: uid || memberByEmail?.uid || null,
        player_name: displayName,
        points_total: round1((existing?.points_total || 0) + points),
        attendance_count: (existing?.attendance_count || 0) + 1,
        points_by_slot: nextPointsBySlot,
        best_by_metric: nextBestByMetric,
        updated_at: new Date().toISOString()
      };

      const resultRef = doc(collection(db, 'training_event_results'));
      batch.set(resultRef, {
        event_id: eventRef.id,
        session_id: targetSession.id,
        season_id: season.id,
        group_id: season.group_id,
        slot_id: targetSession.slot_id,
        participant_id: participantId,
        user_id: uid || memberByEmail?.uid || null,
        player_name: displayName,
        score,
        hc,
        hc_bonus: hcBonus,
        points,
        created_at: serverTimestamp()
      });

      const statsRef = doc(db, 'training_season_stats', `${season.id}_${participantId}`);
      batch.set(statsRef, nextStats, { merge: true });
    });

    await batch.commit();
    return { ok: true, sessionId: targetSession.id };
  };

  const applyAppGameToTargetSessions = async (game) => {
    const targets = appTargetSessions.length > 0 ? appTargetSessions : [session];
    const outcomes = [];

    for (const targetSession of targets) {
      const existingForSession = seasonEvents.filter((entry) => entry.session_id === targetSession.id);
      // Write each session separately so partial success still works if one target fails.
      // This keeps coach workflow resilient for bulk add.
      const result = await createAppEventFromGame(game, {
        session: targetSession,
        existingEvents: existingForSession
      });
      outcomes.push({
        sessionId: targetSession.id,
        slotId: targetSession.slot_id,
        ...result
      });
    }

    const added = outcomes.filter((item) => item.ok).length;
    const skipped = outcomes.filter((item) => !item.ok).length;
    return { added, skipped, outcomes };
  };

  const handleCreateAppEvent = async () => {
    const cleanedPin = appPin.replace(/\D/g, '').slice(0, 4);
    if (cleanedPin.length !== 4) {
      toast.error('Sisesta 4-kohaline PIN');
      return;
    }
    if (!session || !season || !group) return;
    setIsSavingApp(true);
    try {
      const games = await base44.entities.Game.filter({ pin: cleanedPin }, '-date', 1);
      if (!games?.length) {
        toast.error('Mängu ei leitud');
        return;
      }
      const summary = await applyAppGameToTargetSessions(games[0]);
      if (summary.added === 0) {
        const firstError = summary.outcomes.find((entry) => !entry.ok)?.message;
        toast.error(firstError || 'Eventi lisamine ebaõnnestus');
        return;
      }
      setAppPin('');
      setAppName('');
      setAppLowerIsBetter(false);
      queryClient.invalidateQueries({ queryKey: ['training-events'] });
      queryClient.invalidateQueries({ queryKey: ['training-events-season', season?.id] });
      queryClient.invalidateQueries({ queryKey: ['training-event-results'] });
      queryClient.invalidateQueries({ queryKey: ['training-season-stats', season?.id] });
      if (summary.skipped > 0) {
        toast.success(`Event lisatud ${summary.added} trenni, vahele jäetud ${summary.skipped}`);
      } else {
        toast.success(summary.added > 1 ? `Event lisatud ${summary.added} trenni` : 'Event lisatud');
      }
    } catch (error) {
      toast.error(error?.message || 'Eventi lisamine ebaõnnestus');
    } finally {
      setIsSavingApp(false);
    }
  };

  const handleAddGroupGame = async (game) => {
    if (!session || !season || !group) return;
    setIsSavingApp(true);
    try {
      const summary = await applyAppGameToTargetSessions(game);
      if (summary.added === 0) {
        const firstError = summary.outcomes.find((entry) => !entry.ok)?.message;
        toast.error(firstError || 'Eventi lisamine ebaõnnestus');
        return;
      }
      setAppName('');
      queryClient.invalidateQueries({ queryKey: ['training-events'] });
      queryClient.invalidateQueries({ queryKey: ['training-events-season', season?.id] });
      queryClient.invalidateQueries({ queryKey: ['training-event-results'] });
      queryClient.invalidateQueries({ queryKey: ['training-season-stats', season?.id] });
      if (summary.skipped > 0) {
        toast.success(`Event lisatud ${summary.added} trenni, vahele jäetud ${summary.skipped}`);
      } else {
        toast.success(summary.added > 1 ? `Event lisatud ${summary.added} trenni` : 'Event lisatud');
      }
    } catch (error) {
      toast.error(error?.message || 'Eventi lisamine ebaõnnestus');
    } finally {
      setIsSavingApp(false);
    }
  };

  const handleCreateOfflineEvent = async () => {
    if (!session || !season) return;
    setIsSavingOffline(true);
    try {
      const eventName = offlineName.trim() || 'Offline';
      if (offlineMode === 'rank_hc') {
        const entries = offlineRankEntries;
        if (entries.length === 0) {
          toast.error('Sisesta vähemalt üks koht');
          return;
        }
        const maxRank = Math.max(...entries.map((entry) => entry.rank));
        if (maxRank > offlineParticipantsCount) {
          toast.error('Koht ei saa olla suurem kui märgitud tulemuste arv');
          return;
        }

        const batch = writeBatch(db);
        const eventRef = doc(collection(db, 'training_events'));
        batch.set(eventRef, {
          session_id: session.id,
          season_id: season.id,
          group_id: season.group_id,
          slot_id: session.slot_id,
          type: 'offline',
          name: eventName,
          metric_key: 'offline',
          score_direction: SCORE_DIRECTIONS.HIGHER,
          offline_mode: 'rank_hc',
          participants_count: offlineParticipantsCount,
          cut_percent: offlineCutPercentValue,
          cut_bonus: offlineCutBonusValue,
          created_by_uid: user?.id || null,
          created_at: serverTimestamp()
        });

        entries.forEach(({ uid, rank }) => {
          const member = membersByUid[uid];
          const displayName = member?.name || member?.email || 'Mängija';
          const participantId = getParticipantId({ uid, email: member?.email, name: displayName });
          const existing = statsByParticipant[participantId];
          const { cutBonus: bonus, points } = computeRankCutPoints({
            rank,
            participantsCount: offlineParticipantsCount,
            cutPercent: offlineCutPercentValue,
            bonusStep: offlineCutBonusValue
          });
          const nextPointsBySlot = {
            ...(existing?.points_by_slot || {}),
            [session.slot_id]: round1((existing?.points_by_slot?.[session.slot_id] || 0) + points)
          };
          const nextStats = {
            season_id: season.id,
            participant_id: participantId,
            user_id: uid,
            player_name: displayName,
            points_total: round1((existing?.points_total || 0) + points),
            attendance_count: (existing?.attendance_count || 0) + 1,
            points_by_slot: nextPointsBySlot,
            updated_at: new Date().toISOString()
          };

          const resultRef = doc(collection(db, 'training_event_results'));
          batch.set(resultRef, {
            event_id: eventRef.id,
            session_id: session.id,
            season_id: season.id,
            group_id: season.group_id,
            slot_id: session.slot_id,
            participant_id: participantId,
            user_id: uid,
            player_name: displayName,
            rank,
            cut_bonus: round1(bonus),
            points,
            created_at: serverTimestamp()
          });

          const statsRef = doc(db, 'training_season_stats', `${season.id}_${participantId}`);
          batch.set(statsRef, nextStats, { merge: true });
        });

        await batch.commit();
        setOfflineName('');
        setOfflineRanks({});
      } else {
        const entries = Object.entries(offlinePoints)
          .map(([uid, value]) => ({ uid, points: Number(value) }))
          .filter((entry) => Number.isFinite(entry.points));
        if (entries.length === 0) {
          toast.error('Sisesta vähemalt üks punktisumma');
          return;
        }

        const batch = writeBatch(db);
        const eventRef = doc(collection(db, 'training_events'));
        batch.set(eventRef, {
          session_id: session.id,
          season_id: season.id,
          group_id: season.group_id,
          slot_id: session.slot_id,
          type: 'offline',
          name: eventName,
          metric_key: 'offline',
          score_direction: SCORE_DIRECTIONS.HIGHER,
          offline_mode: 'points',
          participants_count: entries.length,
          created_by_uid: user?.id || null,
          created_at: serverTimestamp()
        });

        entries.forEach(({ uid, points }) => {
          const member = membersByUid[uid];
          const displayName = member?.name || member?.email || 'Mängija';
          const participantId = getParticipantId({ uid, email: member?.email, name: displayName });
          const existing = statsByParticipant[participantId];
          const nextPointsBySlot = {
            ...(existing?.points_by_slot || {}),
            [session.slot_id]: round1((existing?.points_by_slot?.[session.slot_id] || 0) + points)
          };
          const nextStats = {
            season_id: season.id,
            participant_id: participantId,
            user_id: uid,
            player_name: displayName,
            points_total: round1((existing?.points_total || 0) + points),
            attendance_count: (existing?.attendance_count || 0) + 1,
            points_by_slot: nextPointsBySlot,
            updated_at: new Date().toISOString()
          };

          const resultRef = doc(collection(db, 'training_event_results'));
          batch.set(resultRef, {
            event_id: eventRef.id,
            session_id: session.id,
            season_id: season.id,
            group_id: season.group_id,
            slot_id: session.slot_id,
            participant_id: participantId,
            user_id: uid,
            player_name: displayName,
            points: round1(points),
            created_at: serverTimestamp()
          });

          const statsRef = doc(db, 'training_season_stats', `${season.id}_${participantId}`);
          batch.set(statsRef, nextStats, { merge: true });
        });

        await batch.commit();
        setOfflineName('');
        setOfflinePoints({});
      }
      queryClient.invalidateQueries({ queryKey: ['training-events', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['training-event-results', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['training-season-stats', season?.id] });
      toast.success('Offline event lisatud');
    } catch (error) {
      toast.error(error?.message || 'Offline eventi lisamine ebaõnnestus');
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleDeleteEvent = async (event) => {
    if (!event?.id || !season?.id) return;
    if (!canManageTraining) {
      toast.error('Pole treeneri õigusi');
      return;
    }
    const confirmed = window.confirm(`Kustuta event "${event.name}"?`);
    if (!confirmed) return;
    setIsDeletingEvent((prev) => ({ ...prev, [event.id]: true }));
    try {
      const eventResults = resultsByEvent[event.id] || [];
      if (eventResults.length > 0) {
        const statsUpdates = {};
        eventResults.forEach((entry) => {
          const participantId = entry.participant_id;
          if (!participantId) return;
          const existing = statsByParticipant[participantId];
          if (!existing) return;
          const deduction = Number(entry.points || 0);
          const currentSlotPoints = Number(existing.points_by_slot?.[session?.slot_id] || 0);
          const nextSlotPoints = round1(Math.max(0, currentSlotPoints - deduction));
          const nextTotal = round1(Math.max(0, Number(existing.points_total || 0) - deduction));
          const nextAttendance = Math.max(0, (existing.attendance_count || 0) - 1);
          statsUpdates[participantId] = {
            points_total: nextTotal,
            attendance_count: nextAttendance,
            points_by_slot: {
              ...(existing.points_by_slot || {}),
              [session?.slot_id]: nextSlotPoints
            },
            updated_at: new Date().toISOString()
          };
        });

        const batch = writeBatch(db);
        eventResults.forEach((entry) => {
          batch.delete(doc(db, 'training_event_results', entry.id));
        });
        Object.entries(statsUpdates).forEach(([participantId, payload]) => {
          const statsRef = doc(db, 'training_season_stats', `${season.id}_${participantId}`);
          batch.set(statsRef, payload, { merge: true });
        });
        batch.delete(doc(db, 'training_events', event.id));
        await batch.commit();
      } else {
        await writeBatch(db)
          .delete(doc(db, 'training_events', event.id))
          .commit();
      }

      queryClient.invalidateQueries({ queryKey: ['training-events', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['training-event-results', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['training-season-stats', season?.id] });
      toast.success('Event kustutatud');
    } catch (error) {
      toast.error(error?.message || 'Eventi kustutamine ebaõnnestus');
    } finally {
      setIsDeletingEvent((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  if (!session || !season || !group) {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_rgba(255,255,255,1)_55%)] px-4 pb-12 dark:bg-black dark:text-slate-100">
      <div className="max-w-4xl mx-auto pt-6">
        <div className="mb-6 flex items-center gap-2">
          <BackButton fallbackTo={`${createPageUrl('TrainingSeason')}?seasonId=${season.id}`} forceFallback />
          <HomeButton />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            {session.date ? format(new Date(session.date), 'MMM d') : 'Treening'}
          </h1>
          <div className="text-sm text-slate-500">
            {isDayGroupedView ? daySlotLabels.join(' • ') : formatSlotLabel(slot)}
          </div>
          {isDayGroupedView && (
            <div className="mt-1 text-xs font-semibold text-emerald-600">
              Päevavaade: 1 PIN koondatult {daySessions.length} ajagrupile
            </div>
          )}
        </div>

        {canManageTraining && (
          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-6 dark:bg-black dark:border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-emerald-600" />
              <div className="text-sm font-semibold text-slate-800">Lisa event</div>
            </div>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('app')}
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  mode === 'app'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600'
                } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
              >
                App event
              </button>
              <button
                type="button"
                onClick={() => setMode('offline')}
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  mode === 'offline'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600'
                } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
              >
                Offline / Challenge
              </button>
            </div>

            {mode === 'app' ? (
              <div className="space-y-3">
                <Input
                  placeholder="Eventi nimi (valikuline)"
                  value={appName}
                  onChange={(event) => setAppName(event.target.value)}
                />
                {isDayGroupedView ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                    <div className="text-xs font-semibold uppercase text-emerald-700 mb-2">Trenni grupid (sama päev)</div>
                    <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white">
                      {daySessions.map((daySession, index) => {
                        const slotLabel = formatSlotLabel(slotById[daySession.slot_id]);
                        const appEventCount = seasonEvents.filter(
                          (entry) => entry.session_id === daySession.id && entry.type === 'app'
                        ).length;
                        return (
                          <div
                            key={daySession.id}
                            className={`grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-xs ${
                              index % 2 === 0 ? 'bg-white' : 'bg-emerald-50/40'
                            }`}
                          >
                            <div className="font-semibold text-slate-700">{slotLabel}</div>
                            <div className="text-slate-500">{appEventCount} eventi</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[11px] text-emerald-700">
                      Sisesta PIN üks kord ja event lisatakse automaatselt kõigile ülalolevatele gruppidele.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setApplyAppToSameDate((prev) => !prev)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        applyAppToSameDate
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
                    >
                      {applyAppToSameDate
                        ? `Rakenda kõigile sama päeva trennidele (${appTargetSessions.length})`
                        : 'Rakenda ainult sellele trennile'}
                    </button>
                    <div className="text-xs text-slate-500">
                      Sisesta PIN 1x ja sama app-event lisatakse valitud päeva kõikidele gruppidele/aegadele.
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Trenni mängud</div>
                  {isLoadingGroupGames ? (
                    <div className="text-xs text-slate-400">Laen...</div>
                  ) : groupGames.length === 0 ? (
                    <div className="text-xs text-slate-400">Treeneri mänge ei leitud.</div>
                  ) : (
                    <div className="space-y-2">
                      {groupGames.map((game) => (
                        <div
                          key={game.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                        >
                          <div>
                            <div className="font-semibold">{game.name || game.game_type || 'Mäng'}</div>
                            <div className="text-[11px] text-slate-500">
                              {game.pin ? `PIN ${game.pin}` : 'PIN puudub'}
                              {game.date ? ` • ${format(new Date(game.date), 'MMM d')}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddGroupGame(game)}
                            disabled={isSavingApp}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60 dark:bg-black dark:border-white/10 dark:text-emerald-300"
                          >
                            Lisa event
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Mängu PIN"
                    value={appPin}
                    onChange={(event) => setAppPin(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setAppLowerIsBetter((prev) => !prev)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-black dark:border-white/10 dark:text-slate-100"
                  >
                    <Timer className="w-3 h-3" />
                    {appLowerIsBetter ? 'Ajamäng (kiirem parem)' : 'Skoor (kõrgem parem)'}
                  </button>
                </div>
                <Button onClick={handleCreateAppEvent} disabled={isSavingApp}>
                  {isSavingApp ? 'Salvestan...' : 'Lisa app event'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="Eventi nimi"
                  value={offlineName}
                  onChange={(event) => setOfflineName(event.target.value)}
                />
                <div className="text-xs text-slate-500">
                  Trenn: {formatSlotLabel(slot)} • Mängijaid: {filteredMembers.length}/{members.length}
                  {slotMemberIds.length === 0 && ' (pole püsikohti, näitan kõiki)'}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOfflineMode('points')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      offlineMode === 'points'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
                  >
                    Punktid
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfflineMode('rank_hc')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      offlineMode === 'rank_hc'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
                  >
                    Koht + HC
                  </button>
                </div>
                {offlineMode === 'rank_hc' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        value={offlineCutPercent}
                        onChange={(event) => setOfflineCutPercent(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                        placeholder="Cut %"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.05"
                        value={offlineCutBonus}
                        onChange={(event) => setOfflineCutBonus(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                        placeholder="HC boonus"
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      Märgitud tulemusi: {offlineParticipantsCount}.
                      {` Top ${offlineCutPercentValue}% = ${offlineCutCount} mängijat.`}
                      {` ${offlineCutCount}. koht saab +${round1(offlineCutBonusValue).toFixed(1)}p, iga koht ülespoole +${round1(offlineCutBonusValue).toFixed(1)}p juurde.`}
                    </div>
                    <div className="space-y-2">
                      {filteredMembers.map((member) => {
                        const rankValue = Number(offlineRanks[member.uid]) || 0;
                        const { points } = computeRankCutPoints({
                          rank: rankValue,
                          participantsCount: offlineParticipantsCount,
                          cutPercent: offlineCutPercentValue,
                          bonusStep: offlineCutBonusValue
                        });
                        const pointsPreview = Number.isFinite(points) ? points.toFixed(1) : null;
                        return (
                          <div key={member.uid} className="flex items-center gap-2">
                            <div className="text-xs text-slate-600 w-32">{member.name || member.email}</div>
                            <input
                              type="number"
                              min={1}
                              value={offlineRanks[member.uid] || ''}
                              onChange={(event) =>
                                setOfflineRanks((prev) => ({ ...prev, [member.uid]: event.target.value }))
                              }
                              className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                              placeholder="Koht"
                            />
                            {pointsPreview && (
                              <div className="text-xs font-semibold text-emerald-600 w-12 text-right">{pointsPreview}p</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <div key={member.uid} className="flex items-center gap-2">
                      <div className="text-xs text-slate-600 w-32">{member.name || member.email}</div>
                      <input
                        type="number"
                        step="0.1"
                        value={offlinePoints[member.uid] || ''}
                        onChange={(event) =>
                          setOfflinePoints((prev) => ({ ...prev, [member.uid]: event.target.value }))
                        }
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                        placeholder="Punktid"
                      />
                    </div>
                  ))}
                </div>
                )}
                <Button onClick={handleCreateOfflineEvent} disabled={isSavingOffline}>
                  {isSavingOffline ? 'Salvestan...' : 'Lisa offline event'}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            <div className="text-sm font-semibold text-slate-800">Eventid</div>
          </div>
          {events.length === 0 ? (
            <div className="text-sm text-slate-400">Evente pole veel.</div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const eventResults = resultsByEvent[event.id] || [];
                return (
                  <div key={event.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:bg-black dark:border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{event.name}</div>
                        <div className="text-xs text-slate-500">{event.type === 'app' ? 'App event' : 'Offline'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-400">{eventResults.length} osalejat</div>
                        {canManageTraining && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(event)}
                            disabled={Boolean(isDeletingEvent[event.id])}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600 shadow-sm transition hover:bg-red-100 disabled:opacity-60 dark:bg-black dark:border-white/10 dark:text-red-300"
                          >
                            {isDeletingEvent[event.id] ? 'Kustutan...' : 'Kustuta'}
                          </button>
                        )}
                      </div>
                    </div>
                    {eventResults.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {eventResults.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between text-xs text-slate-600">
                            <div>{entry.player_name || entry.participant_id}</div>
                            <div className="font-semibold text-emerald-600">{round1(entry.points || 0).toFixed(1)}p</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
