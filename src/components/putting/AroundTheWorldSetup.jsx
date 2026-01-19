import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const DIFFICULTY_PRESETS = {
  easy: { label: 'Easy', threshold: 1, discs: 1 },
  medium: { label: 'Medium', threshold: 2, discs: 3 },
  hard: { label: 'Hard', threshold: 3, discs: 5 },
  ultra_hard: { label: 'Ultra Hard', threshold: 4, discs: 7 },
  impossible: { label: 'Impossible', threshold: 5, discs: 10 }
};

export default function AroundTheWorldSetup({ isSolo, onBack, onStart, initialPin, initialName }) {
  const [gameName, setGameName] = useState(initialName || '');
  const [difficulty, setDifficulty] = useState('medium');
  const [pin] = useState(initialPin || (isSolo ? '0000' : Math.floor(1000 + Math.random() * 9000).toString()));
  const [copied, setCopied] = useState(false);

  const handleStart = () => {
    if (!isSolo && !gameName.trim()) {
      toast.error('Anna mängule nimi');
      return;
    }

    const preset = DIFFICULTY_PRESETS[difficulty];
    onStart({
      name: gameName || 'Around the World',
      gameType: 'around_the_world',
      pin: isSolo ? null : pin,
      config: {
        distances: [5, 6, 7, 8, 9, 10],
        discs_per_turn: preset.discs,
        advance_threshold: preset.threshold,
        difficulty
      }
    });
  };

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Tagasi</span>
      </button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Around the World
        </h1>
        <p className="text-slate-600">
          {isSolo ? 'Solo treening' : 'Võistlusmäng'}
        </p>
      </div>

      <div className="space-y-6 bg-white rounded-2xl p-6 shadow-sm">
        {!isSolo && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Mängu nimi
            </label>
            <Input
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Nt. Õhtune Around the World"
              className="text-base"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Raskusaste
          </label>
          <div className="space-y-2">
            {Object.entries(DIFFICULTY_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setDifficulty(key)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  difficulty === key
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{preset.label}</div>
                    <div className="text-sm text-slate-600">
                      {preset.discs} {preset.discs === 1 ? 'putt' : 'putti'} • Vaja {preset.threshold}+ sisse
                    </div>
                  </div>
                  {difficulty === key && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {!isSolo && (
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg text-white">
            <div className="text-center mb-4">
              <h3 className="text-sm font-semibold mb-2 opacity-90">Mängu PIN</h3>
              <div className="text-5xl font-bold tracking-widest mb-3">{pin}</div>
              <p className="text-sm opacity-90">Jaga seda PIN-koodi mängijatega</p>
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

        {!isSolo && (
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg mb-4 text-white">
            <div className="text-center mb-4">
              <h3 className="text-sm font-semibold mb-2 opacity-90">Mängu PIN</h3>
              <div className="text-5xl font-bold tracking-widest mb-3">{pin}</div>
              <p className="text-sm opacity-90">Jaga seda PIN-koodi mängijatega</p>
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
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-lg font-semibold"
        >
          {isSolo ? 'Alusta treeningut' : 'Loo mäng'}
        </Button>
        </div>

        <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Kuidas mängida?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Alusta 5m pealt, liigu ülespoole 10m-ni</li>
          <li>• Saades piisavalt sisse, liigu edasi</li>
          <li>• 10m juures pöördu tagasi 5m poole</li>
          <li>• Iga läbitud ring = 1 lap</li>
          <li>• 0 sisse = tagasi 5m peale</li>
        </ul>
      </div>
    </div>
  );
}