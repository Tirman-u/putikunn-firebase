import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import LoadingState from '@/components/ui/loading-state';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';

const TOP_N = 10;

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

export default function GroupProjector() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupId = searchParams.get('id');
  const [group, setGroup] = React.useState(null);
  const [gamesById, setGamesById] = React.useState({});
  const [lastUpdate, setLastUpdate] = React.useState(null);

  React.useEffect(() => {
    if (!groupId) return undefined;
    const unsub = onSnapshot(doc(db, 'game_groups', groupId), (snap) => {
      if (!snap.exists()) {
        setGroup(null);
        return;
      }
      setGroup({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [groupId]);

  const gameIds = React.useMemo(() => {
    if (!group?.game_ids?.length) return [];
    return group.game_ids.slice(0, 3);
  }, [group]);

  React.useEffect(() => {
    if (gameIds.length === 0) {
      setGamesById({});
      return undefined;
    }
    const unsubscribers = gameIds.map((id) =>
      onSnapshot(doc(db, 'games', id), (snap) => {
        if (!snap.exists()) return;
        setGamesById((prev) => ({ ...prev, [id]: { id: snap.id, ...snap.data() } }));
        setLastUpdate(new Date());
      })
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [gameIds.join('|')]);

  if (!groupId) {
    return <LoadingState />;
  }

  if (!group) {
    return <LoadingState />;
  }

  const games = gameIds.map((id) => gamesById[id]).filter(Boolean);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_rgba(255,255,255,1)_55%)] px-6 pb-10 dark:bg-black">
      <div className="max-w-7xl mx-auto pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">{group.name}</h1>
            <p className="text-xs text-slate-500">Projektorivaade</p>
          </div>
          <div className="text-xs text-slate-400 min-w-[120px] text-right">
            {lastUpdate ? `Uuendatud ${lastUpdate.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>

        {games.length === 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/70 p-10 text-center text-slate-500 shadow-sm backdrop-blur-sm">
            Grupi mänge pole.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {games.map((game) => {
              const format = GAME_FORMATS[game.game_type] || {};
              const stats = buildPlayerStats(game);
              return (
                <div
                  key={game.id}
                  className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-base font-bold text-slate-800">{game.name}</div>
                      <div className="text-xs text-slate-500">{format.name || game.game_type}</div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      <Trophy className="w-3 h-3" />
                      Top {TOP_N}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {stats.length === 0 ? (
                      <div className="text-sm text-slate-500">Tulemusi pole</div>
                    ) : (
                      stats.map((player, idx) => (
                        <div
                          key={`${player.name}-${idx}`}
                          className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{player.name}</div>
                              <div className="text-xs text-slate-500">{player.accuracy}% sees</div>
                            </div>
                          </div>
                          <div className="text-lg font-bold text-emerald-600">{player.score}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
