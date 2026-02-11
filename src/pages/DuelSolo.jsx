import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Copy } from 'lucide-react';
import DuelPlayerView from '@/components/putting/DuelPlayerView';
import { addPlayerToState, createEmptyDuelState } from '@/lib/duel-utils';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import BackButton from '@/components/ui/back-button';

export default function DuelSolo() {
  const [gameId, setGameId] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [joining, setJoining] = React.useState(false);
  const [gameName, setGameName] = React.useState('');
  const [discCount, setDiscCount] = React.useState('3');
  const [displayName, setDisplayName] = React.useState('');
  const [joinPin, setJoinPin] = React.useState('');
  const [viewMode, setViewMode] = React.useState('host');
  const [userProfile, setUserProfile] = React.useState(null);
  const [pin] = React.useState(() => Math.floor(1000 + Math.random() * 9000).toString());

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

  const handleCreate = async () => {
    try {
      setCreating(true);
      const user = userProfile || (await base44.auth.me());
      const playerName = displayName || user?.display_name || user?.full_name || user?.email || 'Mängija';
      const state = createEmptyDuelState(1);
      addPlayerToState(state, {
        id: user?.id || user?.email,
        name: playerName,
        email: user?.email,
        joined_at: new Date().toISOString(),
        desired_station: 1
      });
      const game = await base44.entities.DuelGame.create({
        name: gameName || `Sõbraduell ${new Date().toLocaleDateString()}`,
        pin,
        disc_count: Number(discCount),
        station_count: 1,
        mode: 'solo',
        status: 'lobby',
        host_user: user?.email,
        created_at: new Date().toISOString(),
        state
      });
      setGameId(game.id);
      setViewMode('host');
    } catch (error) {
      toast.error('Mängu loomine ebaõnnestus');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinFromSolo = async () => {
    try {
      const trimmed = joinPin.trim();
      if (!trimmed) {
        toast.error('Sisesta PIN');
        return;
      }
      setJoining(true);
      const user = userProfile || (await base44.auth.me());
      const games = await base44.entities.DuelGame.filter({ pin: trimmed });
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

      await base44.entities.DuelGame.update(game.id, {
        ...game,
        state: nextState
      });
      setGameId(game.id);
      setViewMode('join');
      toast.success('Liitusid mänguga');
    } catch (error) {
      toast.error('Liitumine ebaõnnestus');
    } finally {
      setJoining(false);
    }
  };

  if (gameId) {
    const joinUrl = `${window.location.origin}${createPageUrl('DuelJoin')}?pin=${pin}`;
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="max-w-xl mx-auto px-4 pb-10">
          <div className="flex items-center justify-between pt-6 pb-4">
            <BackButton fallbackTo={createPageUrl('Home')} forceFallback />
            <div className="text-sm font-semibold text-slate-700">Sõbraduell (SOLO)</div>
            <div className="w-12" />
          </div>

          {viewMode === 'host' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">PIN</div>
                  <div className="text-2xl font-semibold text-slate-800">{pin}</div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    toast.success('Join link kopeeritud');
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Kopeeri link
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500">Jaga linki vastasega</div>
            </div>
          )}

          <DuelPlayerView gameId={gameId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <BackButton fallbackTo={createPageUrl('Home')} forceFallback />
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (SOLO)</div>
          <div className="w-12" />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Sinu nimi
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sisesta nimi"
              className="h-12 rounded-xl border-slate-200"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mängu nimi
            </label>
            <Input
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="nt Sõbraduell"
              className="h-12 rounded-xl border-slate-200"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Ketaste arv
            </label>
            <ToggleGroup
              type="single"
              value={discCount}
              onValueChange={(value) => value && setDiscCount(value)}
              className="grid grid-cols-3 gap-2"
            >
              <ToggleGroupItem value="1" className="rounded-full text-xs">
                1 ketas
              </ToggleGroupItem>
              <ToggleGroupItem value="3" className="rounded-full text-xs">
                3 ketast
              </ToggleGroupItem>
              <ToggleGroupItem value="5" className="rounded-full text-xs">
                5 ketast
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Button
            className="w-full h-12 rounded-2xl"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Loon...' : 'Loo SOLO duel'}
          </Button>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Või liitu sõbra duelliga</div>
          <Input
            value={joinPin}
            onChange={(e) => setJoinPin(e.target.value)}
            placeholder="Sisesta PIN"
            className="h-12 rounded-xl border-slate-200 text-center text-lg tracking-widest"
          />
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl"
            onClick={handleJoinFromSolo}
            disabled={joining}
          >
            {joining ? 'Liitun...' : 'Liitu duelliga'}
          </Button>
        </div>
      </div>
    </div>
  );
}
