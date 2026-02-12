import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { format } from 'date-fns';
import { Calendar, Trophy, Plus, Clock3, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { Button } from '@/components/ui/button';
import { countRemainingBySlot, formatSlotLabel, round1 } from '@/lib/training-league';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

export default function TrainingSeason() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seasonId = searchParams.get('seasonId');
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const tr = React.useCallback((et, en) => (lang === 'en' ? en : et), [lang]);
  const [selectedTab, setSelectedTab] = React.useState('overall');
  const [newSessionDate, setNewSessionDate] = React.useState('');
  const [newSessionSlotId, setNewSessionSlotId] = React.useState('');
  const [addSessionToAllSlots, setAddSessionToAllSlots] = React.useState(true);
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);
  const [isDeletingSeason, setIsDeletingSeason] = React.useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const { data: season } = useQuery({
    queryKey: ['training-season', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'training_seasons', seasonId));
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

  const { data: stats = [] } = useQuery({
    queryKey: ['training-season-stats', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const q = query(collection(db, 'training_season_stats'), where('season_id', '==', seasonId));
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 15000
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['training-sessions', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const q = query(collection(db, 'training_sessions'), where('season_id', '==', seasonId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const aTime = a.date ? new Date(a.date).getTime() : 0;
          const bTime = b.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        });
    },
    staleTime: 10000
  });

  const slots = Array.isArray(group?.slots) ? group.slots : [];
  const seasonSlots = slots.filter((slot) => (season?.slot_ids || []).includes(slot.id));

  React.useEffect(() => {
    if (!seasonSlots.length || newSessionSlotId) return;
    setNewSessionSlotId(seasonSlots[0].id);
  }, [seasonSlots, newSessionSlotId]);

  const remaining = countRemainingBySlot(seasonSlots, season?.end_date);
  const remainingWeeks = Math.max(0, ...Object.values(remaining?.bySlot || {}));

  const getSessionDateKey = React.useCallback((value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, []);

  const slotById = React.useMemo(() => {
    const map = {};
    slots.forEach((slotItem) => {
      if (slotItem?.id) {
        map[slotItem.id] = slotItem;
      }
    });
    return map;
  }, [slots]);

  const sessionGroups = React.useMemo(() => {
    const grouped = {};
    sessions.forEach((entry) => {
      const dateKey = getSessionDateKey(entry.date);
      if (!dateKey) return;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    });

    return Object.entries(grouped)
      .map(([dateKey, entries]) => {
        const sortedEntries = [...entries].sort((a, b) => {
          const slotA = slotById[a.slot_id];
          const slotB = slotById[b.slot_id];
          const labelA = formatSlotLabel(slotA);
          const labelB = formatSlotLabel(slotB);
          return labelA.localeCompare(labelB);
        });
        return {
          dateKey,
          date: sortedEntries[0]?.date || null,
          sessionIds: sortedEntries.map((item) => item.id),
          primarySessionId: sortedEntries[0]?.id,
          slotLabels: sortedEntries.map((item) => formatSlotLabel(slotById[item.slot_id])),
          count: sortedEntries.length
        };
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [sessions, getSessionDateKey, slotById]);

  const leaderboard = React.useMemo(() => {
    const rows = stats.map((entry) => {
      const slotPoints = selectedTab === 'overall'
        ? entry.points_total
        : (entry.points_by_slot?.[selectedTab] || 0);
      return {
        ...entry,
        displayPoints: round1(slotPoints || 0)
      };
    });
    return rows
      .filter((row) => row.displayPoints > 0 || selectedTab === 'overall')
      .sort((a, b) => (b.displayPoints || 0) - (a.displayPoints || 0));
  }, [stats, selectedTab]);

  const handleCreateSession = async () => {
    if (!seasonId || !season?.group_id || !newSessionDate) {
      toast.error(tr('Vali kuupäev ja trenniaeg', 'Select date and training time'));
      return;
    }
    if (!addSessionToAllSlots && !newSessionSlotId) {
      toast.error(tr('Vali trenniaeg', 'Select training time'));
      return;
    }
    const targetSessions = addSessionToAllSlots
      ? seasonSlots.map((slotItem) => ({ slot_id: slotItem.id }))
      : [{ slot_id: newSessionSlotId }];
    if (targetSessions.length === 0) {
      toast.error(tr('Aktiivseid trenniaegu pole', 'No active training times'));
      return;
    }

    setIsCreatingSession(true);
    try {
      const dateIso = new Date(newSessionDate).toISOString();
      const sessionDate = new Date(dateIso);
      const sessionDateKey = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-${String(sessionDate.getDate()).padStart(2, '0')}`;
      const existingKeys = new Set(
        sessions.map((entry) => {
          const entryDate = new Date(entry.date || 0);
          const entryDateKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
          return `${entryDateKey}:${entry.slot_id}`;
        })
      );

      const batch = writeBatch(db);
      let createdCount = 0;
      let skippedCount = 0;

      targetSessions.forEach((target) => {
        const key = `${sessionDateKey}:${target.slot_id}`;
        if (existingKeys.has(key)) {
          skippedCount += 1;
          return;
        }
        const sessionRef = doc(collection(db, 'training_sessions'));
        batch.set(sessionRef, {
          season_id: seasonId,
          group_id: season.group_id,
          slot_id: target.slot_id,
          date: dateIso,
          created_by_uid: user?.id || null,
          created_at: serverTimestamp()
        });
        createdCount += 1;
      });

      if (createdCount === 0) {
        toast.error(tr('Selle kuupäeva treeningud on juba lisatud', 'Trainings for this date already exist'));
        return;
      }

      await batch.commit();
      setNewSessionDate('');
      queryClient.invalidateQueries({ queryKey: ['training-sessions', seasonId] });
      if (skippedCount > 0) {
        toast.success(
          tr(
            `Treening lisatud (${createdCount}), vahele jäetud (${skippedCount})`,
            `Trainings added (${createdCount}), skipped (${skippedCount})`
          )
        );
      } else {
        toast.success(
          tr(
            createdCount > 1 ? `Treeningud lisatud (${createdCount})` : 'Treening lisatud',
            createdCount > 1 ? `Trainings added (${createdCount})` : 'Training added'
          )
        );
      }
    } catch (error) {
      toast.error(error?.message || tr('Treeningu lisamine ebaõnnestus', 'Failed to add training'));
    } finally {
      setIsCreatingSession(false);
    }
  };

  const deleteByQuery = async (q) => {
    const snap = await getDocs(q);
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count += 1;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  };

  const handleDeleteSeason = async () => {
    if (!season?.id || !season?.group_id) return;
    if (!canManageTraining) {
      toast.error(tr('Pole treeneri õigusi', 'No trainer permissions'));
      return;
    }
    const confirmed = window.confirm(tr(`Kustuta hooaeg "${season.name}"? See eemaldab ka treeningud ja tulemused.`, `Delete season "${season.name}"? This will also remove trainings and results.`));
    if (!confirmed) return;
    setIsDeletingSeason(true);
    try {
      await deleteByQuery(query(collection(db, 'training_event_results'), where('season_id', '==', season.id)));
      await deleteByQuery(query(collection(db, 'training_events'), where('season_id', '==', season.id)));
      await deleteByQuery(query(collection(db, 'training_sessions'), where('season_id', '==', season.id)));
      await deleteByQuery(query(collection(db, 'training_season_stats'), where('season_id', '==', season.id)));
      await deleteDoc(doc(db, 'training_seasons', season.id));
      queryClient.invalidateQueries({ queryKey: ['training-seasons', season.group_id] });
      toast.success(tr('Hooaeg kustutatud', 'Season deleted'));
      navigate(`${createPageUrl('TrainingLeague')}?groupId=${season.group_id}`);
    } catch (error) {
      toast.error(error?.message || tr('Hooaja kustutamine ebaõnnestus', 'Failed to delete season'));
    } finally {
      setIsDeletingSeason(false);
    }
  };

  if (!season) {
    return (
      <div className="min-h-screen bg-black" />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_rgba(255,255,255,1)_58%)] px-3 pb-10 pt-4 dark:bg-black dark:text-slate-100 sm:px-4 sm:pb-12 sm:pt-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-2 sm:mb-6">
          <BackButton fallbackTo={`${createPageUrl('TrainingLeague')}?groupId=${season.group_id}`} forceFallback label={tr('Tagasi', 'Back')} />
          <HomeButton label={tr('Avaleht', 'Home')} />
        </div>

        <div className="mb-5 rounded-[30px] border border-white/80 bg-white/90 p-4 shadow-[0_24px_50px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-white/10 dark:bg-black sm:mb-6 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
                <Trophy className="h-5 w-5 text-emerald-600" />
                {season.name}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Calendar className="h-3 w-3" />
                {season.start_date ? format(new Date(season.start_date), 'MMM d') : '-'} –{' '}
                {season.end_date ? format(new Date(season.end_date), 'MMM d') : '-'}
              </div>
            </div>
            {canManageTraining && (
              <button
                type="button"
                onClick={handleDeleteSeason}
                disabled={isDeletingSeason}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100 disabled:opacity-60 dark:border-white/10 dark:bg-black dark:text-red-300"
              >
                {isDeletingSeason ? tr('Kustutan...', 'Deleting...') : tr('Kustuta hooaeg', 'Delete season')}
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-white/10 dark:bg-black dark:text-emerald-300">
              {tr('Nädalaid jäänud', 'Weeks left')}: {remainingWeeks}
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_22px_46px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black sm:mb-6 sm:p-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {tr('Edetabeli filter', 'Leaderboard filter')}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedTab('overall')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                selectedTab === 'overall'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600'
              } dark:border-white/10 dark:bg-black dark:text-emerald-300`}
            >
              {tr('Üld', 'Overall')}
            </button>
            {seasonSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedTab(slot.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  selectedTab === slot.id
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600'
                } dark:border-white/10 dark:bg-black dark:text-emerald-300`}
              >
                {formatSlotLabel(slot)}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_22px_46px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black sm:mb-6 sm:p-5">
          <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{tr('Edetabel', 'Leaderboard')}</div>
          {leaderboard.length === 0 ? (
            <div className="text-sm text-slate-400">{tr('Punkte veel pole.', 'No points yet.')}</div>
          ) : (
            <div className="space-y-2.5">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-100 bg-white/90 px-3.5 py-3 dark:border-white/10 dark:bg-black"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-black dark:text-emerald-300">
                        {index + 1}
                      </div>
                      <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">
                        {entry.player_name || entry.participant_id || tr('Mängija', 'Player')}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                      {entry.displayPoints.toFixed(1)}p
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canManageTraining && (
          <div className="mb-5 rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_22px_46px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black sm:mb-6 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 dark:border-white/10 dark:bg-black">
                <Plus className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tr('Lisa treening', 'Add training')}</div>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAddSessionToAllSlots((prev) => !prev)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  addSessionToAllSlots
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600'
                } dark:border-white/10 dark:bg-black dark:text-emerald-300`}
              >
                {addSessionToAllSlots
                  ? tr(`Kõigile aegadele (${seasonSlots.length})`, `All slots (${seasonSlots.length})`)
                  : tr('Ühele ajale', 'Single slot')}
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {tr('Lisa sama kuupäev korraga kõigile aktiivsetele aegadele.', 'Add this date to all active slots at once.')}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="date"
                value={newSessionDate}
                onChange={(event) => setNewSessionDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-black dark:text-slate-100"
              />
              <select
                value={newSessionSlotId}
                onChange={(event) => setNewSessionSlotId(event.target.value)}
                disabled={addSessionToAllSlots}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-black dark:text-slate-100"
              >
                {seasonSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {formatSlotLabel(slot)}
                  </option>
                ))}
              </select>
              <Button onClick={handleCreateSession} disabled={isCreatingSession} className="h-11 rounded-2xl bg-emerald-600 font-semibold hover:bg-emerald-700">
                {isCreatingSession ? tr('Lisan...', 'Adding...') : tr('Lisa', 'Add')}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_22px_46px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black sm:p-5">
          <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{tr('Treeningud', 'Trainings')}</div>
          {sessionGroups.length === 0 ? (
            <div className="text-sm text-slate-400">{tr('Treeninguid pole veel.', 'No trainings yet.')}</div>
          ) : (
            <div className="space-y-2.5">
              {sessionGroups.map((groupEntry) => {
                return (
                  <button
                    key={groupEntry.dateKey}
                    type="button"
                    onClick={() =>
                      navigate(
                        `${createPageUrl('TrainingSession')}?sessionId=${groupEntry.primarySessionId}&dateKey=${groupEntry.dateKey}`
                      )
                    }
                    className="w-full rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 text-left transition hover:bg-emerald-50 dark:border-white/10 dark:bg-black"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {groupEntry.date ? format(new Date(groupEntry.date), 'MMM d') : tr('Treening', 'Training')}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Clock3 className="h-3 w-3" />
                          {groupEntry.slotLabels.join(' • ')}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                          {tr('Ajagruppe', 'Time groups')}: {groupEntry.count}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
