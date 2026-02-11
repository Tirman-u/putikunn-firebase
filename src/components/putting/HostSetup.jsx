import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Play, Copy, Check } from 'lucide-react';
import { createPageUrl } from '@/utils';
import GameFormatSelector from './GameFormatSelector';
import FormatRulesPopup from './FormatRulesPopup';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';

export default function HostSetup({ onStartGame, onBack, isSolo = false }) {
  const [gameName, setGameName] = useState('');
  const [gameType, setGameType] = useState('classic');
  const [puttType, setPuttType] = useState('regular');
  const [copied, setCopied] = useState(false);
  const [activePuttTooltip, setActivePuttTooltip] = useState(null);
  const tooltipTimerRef = useRef(null);
  const excludeFormats = isSolo ? [] : ['time_ladder'];
  // Generate random 4-digit PIN
  const [pin] = useState(() => 
    Math.floor(1000 + Math.random() * 9000).toString()
  );

  const puttOptions = [
    { id: 'regular', label: 'Tavaline', icon: '🎯' },
    { id: 'straddle', label: 'Straddle', icon: '🦵' },
    { id: 'turbo', label: 'Turbo', icon: '⚡' },
    { id: 'kneeling', label: 'Põlvelt', icon: '🧎' },
    { id: 'marksman', label: 'Marksman', icon: '🏹' }
  ];

  const handleStart = () => {
    if (gameType === 'around_the_world') {
      // For ATW, navigate to ATW setup instead
      const nameParam = gameName ? '&name=' + encodeURIComponent(gameName) : '';
      const puttTypeParam = '&puttType=' + puttType;
      window.location.href = createPageUrl('Home') + '?mode=atw-setup&solo=' + (isSolo ? '1' : '0') + (isSolo ? '' : '&pin=' + pin + nameParam) + puttTypeParam;
      return;
    }
    if (gameType === 'time_ladder') {
      const nameParam = gameName ? '&name=' + encodeURIComponent(gameName) : '';
      const puttTypeParam = '&puttType=' + puttType;
      window.location.href = createPageUrl('Home') + '?mode=time-ladder-setup&solo=' + (isSolo ? '1' : '0') + nameParam + puttTypeParam;
      return;
    }
    if (gameType === 'duel') {
      const params = new URLSearchParams();
      if (gameName) {
        params.set('name', gameName);
      }
      if (!isSolo) {
        params.set('pin', pin);
      }
      const baseUrl = createPageUrl(isSolo ? 'DuelSolo' : 'DuelHost');
      const query = params.toString();
      window.location.href = query ? `${baseUrl}?${query}` : baseUrl;
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

  const showPuttTooltip = (id) => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }
    setActivePuttTooltip(id);
    tooltipTimerRef.current = setTimeout(() => {
      setActivePuttTooltip(null);
    }, 1600);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4">
      <div className="max-w-xl mx-auto pt-6 pb-10">
        <div className="mb-4">
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3">
            <div className="flex items-center gap-2">
              <BackButton onClick={onBack} showLabel={false} className="h-9 w-9 justify-center px-0" />
              <HomeButton showLabel={false} className="h-9 w-9 justify-center px-0" />
            </div>
            <div className="text-center text-sm font-semibold text-slate-800">
              {isSolo ? 'Soolotreening' : 'Hosti mäng'}
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="flex h-9 items-center gap-2 rounded-2xl bg-emerald-600/90 px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,185,129,0.25)] hover:bg-emerald-700"
            >
              <Play className="h-4 w-4" />
              Alusta
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white/80 rounded-[22px] p-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Sessiooni nimi (valikuline)
            </label>
            <Input
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="nt Neljapäevane treening"
              className="h-11 rounded-2xl border-slate-200/70 bg-white/80"
            />
          </div>

          <div className={`grid ${isSolo ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
            {!isSolo && (
              <div className="rounded-[22px] border border-emerald-200/60 bg-white/80 p-3 shadow-[0_8px_18px_rgba(16,185,129,0.18)] backdrop-blur">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80">PIN</div>
                    <div className="text-2xl font-bold tracking-widest text-emerald-700">{pin}</div>
                  </div>
                  <button
                    type="button"
                    onClick={copyPin}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600/90 text-white shadow-sm hover:bg-emerald-700"
                    aria-label="Kopeeri PIN"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-[22px] border border-slate-200/70 bg-white/80 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Puti stiil</div>
              <div className="flex flex-wrap gap-2">
                {puttOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setPuttType(option.id);
                      showPuttTooltip(option.id);
                    }}
                    className={`group relative flex h-8 w-8 items-center justify-center rounded-2xl border text-sm transition ${
                      puttType === option.id
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    }`}
                    aria-label={option.label}
                  >
                    {option.icon}
                    <span
                      className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-800/90 px-2 py-1 text-[10px] font-medium text-white shadow transition duration-150 ${
                        activePuttTooltip === option.id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`pointer-events-none absolute -top-2 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-800/90 transition duration-150 ${
                        activePuttTooltip === option.id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/80 rounded-[22px] p-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)] border border-white/80 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mängu formaat
              </label>
              <FormatRulesPopup format={gameType} />
            </div>
            <GameFormatSelector selected={gameType} onSelect={setGameType} size="compact" excludeFormats={excludeFormats} />
          </div>

        </div>
      </div>
    </div>
  );
}
