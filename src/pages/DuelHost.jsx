import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Copy } from 'lucide-react';
import BackButton from '@/components/ui/back-button';
import { useNavigate } from 'react-router-dom';
import DuelHostView from '@/components/putting/DuelHostView';
import { createEmptyDuelState } from '@/lib/duel-utils';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

export default function DuelHost() {
  const navigate = useNavigate();
  const [gameId, setGameId] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [gameName, setGameName] = React.useState('');
  const [isNameLocked, setIsNameLocked] = React.useState(false);
  const [discCount, setDiscCount] = React.useState('3');
  const [stationCount, setStationCount] = React.useState(6);
  const [pin, setPin] = React.useState(() => Math.floor(1000 + Math.random() * 9000).toString());

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setGameId(id);
    const nameParam = params.get('name');
    if (nameParam) {
      const decodedName = decodeURIComponent(nameParam);
      if (decodedName.trim()) {
        setGameName(decodedName);
        setIsNameLocked(true);
      }
    }
    const pinParam = params.get('pin');
    if (pinParam && /^\d{4}$/.test(pinParam)) {
      setPin(pinParam);
    }
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const user = await base44.auth.me();
      const state = createEmptyDuelState(stationCount);
      const game = await base44.entities.DuelGame.create({
        name: gameName || `Sõbraduell ${new Date().toLocaleDateString()}`,
        pin,
        disc_count: Number(discCount),
        station_count: Number(stationCount),
        mode: 'host',
        status: 'lobby',
        host_user: user?.email,
        created_at: new Date().toISOString(),
        state
      });
      setGameId(game.id);
      window.history.replaceState({}, '', `${createPageUrl('DuelHost')}?id=${game.id}`);
    } catch (error) {
      toast.error('Mängu loomine ebaõnnestus');
    } finally {
      setCreating(false);
    }
  };

  if (gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="max-w-5xl mx-auto px-4 pb-10">
          <div className="flex items-center justify-between pt-6 pb-4">
            <BackButton onClick={() => navigate(-1)} />
            <div className="text-sm font-semibold text-slate-700">Sõbraduell (HOST)</div>
            <div className="w-12" />
          </div>

          <DuelHostView gameId={gameId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <BackButton onClick={() => navigate(-1)} />
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (HOST)</div>
          <div className="w-12" />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          {!isNameLocked ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mängu nimi
              </label>
              <Input
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="nt Kolmapäeva duell"
                className="h-12 rounded-xl border-slate-200"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Mängu nimi</div>
              <div className="text-base font-semibold text-slate-800">{gameName}</div>
            </div>
          )}

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

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Jaamade arv
            </label>
            <Input
              type="number"
              min={1}
              max={12}
              value={stationCount}
              onChange={(e) => setStationCount(Number(e.target.value))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>

          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <div className="text-xs text-emerald-700 mb-1">PIN</div>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-semibold text-emerald-700">{pin}</div>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  navigator.clipboard.writeText(pin);
                  toast.success('PIN kopeeritud');
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Kopeeri
              </Button>
            </div>
          </div>

          <Button
            className="w-full rounded-2xl h-12"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Loon...' : 'Loo mäng'}
          </Button>
        </div>
      </div>
    </div>
  );
}
