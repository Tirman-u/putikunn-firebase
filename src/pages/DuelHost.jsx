import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowLeft, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DuelHostView from '@/components/putting/DuelHostView';
import { createEmptyDuelState } from '@/lib/duel-utils';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function DuelHost() {
  const navigate = useNavigate();
  const [gameId, setGameId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [gameName, setGameName] = useState('');
  const [discCount, setDiscCount] = useState('3');
  const [stationCount, setStationCount] = useState(6);
  const [pin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setGameId(id);
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const user = auth.currentUser;
      const state = createEmptyDuelState(stationCount);
      const newGame = {
        name: gameName || `Sõbraduell ${new Date().toLocaleDateString()}`,
        pin,
        disc_count: Number(discCount),
        station_count: Number(stationCount),
        mode: 'host',
        status: 'lobby',
        host_user: user?.email,
        created_at: new Date().toISOString(),
        state,
      };
      const docRef = await addDoc(collection(db, 'duel_games'), newGame);
      setGameId(docRef.id);
      window.history.replaceState({}, '', `${createPageUrl('DuelHost')}?id=${docRef.id}`);
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
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Tagasi</span>
            </button>
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
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Tagasi</span>
          </button>
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (HOST)</div>
          <div className="w-12" />
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Mängu nimi</label>
            <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="nt Kolmapäeva duell" className="h-12 rounded-xl border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Ketaste arv</label>
            <ToggleGroup type="single" value={discCount} onValueChange={(value) => value && setDiscCount(value)} className="grid grid-cols-3 gap-2">
              <ToggleGroupItem value="1" className="rounded-full text-xs">1 ketas</ToggleGroupItem>
              <ToggleGroupItem value="3" className="rounded-full text-xs">3 ketast</ToggleGroupItem>
              <ToggleGroupItem value="5" className="rounded-full text-xs">5 ketast</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Jaamade arv</label>
            <Input type="number" min={1} max={12} value={stationCount} onChange={(e) => setStationCount(Number(e.target.value))} className="h-12 rounded-xl border-slate-200" />
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <div className="text-xs text-emerald-700 mb-1">PIN</div>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-semibold text-emerald-700">{pin}</div>
              <Button variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(pin); toast.success('PIN kopeeritud'); }}>
                <Copy className="w-4 h-4 mr-2" />
                Kopeeri
              </Button>
            </div>
          </div>
          <Button className="w-full rounded-2xl h-12" onClick={handleCreate} disabled={creating}>{creating ? 'Loon...' : 'Loo mäng'}</Button>
        </div>
      </div>
    </div>
  );
}
