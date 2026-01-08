import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Copy, Check } from 'lucide-react';

export default function HostSetup({ onStartGame }) {
  const [gameName, setGameName] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Generate random 4-digit PIN
  const [pin] = useState(() => 
    Math.floor(1000 + Math.random() * 9000).toString()
  );

  const handleStart = () => {
    onStartGame({
      name: gameName || `Game ${new Date().toLocaleDateString()}`,
      pin
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
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200">
            <span className="text-4xl">🥏</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Host Jyly Game</h1>
          <p className="text-slate-500">Create a session for players to join</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Session Name (optional)
          </label>
          <Input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="e.g., Thursday Practice"
            className="h-12 rounded-xl border-slate-200"
          />
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg mb-6 text-white">
          <div className="text-center mb-4">
            <h3 className="text-sm font-semibold mb-2 opacity-90">Your Game PIN</h3>
            <div className="text-5xl font-bold tracking-widest mb-3">{pin}</div>
            <p className="text-sm opacity-90">Share this PIN with players</p>
          </div>
          <Button
            onClick={copyPin}
            className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 h-12 rounded-xl"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 mr-2" />
                Copy PIN
              </>
            )}
          </Button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h3 className="font-bold text-lg mb-3">🥏 Jyly Rules</h3>
          <ul className="text-sm space-y-2 text-slate-600">
            <li>• Start at 10m, throw 5 discs</li>
            <li>• Based on makes, next distance: 0→5m, 1→6m, 2→7m, 3→8m, 4→9m, 5→10m</li>
            <li>• Points = distance × makes (e.g., 3 makes from 8m = 24pts)</li>
            <li>• Play 20 rounds total</li>
          </ul>
        </div>

        <Button
          onClick={handleStart}
          className="w-full h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-xl font-bold rounded-2xl shadow-xl shadow-emerald-200"
        >
          <Play className="w-6 h-6 mr-3" />
          Start Game
        </Button>
      </div>
    </div>
  );
}