import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addDoc,
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
import { Calendar, Plus, Trophy, Timer, ClipboardList } from 'lucide-react';
import { db } from '@/lib/firebase';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SCORE_DIRECTIONS,
  computeHcPoints,
  formatSlotLabel,
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [appPin, setAppPin] = React.useState('');
  const [appName, setAppName] = React.useState('');
  const [appLowerIsBetter, setAppLowerIsBetter] = React.useState(false);
  const [offlineName, setOfflineName] = React.useState('');
  const [offlinePoints, setOfflinePoints] = React.useState({});
  const [isSavingApp, setIsSavingApp] = React.useState(false);
  const [isSavingOffline, setIsSavingOffline] = React.useState(false);
  const [mode, setMode] = React.useState('app');

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

  const resultsByEvent = React.useMemo(() => {
    const map = {};
    results.forEach((entry) => {
      if (!map[entry.event_id]) map[entry.event_id] = [];
      map[entry.event_id].push(entry);
    });
    return map;
  }, [results]);

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
      const game = games[0];
      const players = getGamePlayers(game);
      if (players.length === 0) {
        toast.error('Mängijalist tühi');
        return;
      }

      const metricKey = game.game_type || 'unknown';
      const scoreDirection = appLowerIsBetter ? SCORE_DIRECTIONS.LOWER : SCORE_DIRECTIONS.HIGHER;
      const eventName = appName.trim() || game.name || metricKey;

      const batch = writeBatch(db);
      const eventRef = doc(collection(db, 'training_events'));
      batch.set(eventRef, {
        session_id: session.id,
        season_id: season.id,
        group_id: season.group_id,
        slot_id: session.slot_id,
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
          [session.slot_id]: round1((existing?.points_by_slot?.[session.slot_id] || 0) + points)
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
          session_id: session.id,
          season_id: season.id,
          group_id: season.group_id,
          slot_id: session.slot_id,
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
      setAppPin('');
      setAppName('');
      setAppLowerIsBetter(false);
      toast.success('Event lisatud');
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
      toast.success('Offline event lisatud');
    } catch (error) {
      toast.error(error?.message || 'Offline eventi lisamine ebaõnnestus');
    } finally {
      setIsSavingOffline(false);
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
          <div className="text-sm text-slate-500">{formatSlotLabel(slot)}</div>
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
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.uid} className="flex items-center gap-2">
                      <div className="text-xs text-slate-600 w-32">{member.name || member.email}</div>
                      <input
                        type="number"
                        step="0.1"
                        value={offlinePoints[member.uid] || ''}
                        onChange={(event) =>
                          setOfflinePoints((prev) => ({ ...prev, [member.uid]: event.target.value }))
                        }
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                        placeholder="Punktid"
                      />
                    </div>
                  ))}
                </div>
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
                      <div className="text-xs text-slate-400">{eventResults.length} osalejat</div>
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
