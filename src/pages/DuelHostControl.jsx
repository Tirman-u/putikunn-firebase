import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { Button } from '@/components/ui/button';
import useRealtimeDuelGame from '@/hooks/use-realtime-duel-game';
import {
  createEmptyDuelState,
  hasPendingSubmission,
  isStationReady,
  markPlayerReady,
  submitDuelScore,
  undoSubmission
} from '@/lib/duel-utils';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';

export default function DuelHostControl() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gameId, setGameId] = React.useState(null);
  const [activeStationIndex, setActiveStationIndex] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setGameId(id);
  }, []);

  const { data: game, isLoading } = useQuery({
    queryKey: ['duel-game', gameId],
    queryFn: async () => {
      const games = await base44.entities.DuelGame.filter({ id: gameId });
      return games?.[0] || null;
    },
    enabled: !!gameId
  });

  useRealtimeDuelGame({
    gameId,
    enabled: !!gameId,
    onEvent: (event) => {
      if (!event?.data) return;
      queryClient.setQueryData(['duel-game', gameId], event.data);
    }
  });

  const updateGame = async (updater) => {
    const games = await base44.entities.DuelGame.filter({ id: gameId });
    const current = games?.[0];
    if (!current) throw new Error('Mängu ei leitud');
    const next = updater(current);
    await base44.entities.DuelGame.update(gameId, next);
    queryClient.setQueryData(['duel-game', gameId], next);
  };

  React.useEffect(() => {
    if (!game || activeStationIndex !== null) return;
    const stationCount = game.station_count || 1;
    const state = game.state || createEmptyDuelState(stationCount);
    const stations = state.stations || [];
    const preferred =
      stations.find((station) => station.players?.length >= 2) ||
      stations.find((station) => station.players?.length >= 1) ||
      stations[0];
    setActiveStationIndex(preferred?.index || 1);
  }, [game, activeStationIndex]);

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <div className="flex items-center justify-between pt-6 pb-4">
            <div className="flex items-center gap-2">
              <BackButton onClick={() => navigate(-1)} />
              <HomeButton />
            </div>
            <div className="text-sm font-semibold text-slate-700">Sõbraduell (Võistlusaken)</div>
            <div className="w-12" />
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-slate-600">
            Mängu ID puudub.
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <div className="flex items-center justify-between pt-6 pb-4">
            <div className="flex items-center gap-2">
              <BackButton onClick={() => navigate(-1)} />
              <HomeButton />
            </div>
            <div className="text-sm font-semibold text-slate-700">Sõbraduell (Võistlusaken)</div>
            <div className="w-12" />
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-slate-600">
            Laen mängu...
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <div className="flex items-center justify-between pt-6 pb-4">
            <div className="flex items-center gap-2">
              <BackButton onClick={() => navigate(-1)} />
              <HomeButton />
            </div>
            <div className="text-sm font-semibold text-slate-700">Sõbraduell (Võistlusaken)</div>
            <div className="w-12" />
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-slate-600">
            Mängu ei leitud.
          </div>
        </div>
      </div>
    );
  }

  const stationCount = game.station_count || 1;
  const state = game.state || createEmptyDuelState(stationCount);
  const stations = state.stations || [];
  const activeStation =
    stations.find((station) => station.index === activeStationIndex) || stations[0];
  const activePlayers = activeStation?.players || [];
  const discCount = game.disc_count || 3;
  const stationReady = activeStation ? isStationReady(state, activeStation.index) : false;
  const pending = activeStation ? state.pending?.[activeStation.index] : null;

  const numberButtons =
    discCount === 5 ? [1, 2, 3, 4, 5] : discCount === 3 ? [1, 2, 3] : [];
  const gridCols = discCount === 5 ? 'grid-cols-5' : discCount === 3 ? 'grid-cols-3' : 'grid-cols-2';

  const handleReady = async (playerId) => {
    try {
      await updateGame((current) => ({
        ...current,
        state: markPlayerReady(current.state || createEmptyDuelState(stationCount), playerId)
      }));
    } catch (error) {
      // silent fail, realtime will refresh
    }
  };

  const handleReadyAll = async () => {
    if (!activeStation) return;
    try {
      await updateGame((current) => {
        let nextState = current.state || createEmptyDuelState(stationCount);
        activeStation.players.forEach((playerId) => {
          nextState = markPlayerReady(nextState, playerId);
        });
        return {
          ...current,
          state: nextState
        };
      });
    } catch (error) {
      // silent fail
    }
  };

  const handleSubmit = async (playerId, made) => {
    try {
      await updateGame((current) => submitDuelScore(current, playerId, made));
    } catch (error) {
      // silent fail
    }
  };

  const handleUndo = async (playerId) => {
    if (!activeStation) return;
    try {
      await updateGame((current) => undoSubmission(current, activeStation.index, playerId));
    } catch (error) {
      // silent fail
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="max-w-5xl mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <div className="flex items-center gap-2">
            <BackButton fallbackTo={`${createPageUrl('DuelHost')}?id=${gameId}`} />
            <HomeButton />
          </div>
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (Võistlusaken)</div>
          <div className="w-12" />
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">Mäng</div>
              <div className="text-lg font-semibold text-slate-800">{game.name}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">PIN</div>
              <div className="text-lg font-semibold text-slate-800">{game.pin}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <div className="font-semibold text-emerald-700">Režiim</div>
              <div>{game.disc_count} ketast</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-700">Jaamad</div>
              <div>{stationCount}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-700">Mängijad</div>
              <div>{Object.keys(state.players || {}).length}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-700">Staatus</div>
              <div>{game.status === 'active' ? 'Aktiivne' : game.status === 'finished' ? 'Lõpetatud' : 'Ootel'}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-800">Jaamad</div>
            <div className="text-xs text-slate-500">Vali jaam, kuhu tulemusi sisestada</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {stations.map((station) => {
              const playerNames = station.players
                .map((playerId) => state.players?.[playerId]?.name || playerId)
                .join(' vs ');
              const isActive = station.index === activeStation?.index;
              return (
                <button
                  key={station.index}
                  type="button"
                  onClick={() => setActiveStationIndex(station.index)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left transition',
                    isActive ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                  )}
                >
                  <div className="text-xs text-slate-500">Jaam {station.index}</div>
                  <div className="text-sm font-semibold text-slate-800">
                    {playerNames || 'Jaam on vaba'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-800">
              Sisesta tulemused {activeStation ? `• Jaam ${activeStation.index}` : ''}
            </div>
            {activePlayers.length >= 2 && !stationReady && (
              <Button variant="outline" className="rounded-xl" onClick={handleReadyAll}>
                Märgi mõlemad valmis
              </Button>
            )}
          </div>

          {activePlayers.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              Jaam on vaba.
            </div>
          )}

          {activePlayers.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {activePlayers.map((playerId) => {
                const player = state.players?.[playerId];
                const pendingMade = pending?.submissions?.[playerId]?.made;
                const hasPending = activeStation
                  ? hasPendingSubmission(state, activeStation.index, playerId)
                  : false;
                const waitingForOpponent =
                  Boolean(pending?.submissions?.[playerId]) &&
                  activePlayers.some((id) => id !== playerId && !pending?.submissions?.[id]);

                return (
                  <div
                    key={playerId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500">Mängija</div>
                        <div className="text-base font-semibold text-slate-800">
                          {player?.name || playerId}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] px-2 py-1 rounded-full font-semibold',
                          player?.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        )}
                      >
                        {player?.ready ? 'Valmis' : 'Pole valmis'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      P {player?.points ?? 0} • V {player?.wins ?? 0} • K {player?.losses ?? 0} • Dist {player?.distance ?? 5}m
                    </div>

                    {!player?.ready && (
                      <Button variant="outline" className="w-full rounded-xl" onClick={() => handleReady(playerId)}>
                        Märgi valmis
                      </Button>
                    )}

                    {stationReady ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600">Sisesta tulemus</div>
                        {discCount === 1 ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleSubmit(playerId, 1)}
                              className={cn(
                                'rounded-xl border-2 py-3 text-sm font-semibold',
                                pendingMade === 1
                                  ? 'border-emerald-400 bg-emerald-200 text-emerald-800'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              )}
                            >
                              Sees
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmit(playerId, 0)}
                              className={cn(
                                'rounded-xl border-2 py-3 text-sm font-semibold',
                                pendingMade === 0
                                  ? 'border-rose-400 bg-rose-200 text-rose-800'
                                  : 'border-rose-200 bg-rose-50 text-rose-700'
                              )}
                            >
                              Mööda
                            </button>
                          </div>
                        ) : (
                          <div className={cn('grid gap-2', gridCols)}>
                            {numberButtons.map((num) => (
                              <button
                                key={`${playerId}-${num}`}
                                type="button"
                                onClick={() => handleSubmit(playerId, num)}
                                className={cn(
                                  'rounded-xl border-2 py-2 text-sm font-semibold',
                                  pendingMade === num
                                    ? 'border-emerald-400 bg-emerald-200 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-800'
                                )}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        )}

                        {hasPending && (
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{waitingForOpponent ? 'Ootab teist sisestust' : 'Sisestus valmis'}</span>
                            <button
                              type="button"
                              onClick={() => handleUndo(playerId)}
                              className="text-rose-600 font-semibold"
                            >
                              Undo
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                        Ootab mõlema valmisolekut.
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
