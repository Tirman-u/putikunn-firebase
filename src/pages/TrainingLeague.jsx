import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Trophy, Plus, Calendar, Clock3, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { countRemainingBySlot, formatSlotLabel } from '@/lib/training-league';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

export default function TrainingLeague() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId');
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const tr = React.useCallback((et, en) => (lang === 'en' ? en : et), [lang]);
  const [seasonName, setSeasonName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selectedSlots, setSelectedSlots] = React.useState([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [showSeasonCreator, setShowSeasonCreator] = React.useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const { data: group } = useQuery({
    queryKey: ['training-group', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'training_groups', groupId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    staleTime: 30000
  });

  const { data: seasons = [] } = useQuery({
    queryKey: ['training-seasons', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const q = query(collection(db, 'training_seasons'), where('group_id', '==', groupId));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const aTime = a.start_date ? new Date(a.start_date).getTime() : 0;
          const bTime = b.start_date ? new Date(b.start_date).getTime() : 0;
          return bTime - aTime;
        });
    },
    staleTime: 20000
  });

  const slots = Array.isArray(group?.slots) ? group.slots : [];

  React.useEffect(() => {
    if (!slots.length || selectedSlots.length > 0) return;
    setSelectedSlots(slots.map((slot) => slot.id));
  }, [slots, selectedSlots.length]);

  const toggleSlot = (slotId) => {
    setSelectedSlots((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const getRemainingWeeks = React.useCallback((remaining) => {
    return Math.max(0, ...Object.values(remaining?.bySlot || {}));
  }, []);

  const handleCreateSeason = async () => {
    if (!groupId) {
      toast.error(tr('Grupi ID puudub', 'Group ID is missing'));
      return;
    }
    if (!user?.id) {
      toast.error(tr('Palun logi sisse', 'Please sign in'));
      return;
    }
    if (!canManageTraining) {
      toast.error(tr('Pole treeneri õigusi', 'No trainer permissions'));
      return;
    }
    if (!startDate || !endDate) {
      toast.error(tr('Vali hooaja algus ja lõpp', 'Select season start and end'));
      return;
    }
    if (selectedSlots.length === 0) {
      toast.error(tr('Vali vähemalt üks trenniaeg', 'Select at least one training time'));
      return;
    }
    setIsCreating(true);
    try {
      const name = seasonName.trim() || tr(`${group?.name || 'Treening'} hooaeg`, `${group?.name || 'Training'} season`);
      await addDoc(collection(db, 'training_seasons'), {
        group_id: groupId,
        name,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        slot_ids: selectedSlots,
        created_by_uid: user.id,
        created_at: serverTimestamp(),
        status: 'active'
      });
      setSeasonName('');
      setStartDate('');
      setEndDate('');
      setShowSeasonCreator(false);
      queryClient.invalidateQueries({ queryKey: ['training-seasons', groupId] });
      toast.success(tr('Hooaeg loodud', 'Season created'));
    } catch (error) {
      toast.error(error?.message || tr('Hooaja loomine ebaõnnestus', 'Failed to create season'));
    } finally {
      setIsCreating(false);
    }
  };


  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_rgba(255,255,255,1)_58%)] px-3 pb-10 pt-4 sm:px-4 sm:pb-12 sm:pt-6 dark:bg-black dark:text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center gap-2 sm:mb-6">
          <BackButton fallbackTo={`${createPageUrl('TrainerGroupDashboard')}?id=${groupId}`} forceFallback label={tr('Tagasi', 'Back')} />
          <HomeButton label={tr('Avaleht', 'Home')} />
        </div>

        <div className="mb-4 rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-[0_22px_46px_rgba(15,23,42,0.09)] backdrop-blur-xl sm:mb-6 sm:p-5 dark:border-white/10 dark:bg-black">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
            <Trophy className="h-5 w-5 text-emerald-600" />
            {tr('Liiga', 'League')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{group?.name || tr('Treening', 'Training')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-white/10 dark:bg-black dark:text-emerald-300">
              {tr('Hooaegu', 'Seasons')}: {seasons.length}
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-black dark:text-slate-300">
              {tr('Aktiivsed ajad', 'Active slots')}: {slots.length}
            </div>
          </div>
        </div>

        {canManageTraining && (
          <div className="mb-5 sm:mb-6">
            {!showSeasonCreator ? (
              <button
                type="button"
                onClick={() => setShowSeasonCreator(true)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm dark:border-white/10 dark:bg-black dark:text-emerald-300"
              >
                <Plus className="h-4 w-4" />
                {tr('Loo hooaeg', 'Create season')}
              </button>
            ) : (
              <div className="rounded-[30px] border border-white/80 bg-white/90 p-4 shadow-[0_24px_50px_rgba(15,23,42,0.09)] backdrop-blur-xl sm:p-5 dark:border-white/10 dark:bg-black">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 dark:border-white/10 dark:bg-black">
                      <Plus className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tr('Loo hooaeg', 'Create season')}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tr('Mobile-first kiire sisestus', 'Mobile-first quick setup')}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSeasonCreator(false)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-black dark:text-slate-300"
                  >
                    {tr('Peida', 'Hide')}
                  </button>
                </div>
                <div className="space-y-3">
                  <Input
                    placeholder={tr('Hooaja nimi', 'Season name')}
                    value={seasonName}
                    onChange={(event) => setSeasonName(event.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-black dark:text-slate-100"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-black dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{tr('Trenni ajad', 'Training times')}</div>
                  <div className="flex gap-2 overflow-x-auto pb-1 pr-1">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => toggleSlot(slot.id)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedSlots.includes(slot.id)
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600'
                        } dark:border-white/10 dark:bg-black dark:text-emerald-300`}
                      >
                        {formatSlotLabel(slot)}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleCreateSeason}
                  disabled={isCreating}
                  className="mt-4 h-11 w-full rounded-2xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
                >
                  {isCreating ? tr('Loon...', 'Creating...') : tr('Loo hooaeg', 'Create season')}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          {seasons.length === 0 && (
            <div className="rounded-[28px] border border-white/80 bg-white/90 p-6 text-center text-slate-500 shadow-[0_20px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black">
              {tr('Hooaegu veel pole.', 'No seasons yet.')}
            </div>
          )}
          {seasons.map((season) => {
            const seasonSlots = slots.filter((slot) => (season.slot_ids || []).includes(slot.id));
            const remaining = countRemainingBySlot(seasonSlots, season.end_date);
            const remainingWeeks = getRemainingWeeks(remaining);
            return (
              <button
                type="button"
                onClick={() => navigate(`${createPageUrl('TrainingSeason')}?seasonId=${season.id}`)}
                key={season.id}
                className="w-full rounded-[28px] border border-white/85 bg-white/90 p-4 text-left shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:bg-emerald-50/50 dark:border-white/10 dark:bg-black"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{season.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {season.start_date ? format(new Date(season.start_date), 'MMM d') : '-'} –{' '}
                      {season.end_date ? format(new Date(season.end_date), 'MMM d') : '-'}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300">
                      <Clock3 className="h-3 w-3" />
                      {tr('Nädalaid jäänud', 'Weeks left')}: {remainingWeeks}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-white/10 dark:bg-black dark:text-emerald-300">
                      {remainingWeeks}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
                {seasonSlots.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {seasonSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-black dark:text-slate-300"
                      >
                        {formatSlotLabel(slot)}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
