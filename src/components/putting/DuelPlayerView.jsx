import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import useRealtimeDuelGame from '@/hooks/use-realtime-duel-game';
import {
  DUEL_MAX_DISTANCE,
  DUEL_START_DISTANCE,
  createEmptyDuelState,
  getLeaderboardRows,
  getOpponentId,
  hasPendingSubmission,
  isStationReady,
  markPlayerReady,
  startDuelGame,
  submitDuelScore,
  undoSubmission
} from '@/lib/duel-utils';
import { cn } from '@/lib/utils';

const DISTANCES = [5, 6, 7, 8, 9, 10];

function ProgressRow({ label, distance, colorClass }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          {distance}m
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {DISTANCES.map((step) => (
          <div
            key={`${label}-${step}`}
            className={cn(
              'h-2 rounded-full border',
              step <= distance ? colorClass : 'bg-slate-100 border-slate-200'
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-6 text-[10px] text-slate-400">
        {DISTANCES.map((step) => (
          <span key={`${label}-label-${step}`} className="text-center">
            {step}m
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DuelPlayerView({ gameId }) {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

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
  const playerId = user?.id || user?.email;
  const player = playerId ? state.players?.[playerId] : null;
  const isSoloLobby = game.mode === 'solo' && game.status === 'lobby';
  const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
  const isHost = normalizeEmail(game.host_user) && normalizeEmail(game.host_user) === normalizeEmail(user?.email);

  if (!player) {
    return (
      <div className="min-h-[300px] flex items-center justify-center text-slate-500">
        Sa ei ole selles mängus
      </div>
    );
  }

  if (game.status === 'finished') {
    const leaderboard = getLeaderboardRows(state);
    const winnerId = game.winner_id || leaderboard?.[0]?.id;
    const winnerName = state.players?.[winnerId]?.name || 'Võitja';
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="text-sm text-slate-500">Mäng lõppenud</div>
          <div className="text-lg font-semibold text-slate-800">Võitja: {winnerName}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-800 mb-3">Lõpu edetabel</div>
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
                  'grid grid-cols-4 items-center px-3 py-2 text-xs',
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

        {state.log?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="text-sm font-semibold text-slate-800 mb-3">Mängu logi</div>
            <div className="space-y-2 text-xs text-slate-600">
              {state.log.slice(-12).map((entry) => (
                <div key={entry.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  Jaam {entry.station} • {entry.result === 'tie' ? 'Viik' : `Võitja: ${state.players?.[entry.result]?.name}`}
                  <span className="ml-2 text-slate-400">
                    ({entry.scores?.[entry.players?.[0]] ?? 0}–{entry.scores?.[entry.players?.[1]] ?? 0})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isSoloLobby) {
    const playersList = Object.values(state.players || {});
    const opponentName = playersList.find((p) => p.id !== playerId)?.name || 'Ootab';
    const canStart = isHost && playersList.length >= 2;

    const handleStart = async () => {
      if (!canStart) return;
      try {
        await updateGame((current) => ({
          ...current,
          status: 'active',
          started_at: new Date().toISOString(),
          state: startDuelGame(current)
        }));
      } catch (error) {
        toast.error('Mängu käivitamine ebaõnnestus');
      }
    };

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="text-sm text-slate-500">Sõbraduell ooterežiim</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs text-slate-500">Sina</div>
              <div className="text-base font-semibold text-slate-800">{player.name}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs text-slate-500">Sõber</div>
              <div className="text-base font-semibold text-slate-800">{opponentName}</div>
            </div>
          </div>
        </div>

        {canStart ? (
          <Button className="w-full rounded-xl" onClick={handleStart}>
            Alusta mängu
          </Button>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-slate-700">
            {playersList.length < 2 ? 'Ootan sõpra liituma…' : 'Ootan hosti käivitust…'}
          </div>
        )}
      </div>
    );
  }

  if (!player.station_index) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="text-sm text-slate-500">Ootad jaama vabanemist…</div>
        <div className="text-lg font-semibold text-slate-800 mt-2">Järjekord</div>
        <div className="mt-2 text-xs text-slate-500">Hoia silm peal, uus jaam tuleb varsti.</div>
      </div>
    );
  }

  const opponentId = getOpponentId(state, playerId);
  const opponent = opponentId ? state.players?.[opponentId] : null;
  const stationReady = isStationReady(state, player.station_index);
  const hasSubmitted = hasPendingSubmission(state, player.station_index, playerId);
  const opponentSubmitted = opponentId
    ? hasPendingSubmission(state, player.station_index, opponentId)
    : false;
  const canUndo = hasSubmitted && !opponentSubmitted;

  const discCount = game.disc_count || 3;
  const numberButtons = discCount === 3 ? [1, 2, 3] : discCount === 5 ? [1, 2, 3, 4, 5] : [];
  const gridCols = discCount === 5 ? 'grid-cols-5' : 'grid-cols-3';

  const handleReady = async () => {
    try {
      await updateGame((current) => ({
        ...current,
        state: markPlayerReady(current.state || createEmptyDuelState(stationCount), playerId)
      }));
    } catch (error) {
      toast.error('Ei saanud kinnitada');
    }
  };

  const handleSubmit = async (made) => {
    try {
      await updateGame((current) => submitDuelScore(current, playerId, made));
    } catch (error) {
      toast.error('Sisestus ebaõnnestus');
    }
  };

  const handleUndo = async () => {
    try {
      await updateGame((current) => ({
        ...current,
        state: undoSubmission(current.state || createEmptyDuelState(stationCount), player.station_index, playerId)
      }));
    } catch (error) {
      toast.error('Undo ebaõnnestus');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Jaam</div>
            <div className="text-lg font-semibold text-slate-800">Jaam {player.station_index}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Vastane</div>
            <div className="text-lg font-semibold text-slate-800">{opponent?.name || 'Ootab'}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Režiim: {discCount} ketast • Distants 5–{DUEL_MAX_DISTANCE}m</span>
          <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
            Punktid: {player.points}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Progress</div>
          <div className="text-xs text-slate-500">Mõlemad sisestavad paralleelselt</div>
        </div>
        <div className="space-y-4">
          <ProgressRow label="Sina" distance={player.distance} colorClass="bg-emerald-500 border-emerald-500" />
          <ProgressRow label="Vastane" distance={opponent?.distance || DUEL_START_DISTANCE} colorClass="bg-sky-500 border-sky-500" />
        </div>
      </div>

      {!stationReady ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-slate-700">
            Uus vastane: {opponent?.name || 'Ootab'} • Jaam {player.station_index}
          </div>
          {!player.ready ? (
            <Button className="w-full rounded-xl" onClick={handleReady}>
              Kinnita jaam
            </Button>
          ) : (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Ootab vastase kinnitust…
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">Sisesta tulemus</div>
            <ToggleGroup type="single" value={`${discCount}`} className="grid grid-cols-3 gap-1">
              <ToggleGroupItem value="1" className="rounded-full text-[11px]">1</ToggleGroupItem>
              <ToggleGroupItem value="3" className="rounded-full text-[11px]">3</ToggleGroupItem>
              <ToggleGroupItem value="5" className="rounded-full text-[11px]">5</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {discCount === 1 ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={hasSubmitted}
                onClick={() => handleSubmit(1)}
                className={cn(
                  'rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-4 text-base font-semibold text-emerald-700 shadow-sm',
                  hasSubmitted && 'opacity-50 cursor-not-allowed'
                )}
              >
                Sees
              </button>
              <button
                disabled={hasSubmitted}
                onClick={() => handleSubmit(0)}
                className={cn(
                  'rounded-2xl border-2 border-rose-200 bg-rose-50 py-4 text-base font-semibold text-rose-700 shadow-sm',
                  hasSubmitted && 'opacity-50 cursor-not-allowed'
                )}
              >
                Mööda
              </button>
            </div>
          ) : (
            <div className={cn('grid gap-3', gridCols)}>
              {numberButtons.map((num) => (
                <button
                  key={`made-${num}`}
                  disabled={hasSubmitted}
                  onClick={() => handleSubmit(num)}
                  className={cn(
                    'rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 text-base font-semibold text-slate-800 shadow-sm',
                    hasSubmitted && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
          )}

          {hasSubmitted && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Ootab vastase sisestust…
            </div>
          )}

          {canUndo && (
            <Button variant="outline" className="w-full rounded-xl" onClick={handleUndo}>
              Undo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
