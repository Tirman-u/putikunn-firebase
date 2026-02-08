import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import useRealtimeDuelGame from '@/hooks/use-realtime-duel-game';
import {
  createEmptyDuelState,
  getLeaderboardRows,
  startDuelGame
} from '@/lib/duel-utils';
import { cn } from '@/lib/utils';

export default function DuelHostView({ gameId }) {
  const queryClient = useQueryClient();

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

  const handleStart = async () => {
    try {
      await updateGame((current) => {
        const state = startDuelGame({
          ...current,
          state: current.state || createEmptyDuelState(current.station_count || 1)
        });
        return {
          ...current,
          status: 'active',
          started_at: new Date().toISOString(),
          state
        };
      });
      toast.success('Mäng alustatud');
    } catch (error) {
      toast.error('Mängu alustamine ebaõnnestus');
    }
  };

  const handleEnd = async () => {
    try {
      await updateGame((current) => ({
        ...current,
        status: 'finished',
        ended_at: new Date().toISOString()
      }));
      toast.success('Mäng lõpetatud');
    } catch (error) {
      toast.error('Mängu lõpetamine ebaõnnestus');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center text-slate-500">
        Laen mängu...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-[300px] flex items-center justify-center text-slate-500">
        Mängu ei leitud
      </div>
    );
  }

  const stationCount = game.station_count || 1;
  const state = game.state || createEmptyDuelState(stationCount);
  const leaderboard = getLeaderboardRows(state);
  const stations = state.stations || [];
  const queue = state.queue || [];

  const joinUrl = `${window.location.origin}${createPageUrl('DuelJoin')}?pin=${game.pin}`;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Sõbraduell (HOST)</div>
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
        <div className="mt-4 flex flex-wrap gap-2">
          {game.status !== 'active' && (
            <Button className="rounded-xl" onClick={handleStart}>
              Alusta mängu
            </Button>
          )}
          {game.status === 'active' && (
            <Button variant="outline" className="rounded-xl" onClick={handleEnd}>
              Lõpeta mäng
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              navigator.clipboard.writeText(joinUrl);
              toast.success('Join link kopeeritud');
            }}
          >
            Kopeeri join link
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Jaamad</div>
          <div className="text-xs text-slate-500">1 = tugevam • {stationCount} = lihtsam</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {stations.map((station) => (
            <div key={station.index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">Jaam {station.index}</div>
                <span
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-full font-semibold',
                    station.players.length === 2
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  )}
                >
                  {station.players.length === 2 ? 'Mäng käib' : 'Ootab'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
                {station.players.length === 0 && (
                  <div className="col-span-2 rounded-lg bg-white px-3 py-2 border border-slate-200 text-xs text-slate-400">
                    Jaam on vaba
                  </div>
                )}
                {station.players.map((playerId, index) => {
                  const player = state.players?.[playerId];
                  if (!player) return null;
                  return (
                    <div key={playerId} className="rounded-xl bg-white px-3 py-3 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{player.name}</span>
                        <span className="text-[11px] text-slate-400">
                          <span>
                            V {player.wins} • K {player.losses}
                          </span>
                          <span className="ml-3 text-slate-600 font-semibold">P {player.points}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5 text-[9px] text-slate-400">
                        {[5, 6, 7, 8, 9, 10].map((step) => (
                          <span key={`${playerId}-${step}`} className="text-center">
                            {step}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[5, 6, 7, 8, 9, 10].map((step) => (
                          <div
                            key={`${playerId}-bar-${step}`}
                            className={cn(
                              'h-1.5 rounded-full border',
                              step <= player.distance
                                ? index === 0
                                  ? 'bg-emerald-400 border-emerald-400'
                                  : 'bg-sky-400 border-sky-400'
                                : 'bg-slate-100 border-slate-200'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Live edetabel</div>
          <div className="text-xs text-slate-500">Punktid + võidud/kaotused</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-4 bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-2">
            <div>Mängija</div>
            <div className="text-center">Punktid</div>
            <div className="text-center">V/K</div>
            <div className="text-center">Jaam</div>
          </div>
          {leaderboard.map((row, idx) => (
            <div
              key={row.id}
              className={cn(
                'grid grid-cols-4 items-center px-3 py-2 text-sm',
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
              )}
            >
              <div className="font-semibold text-slate-800">{row.name}</div>
              <div className="text-center font-semibold text-emerald-600">{row.points}</div>
              <div className="text-center text-slate-600">{row.wins}/{row.losses}</div>
              <div className="text-center text-slate-600">{row.station}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Ootejärjekord</div>
          <div className="text-xs text-slate-500">Ootab vaba jaama</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {queue.length === 0 && (
            <span className="text-xs text-slate-400">Järjekord tühi</span>
          )}
          {queue.map((playerId) => (
            <span
              key={playerId}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {state.players?.[playerId]?.name || playerId}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
