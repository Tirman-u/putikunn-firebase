import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Trophy, Plus, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { countRemainingBySlot, formatSlotLabel } from '@/lib/training-league';
import { toast } from 'sonner';

export default function TrainingLeague() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId');
  const queryClient = useQueryClient();
  const [seasonName, setSeasonName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selectedSlots, setSelectedSlots] = React.useState([]);
  const [isCreating, setIsCreating] = React.useState(false);

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

  const handleCreateSeason = async () => {
    if (!groupId) {
      toast.error('Grupi ID puudub');
      return;
    }
    if (!user?.id) {
      toast.error('Palun logi sisse');
      return;
    }
    if (!canManageTraining) {
      toast.error('Pole treeneri õigusi');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Vali hooaja algus ja lõpp');
      return;
    }
    if (selectedSlots.length === 0) {
      toast.error('Vali vähemalt üks trenniaeg');
      return;
    }
    setIsCreating(true);
    try {
      const name = seasonName.trim() || `${group?.name || 'Treening'} hooaeg`;
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
      queryClient.invalidateQueries({ queryKey: ['training-seasons', groupId] });
      toast.success('Hooaeg loodud');
    } catch (error) {
      toast.error(error?.message || 'Hooaja loomine ebaõnnestus');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_rgba(255,255,255,1)_55%)] px-4 pb-12 dark:bg-black dark:text-slate-100">
      <div className="max-w-4xl mx-auto pt-6">
        <div className="mb-6 flex items-center gap-2">
          <BackButton fallbackTo={`${createPageUrl('TrainerGroupDashboard')}?id=${groupId}`} forceFallback />
          <HomeButton />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600" />
            Liiga
          </h1>
          <p className="text-sm text-slate-500">{group?.name || 'Treening'}</p>
        </div>

        {canManageTraining && (
          <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-6 dark:bg-black dark:border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-emerald-600" />
              <div className="text-sm font-semibold text-slate-800">Loo hooaeg</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <Input
                placeholder="Hooaja nimi"
                value={seasonName}
                onChange={(event) => setSeasonName(event.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:bg-black dark:border-white/10 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Trenni ajad</div>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => toggleSlot(slot.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      selectedSlots.includes(slot.id)
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    } dark:bg-black dark:border-white/10 dark:text-emerald-300`}
                  >
                    {formatSlotLabel(slot)}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleCreateSeason}
              disabled={isCreating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isCreating ? 'Loon...' : 'Loo hooaeg'}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {seasons.length === 0 && (
            <div className="rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm text-center text-slate-500 dark:bg-black dark:border-white/10">
              Hooaegu veel pole.
            </div>
          )}
          {seasons.map((season) => {
            const seasonSlots = slots.filter((slot) => (season.slot_ids || []).includes(slot.id));
            const remaining = countRemainingBySlot(seasonSlots, season.end_date);
            return (
              <div
                key={season.id}
                className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-800">{season.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3" />
                      {season.start_date ? format(new Date(season.start_date), 'MMM d') : '-'} –{' '}
                      {season.end_date ? format(new Date(season.end_date), 'MMM d') : '-'}
                    </div>
                    <div className="text-xs text-emerald-600 mt-1">
                      Trenni jäänud: {remaining.total}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`${createPageUrl('TrainingSeason')}?seasonId=${season.id}`)}
                  >
                    Ava
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
