import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  submitDuelScore,
  undoSubmission
} from '@/lib/duel-utils';
import { cn } from '@/lib/utils';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

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
  const user = auth.currentUser;

  const { data: game, isLoading } = useRealtimeDuelGame({
    gameId,
    enabled: !!gameId,
    onEvent: (event) => {
      if (event.type === 'delete') {
        queryClient.setQueryData(['duel-game', gameId], null);
      } else if (event.data) {
        queryClient.setQueryData(['duel-game', gameId], { id: event.id, ...event.data });
      }
    }
  });

  const updateGame = async (updater) => {
    const gameRef = doc(db, 'duel_games', gameId);
    try {
      const currentDoc = await getDoc(gameRef);
      if (!currentDoc.exists()) throw new Error('Mängu ei leitud');
      const current = { id: currentDoc.id, ...currentDoc.data() };
      const next = updater(current);
      await updateDoc(gameRef, next);
    } catch (error) {
      console.error("Update failed: ", error);
      toast.error('Mängu uuendamine ebaõnnestus');
    }
  };

  if (isLoading) {
    return <div className="min-h-[300px] flex items-center justify-center text-slate-500">Laen mängu...</div>;
  }

  if (!game) {
    return <div className="min-h-[300px] flex items-center justify-center text-slate-500">Mängu ei leitud</div>;
  }

  const stationCount = game.station_count || 1;
  const state = game.state || createEmptyDuelState(stationCount);
  const playerId = user?.uid || user?.email;
  const player = playerId ? state.players?.[playerId] : null;

  if (!player) {
    return <div className="min-h-[300px] flex items-center justify-center text-slate-500">Sa ei ole selles mängus</div>;
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
  const opponentSubmitted = opponentId ? hasPendingSubmission(state, player.station_index, opponentId) : false;
  const canUndo = hasSubmitted && !opponentSubmitted;
  const discCount = game.disc_count || 3;
  const numberButtons = discCount === 3 ? [1, 2, 3] : discCount === 5 ? [1, 2, 3, 4, 5] : [];
  const gridCols = discCount === 5 ? 'grid-cols-5' : 'grid-cols-3';

  const handleReady = () => updateGame((current) => ({ ...current, state: markPlayerReady(current.state, playerId) }));
  const handleSubmit = (made) => updateGame((current) => submitDuelScore(current, playerId, made));
  const handleUndo = () => updateGame((current) => ({ ...current, state: undoSubmission(current.state, player.station_index, playerId) }));

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
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="text-sm font-semibold text-slate-800 mb-3">Progress</div>
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
                    <Button className="w-full rounded-xl" onClick={handleReady}>Kinnita jaam</Button>
                ) : (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Ootab vastase kinnitust…</div>
                )}
            </div>
        ) : (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
                <div className="text-sm font-semibold text-slate-800">Sisesta tulemus</div>
                {discCount === 1 ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button disabled={hasSubmitted} onClick={() => handleSubmit(1)} className={cn('rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-4 text-base font-semibold text-emerald-700 shadow-sm', hasSubmitted && 'opacity-50')}>Sees</button>
                        <button disabled={hasSubmitted} onClick={() => handleSubmit(0)} className={cn('rounded-2xl border-2 border-rose-200 bg-rose-50 py-4 text-base font-semibold text-rose-700 shadow-sm', hasSubmitted && 'opacity-50')}>Mööda</button>
                    </div>
                ) : (
                    <div className={cn('grid gap-3', gridCols)}>
                        {numberButtons.map((num) => (
                            <button key={`made-${num}`} disabled={hasSubmitted} onClick={() => handleSubmit(num)} className={cn('rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 text-base font-semibold text-slate-800 shadow-sm', hasSubmitted && 'opacity-50')}>{num}</button>
                        ))}
                    </div>
                )}
                {hasSubmitted && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Ootab vastase sisestust…</div>}
                {canUndo && <Button variant="outline" className="w-full rounded-xl" onClick={handleUndo}>Võta tagasi</Button>}
            </div>
        )}
    </div>
  );
}
