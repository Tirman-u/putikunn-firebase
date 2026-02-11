import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Calendar, Trophy, Plus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { countRemainingBySlot, formatSlotLabel, round1 } from '@/lib/training-league';
import { toast } from 'sonner';

export default function TrainingSeason() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seasonId = searchParams.get('seasonId');
  const [selectedTab, setSelectedTab] = React.useState('overall');
  const [newSessionDate, setNewSessionDate] = React.useState('');
  const [newSessionSlotId, setNewSessionSlotId] = React.useState('');
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);

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
      const q = query(
        collection(db, 'training_season_stats'),
        where('season_id', '==', seasonId),
        orderBy('points_total', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 15000
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['training-sessions', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const q = query(
        collection(db, 'training_sessions'),
        where('season_id', '==', seasonId),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
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
    if (!seasonId || !season?.group_id || !newSessionDate || !newSessionSlotId) {
      toast.error('Vali kuupäev ja trenniaeg');
      return;
    }
    setIsCreatingSession(true);
    try {
      await addDoc(collection(db, 'training_sessions'), {
        season_id: seasonId,
        group_id: season.group_id,
        slot_id: newSessionSlotId,
        date: new Date(newSessionDate).toISOString(),
        created_by_uid: user?.id || null,
        created_at: serverTimestamp()
      });
      setNewSessionDate('');
      toast.success('Treening lisatud');
    } catch (error) {
      toast.error(error?.message || 'Treeningu lisamine ebaõnnestus');
    } finally {
      setIsCreatingSession(false);
    }
  };

  if (!season) {
    return (
      <div className="min-h-screen bg-black" />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_rgba(255,255,255,1)_55%)] px-4 pb-12 dark:bg-black dark:text-slate-100">
      <div className="max-w-5xl mx-auto pt-6">
        <div className="mb-6 flex items-center gap-2">
          <BackButton fallbackTo={`${createPageUrl('TrainingLeague')}?groupId=${season.group_id}`} forceFallback />
          <HomeButton />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600" />
            {season.name}
          </h1>
          <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
            <Calendar className="w-3 h-3" />
            {season.start_date ? format(new Date(season.start_date), 'MMM d') : '-'} –{' '}
            {season.end_date ? format(new Date(season.end_date), 'MMM d') : '-'}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Trenni jäänud: {remaining.total}</div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-6 dark:bg-black dark:border-white/10">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTab('overall')}
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                selectedTab === 'overall'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600'
              } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
            >
              Üld
            </button>
            {seasonSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedTab(slot.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  selectedTab === slot.id
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600'
                } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
              >
                {formatSlotLabel(slot)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-6 dark:bg-black dark:border-white/10">
          <div className="text-sm font-semibold text-slate-800 mb-3">Edetabel</div>
          {leaderboard.length === 0 ? (
            <div className="text-sm text-slate-400">Punkte veel pole.</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-sm text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold dark:bg-black dark:text-emerald-300">
                      {index + 1}
                    </div>
                    <div className="font-semibold">
                      {entry.player_name || entry.participant_id || 'Mängija'}
                    </div>
                  </div>
                  <div className="font-semibold text-emerald-600">{entry.displayPoints.toFixed(1)}p</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canManageTraining && (
          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-6 dark:bg-black dark:border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-emerald-600" />
              <div className="text-sm font-semibold text-slate-800">Lisa treening</div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={newSessionDate}
                onChange={(event) => setNewSessionDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
              />
              <select
                value={newSessionSlotId}
                onChange={(event) => setNewSessionSlotId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
              >
                {seasonSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {formatSlotLabel(slot)}
                  </option>
                ))}
              </select>
              <Button onClick={handleCreateSession} disabled={isCreatingSession}>
                {isCreatingSession ? 'Lisan...' : 'Lisa'}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
          <div className="text-sm font-semibold text-slate-800 mb-3">Treeningud</div>
          {sessions.length === 0 ? (
            <div className="text-sm text-slate-400">Treeninguid pole veel.</div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const slot = slots.find((item) => item.id === session.slot_id);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate(`${createPageUrl('TrainingSession')}?sessionId=${session.id}`)}
                    className="w-full text-left rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-sm text-slate-700 transition hover:bg-emerald-50 dark:bg-black dark:border-white/10 dark:text-slate-100"
                  >
                    <div className="font-semibold">
                      {session.date ? format(new Date(session.date), 'MMM d') : 'Treening'}
                    </div>
                    <div className="text-xs text-slate-500">{formatSlotLabel(slot)}</div>
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
