import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
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

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPin = params.get('pin');
    if (urlPin) setPin(urlPin);
  }, []);

  const handleJoin = async () => {
    try {
      setJoining(true);
      const user = await base44.auth.me();
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
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Tagasi</span>
            </button>
            <div className="text-sm font-semibold text-slate-700">Sõbraduell</div>
            <div className="w-12" />
          </div>

          <DuelPlayerView gameId={gameId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Tagasi</span>
          </button>
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (Liitu)</div>
          <div className="w-12" />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Sinu nimi</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sisesta nimi"
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">PIN</label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-kohaline PIN"
              className="h-12 rounded-xl border-slate-200 text-center text-lg tracking-widest"
            />
          </div>
          <Button className="w-full h-12 rounded-2xl" onClick={handleJoin} disabled={joining}>
            {joining ? 'Liitun...' : 'Liitu mänguga'}
          </Button>
        </div>
      </div>
    </div>
  );
}
