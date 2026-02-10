import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MonitorPlay } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/firebase';
import { createPageUrl } from '@/utils';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import BackButton from '@/components/ui/back-button';

const TOP_N = 10;
const STORAGE_KEY = 'trainer_projector_pins';

const buildPlayerStats = (game) => {
  if (!game) return [];
  const players = Array.isArray(game.players)
    ? game.players
    : Object.keys(game.total_points || {});
  return players
    .map((name) => {
      const score = game.total_points?.[name] ?? 0;
      const putts = game.player_putts?.[name] || [];
      const accuracy = putts.length
        ? Math.round((putts.filter((p) => p.result === 'made').length / putts.length) * 1000) / 10
        : 0;
      return { name, score, accuracy };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
};

const buildInitialSlots = () => {
  if (typeof window === 'undefined') {
    return Array.from({ length: 3 }, () => ({
      pin: '',
      gameId: null,
      game: null,
      loading: false,
      error: null,
      lastUpdate: null
    }));
  }

  let stored = [];
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    stored = [];
  }

  return Array.from({ length: 3 }, (_, index) => ({
    pin: stored[index] || '',
    gameId: null,
    game: null,
    loading: false,
    error: null,
    lastUpdate: null
  }));
};

export default function TrainerProjector() {
  const navigate = useNavigate();
  const [slots, setSlots] = React.useState(buildInitialSlots);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);

  React.useEffect(() => {
    if (user && !canManageTraining) {
      navigate(createPageUrl('Home'));
    }
  }, [user, canManageTraining, navigate]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const pins = slots.map((slot) => slot.pin || '');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  }, [slots]);

  const updateSlot = React.useCallback((index, patch) => {
    setSlots((prev) =>
      prev.map((slot, idx) => (idx === index ? { ...slot, ...patch } : slot))
    );
  }, []);

  const loadGameForSlot = React.useCallback(async (index, pinOverride) => {
    const rawPin = (pinOverride ?? slots[index]?.pin ?? '').toString();
    const cleanedPin = rawPin.replace(/\D/g, '').slice(0, 4);
    updateSlot(index, {
      pin: rawPin,
      loading: true,
      error: null,
      gameId: null,
      game: null
    });

    if (cleanedPin.length !== 4) {
      updateSlot(index, { loading: false, error: 'Sisesta 4-kohaline PIN' });
      return;
    }

    try {
      const games = await base44.entities.Game.filter({ pin: cleanedPin }, '-date', 1);
      if (!games?.length) {
        updateSlot(index, { loading: false, error: 'Mängu ei leitud' });
        return;
      }
      const game = games[0];
      updateSlot(index, {
        pin: cleanedPin,
        gameId: game.id,
        game,
        loading: false,
        error: null
      });
    } catch (error) {
      updateSlot(index, {
        loading: false,
        error: error?.message || 'PINi laadimine ebaõnnestus'
      });
    }
  }, [slots, updateSlot]);

  React.useEffect(() => {
    const hasInitialPins = slots.some((slot) => slot.pin);
    if (!hasInitialPins) return;
    slots.forEach((slot, idx) => {
      if (slot.pin && !slot.gameId && !slot.loading && !slot.error) {
        loadGameForSlot(idx, slot.pin);
      }
    });
  }, []);

  React.useEffect(() => {
    const unsubscribers = slots.map((slot, index) => {
      if (!slot.gameId) return null;
      const ref = doc(db, 'games', slot.gameId);
      return onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
          updateSlot(index, { game: null, error: 'Mäng puudub', lastUpdate: new Date() });
          return;
        }
        updateSlot(index, { game: { id: snap.id, ...snap.data() }, lastUpdate: new Date(), error: null });
      });
    });
    return () => unsubscribers.forEach((unsub) => unsub && unsub());
  }, [slots.map((slot) => slot.gameId).join('|'), updateSlot]);

  if (user && !canManageTraining) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_rgba(255,255,255,1)_55%)] px-6 pb-10 dark:bg-black dark:text-slate-100">
      <div className="max-w-7xl mx-auto pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <BackButton fallbackTo={createPageUrl('TrainerGroups')} forceFallback />
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-slate-800">Treeneri projektor</h1>
            <p className="text-xs text-slate-500">Sisesta kuni 3 PIN-i, et näha live edetabeleid.</p>
          </div>
          <div className="text-xs text-slate-400 min-w-[120px] text-right">
            <MonitorPlay className="w-4 h-4 inline-block mr-1" />
            Live
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {slots.map((slot, index) => {
            const game = slot.game;
            const format = game ? (GAME_FORMATS[game.game_type] || {}) : {};
            const stats = game ? buildPlayerStats(game) : [];
            return (
              <div
                key={`slot-${index}`}
                className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10"
              >
                <div className="flex flex-col gap-3 mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Mäng {index + 1}</div>
                  <div className="flex gap-2">
                    <input
                      value={slot.pin}
                      onChange={(event) => updateSlot(index, { pin: event.target.value })}
                      placeholder="PIN"
                      inputMode="numeric"
                      maxLength={4}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => loadGameForSlot(index)}
                      disabled={slot.loading}
                      className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {slot.loading ? 'Laen...' : 'Näita'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSlot(index, { pin: '', gameId: null, game: null, error: null })}
                      className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white dark:bg-black dark:border-white/10 dark:text-slate-200"
                    >
                      Tühjenda
                    </button>
                  </div>
                  {slot.error && <div className="text-xs text-red-500">{slot.error}</div>}
                </div>

                {!game ? (
                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:bg-black dark:border-white/10">
                    Sisesta PIN, et näha edetabelit.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-bold text-slate-800">{game.name}</div>
                        <div className="text-xs text-slate-500">{format.name || game.game_type}</div>
                      </div>
                      <div className="text-xs text-slate-400">
                        {slot.lastUpdate
                          ? `Uuendatud ${slot.lastUpdate.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                      </div>
                    </div>

                    {stats.length === 0 ? (
                      <div className="text-sm text-slate-500">Tulemusi pole</div>
                    ) : (
                      <div className="space-y-2">
                        {stats.map((player, idx) => (
                          <div
                            key={`${player.name}-${idx}`}
                            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2 dark:bg-black dark:border-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold dark:bg-black dark:text-slate-200 dark:border dark:border-white/10">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{player.name}</div>
                                <div className="text-xs text-slate-500">{player.accuracy}% sees</div>
                              </div>
                            </div>
                            <div className="text-lg font-bold text-emerald-600">{player.score}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
