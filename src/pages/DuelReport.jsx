import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { createEmptyDuelState, getLeaderboardRows } from '@/lib/duel-utils';

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'MMM d, yyyy HH:mm');
};

export default function DuelReport() {
  const [gameId, setGameId] = React.useState('');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setGameId(id);
  }, []);

  const { data: game, isLoading } = useQuery({
    queryKey: ['duel-report', gameId],
    queryFn: async () => {
      const games = await base44.entities.DuelGame.filter({ id: gameId });
      return games?.[0] || null;
    },
    enabled: !!gameId
  });

  if (!gameId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
        <div className="max-w-3xl mx-auto pt-6 pb-10">
          <div className="mb-4 flex items-center gap-2">
            <BackButton fallbackTo={createPageUrl('Profile')} forceFallback />
            <HomeButton />
          </div>
          <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-black dark:border-white/10">
            Raporti ID puudub.
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
        <div className="max-w-3xl mx-auto pt-6 pb-10">
          <div className="mb-4 flex items-center gap-2">
            <BackButton fallbackTo={createPageUrl('Profile')} forceFallback />
            <HomeButton />
          </div>
          <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-black dark:border-white/10">
            Laen raportit...
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
        <div className="max-w-3xl mx-auto pt-6 pb-10">
          <div className="mb-4 flex items-center gap-2">
            <BackButton fallbackTo={createPageUrl('Profile')} forceFallback />
            <HomeButton />
          </div>
          <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-black dark:border-white/10">
            Duelli ei leitud.
          </div>
        </div>
      </div>
    );
  }

  const stationCount = game.station_count || 1;
  const state = game.state || createEmptyDuelState(stationCount);
  const players = state.players || {};
  const logs = [...(state.log || [])].sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));
  const leaderboard = getLeaderboardRows(state);
  const winnerId = game.winner_id || leaderboard[0]?.id || null;
  const winnerName = winnerId ? (players[winnerId]?.name || winnerId) : '-';

  const stationSummary = Array.from({ length: stationCount }, (_, idx) => idx + 1).map((stationIndex) => {
    const stationLogs = logs.filter((entry) => Number(entry.station) === stationIndex);
    const winsByPlayer = {};
    let ties = 0;

    stationLogs.forEach((entry) => {
      if (entry.result === 'tie') {
        ties += 1;
        return;
      }
      if (!winsByPlayer[entry.result]) winsByPlayer[entry.result] = 0;
      winsByPlayer[entry.result] += 1;
    });

    const topWinner = Object.entries(winsByPlayer).sort((a, b) => b[1] - a[1])[0];
    return {
      stationIndex,
      rounds: stationLogs.length,
      ties,
      winsByPlayer,
      topWinnerId: topWinner?.[0] || null,
      topWinnerRounds: topWinner?.[1] || 0
    };
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
      <div className="max-w-3xl mx-auto pt-6 pb-10 space-y-4">
        <div className="mb-2 flex items-center gap-2">
          <BackButton fallbackTo={createPageUrl('Profile')} forceFallback />
          <HomeButton />
        </div>

        <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-black dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{game.name || 'Sõbraduell'}</h1>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {game.mode === 'solo' ? 'SOLO' : 'HOST'} • PIN {game.pin || '-'}
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {game.status === 'finished' ? 'Lõpetatud' : 'Käimas'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 dark:text-slate-400">Võitja</div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{winnerName}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 dark:text-slate-400">Raunde</div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{logs.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 dark:text-slate-400">Algas</div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(game.started_at || game.created_at || game.date)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:bg-black dark:border-white/10">
              <div className="text-xs text-slate-500 dark:text-slate-400">Lõppes</div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(game.ended_at)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-black dark:border-white/10">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Korvi/jaama kokkuvõte</h2>
          <div className="mt-3 space-y-2">
            {stationSummary.map((station) => (
              <div key={station.stationIndex} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:bg-black dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    Korv {station.stationIndex}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Raunde: {station.rounds} • Viike: {station.ties}
                  </div>
                </div>
                {station.rounds > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {Object.entries(station.winsByPlayer).map(([playerId, wins]) => (
                      <span key={`${station.stationIndex}-${playerId}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        {(players[playerId]?.name || playerId)}: {wins} võitu
                      </span>
                    ))}
                    {station.topWinnerId && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Enim võite: {players[station.topWinnerId]?.name || station.topWinnerId} ({station.topWinnerRounds})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Selles korvis veel tulemusi pole.</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-black dark:border-white/10">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Raundi logi</h2>
          {logs.length === 0 ? (
            <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">Logi puudub.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {logs.map((entry, idx) => {
                const [p1, p2] = entry.players || [];
                const p1Name = players[p1]?.name || p1 || 'Mängija A';
                const p2Name = players[p2]?.name || p2 || 'Mängija B';
                const p1Score = entry.scores?.[p1] ?? 0;
                const p2Score = entry.scores?.[p2] ?? 0;
                const p1Distance = entry.distances?.[p1];
                const p2Distance = entry.distances?.[p2];
                const winnerLabel = entry.result === 'tie'
                  ? 'Viik'
                  : `Võitja: ${players[entry.result]?.name || entry.result}`;

                return (
                  <div key={entry.id || `${entry.station}-${idx}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:bg-black dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Raund {idx + 1} • Korv {entry.station}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.result === 'tie'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
                        {winnerLabel}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      {p1Name} ({p1Distance ?? '-' }m): {p1Score} • {p2Name} ({p2Distance ?? '-'}m): {p2Score}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.ts)}</div>
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
