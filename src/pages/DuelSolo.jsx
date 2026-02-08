import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowLeft, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DuelPlayerView from '@/components/putting/DuelPlayerView';
import { addPlayerToState, createEmptyDuelState } from '@/lib/duel-utils';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

export default function DuelSolo() {
  const navigate = useNavigate();
  const [gameId, setGameId] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [gameName, setGameName] = React.useState('');
  const [discCount, setDiscCount] = React.useState('3');
  const [displayName, setDisplayName] = React.useState('');
  const [pin] = React.useState(() => Math.floor(1000 + Math.random() * 9000).toString());

  const handleCreate = async () => {
    try {
      setCreating(true);
      const user = await base44.auth.me();
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
    } catch (error) {
      toast.error('Mängu loomine ebaõnnestus');
    } finally {
      setCreating(false);
    }
  };

  if (gameId) {
    const joinUrl = `${window.location.origin}${createPageUrl('DuelJoin')}?pin=${pin}`;
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
            <div className="text-sm font-semibold text-slate-700">Sõbraduell (SOLO)</div>
            <div className="w-12" />
          </div>

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
      </div>
    </div>
  );
}
