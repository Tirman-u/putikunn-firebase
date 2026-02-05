import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Copy, Check, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GameFormatSelector from './GameFormatSelector';
import FormatRulesPopup from './FormatRulesPopup';
import PuttTypeSelector from './PuttTypeSelector';

export default function HostSetup({ onStartGame, onBack, isSolo = false }) {
  const [gameName, setGameName] = useState('');
  const [gameType, setGameType] = useState('classic');
  const [puttType, setPuttType] = useState('regular');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  
  // Generate random 4-digit PIN
  const [pin] = useState(() => 
    Math.floor(1000 + Math.random() * 9000).toString()
  );

  const handleStart = () => {
    if (gameType === 'around_the_world') {
      // For ATW, navigate to ATW setup instead
      const nameParam = gameName ? '&name=' + encodeURIComponent(gameName) : '';
      const puttTypeParam = '&puttType=' + puttType;
      window.location.href = createPageUrl('Home') + '?mode=atw-setup&solo=' + (isSolo ? '1' : '0') + (isSolo ? '' : '&pin=' + pin + nameParam) + puttTypeParam;
      return;
    }
    onStartGame({
      name: gameName || `Mäng ${new Date().toLocaleDateString()}`,
      pin: isSolo ? null : pin,
      gameType,
      puttType
    });
  };

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Tagasi</span>
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">{isSolo ? 'Soolotreening' : 'Hosti mäng'}</h1>
          <p className="text-sm text-slate-500">{isSolo ? 'Harjuta üksi omas tempos' : 'Loo sessioon'}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Sessiooni nimi (valikuline)
          </label>
          <Input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="nt Neljapäevane treening"
            className="h-12 rounded-xl border-slate-200"
          />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-700">
              Mängu formaat
            </label>
            <FormatRulesPopup format={gameType} />
          </div>
          <GameFormatSelector selected={gameType} onSelect={setGameType} />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Puti stiil
          </label>
          <PuttTypeSelector selectedType={puttType} onSelect={setPuttType} />
        </div>

        {!isSolo && (
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg mb-6 text-white">
            <div className="text-center mb-4">
              <h3 className="text-sm font-semibold mb-2 opacity-90">Sinu mängu PIN</h3>
              <div className="text-5xl font-bold tracking-widest mb-3">{pin}</div>
              <p className="text-sm opacity-90">Jaga seda PIN-i mängijatega</p>
            </div>
            <Button
              onClick={copyPin}
              className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 h-12 rounded-xl"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Kopeeritud!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  Kopeeri PIN
                </>
              )}
            </Button>
          </div>
        )}



        <Button
          onClick={handleStart}
          className="w-full h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-xl font-bold rounded-2xl shadow-xl shadow-emerald-200"
        >
          <Play className="w-6 h-6 mr-3" />
          {isSolo ? 'Alusta treeningut' : 'Alusta mängu'}
        </Button>
      </div>
    </div>
  );
}
