import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BackButton from '@/components/ui/back-button';
import { useNavigate } from 'react-router-dom';
import DuelPlayerView from '@/components/putting/DuelPlayerView';
import { addPlayerToState, createEmptyDuelState } from '@/lib/duel-utils';
import { toast } from 'sonner';

export default function DuelJoin() {
  const navigate = useNavigate();
  const [pin, setPin] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [joining, setJoining] = React.useState(false);
  const [gameId, setGameId] = React.useState(null);
  const [userProfile, setUserProfile] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPin = params.get('pin');
    if (urlPin) setPin(urlPin);
  }, []);

  React.useEffect(() => {
    let active = true;
    base44.auth
      .me()
      .then((user) => {
        if (!active) return;
        setUserProfile(user);
        setDisplayName((current) => {
          if (current) return current;
          return user?.display_name || user?.full_name || user?.email || '';
        });
      })
      .catch(() => null);

    return () => {
      active = false;
    };
  }, []);

  const handleJoin = async () => {
    try {
      setJoining(true);
      const user = userProfile || (await base44.auth.me());
      const games = await base44.entities.DuelGame.filter({ pin });
      const game = games?.[0];
      if (!game) {
        toast.error('Mängu PIN ei leitud');
        return;
      }
      if (game.status === 'finished') {
        toast.error('Mäng on lõpetatud');
        return;
      }

      const playerName = displayName || user?.display_name || user?.full_name || user?.email || 'Mängija';

      const stationCount = game.station_count || 1;
      const nextState = addPlayerToState(
        game.state || createEmptyDuelState(stationCount),
        {
          id: user?.id || user?.email,
          name: playerName,
          email: user?.email,
          joined_at: new Date().toISOString(),
          desired_station: stationCount
        }
      );

      let nextGame = {
        ...game,
        state: nextState
      };

      await base44.entities.DuelGame.update(game.id, nextGame);
      setGameId(game.id);
      toast.success('Liitusid mänguga');
    } catch (error) {
      toast.error('Liitumine ebaõnnestus');
    } finally {
      setJoining(false);
    }
  };

  if (gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="max-w-xl mx-auto px-4 pb-10">
          <div className="flex items-center justify-between pt-6 pb-4">
            <BackButton onClick={() => navigate(-1)} />
            <div className="text-sm font-semibold text-slate-700">Sõbraduell</div>
            <div className="w-12" />
          </div>

          <DuelPlayerView gameId={gameId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
      <div className="max-w-lg mx-auto pt-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <BackButton onClick={() => navigate(-1)} />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sõbraduell (Liitu)</div>
          <div className="w-12" />
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm space-y-4 dark:bg-black dark:border-white/10">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Sinu nimi</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sisesta nimi"
              className="mt-2 h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">PIN</label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-kohaline PIN"
              className="mt-2 h-12 rounded-2xl border border-slate-200 bg-white px-4 text-center text-lg font-bold tracking-widest text-slate-800 focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
            />
          </div>
          <Button
            className="w-full h-12 rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? 'Liitun...' : 'Liitu mänguga'}
          </Button>
        </div>
      </div>
    </div>
  );
}
