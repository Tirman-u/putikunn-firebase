import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const stations = [
  { id: 1, status: 'Mäng käib', distance: 9, players: ['Rasmus', 'Oscar'] },
  { id: 2, status: 'Mäng käib', distance: 8, players: ['Sten', 'Katrin'] },
  { id: 3, status: 'Ootab', distance: 7, players: ['Marko', 'Liis'] },
  { id: 4, status: 'Mäng käib', distance: 6, players: ['Urmas', 'Marge'] },
  { id: 5, status: 'Ootab', distance: 6, players: ['Jaan', 'Mari'] },
  { id: 6, status: 'Mäng käib', distance: 5, players: ['Karl', 'Grete'] }
];

const queue = ['Peeter', 'Anu', 'Kristjan', 'Sander'];

export default function HostDuelPreview() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Sõbraduell (HOST)</div>
            <div className="text-lg font-semibold text-slate-800">Kolmapäeva duell</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">PIN</div>
            <div className="text-lg font-semibold text-slate-800">6842</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-4">
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <div className="font-semibold text-emerald-700">Režiim</div>
            <div>3 ketast</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-700">Jaamad</div>
            <div>6</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-700">Mängijad</div>
            <div>12 / 12</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-700">Staatus</div>
            <div>Aktiivne</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="rounded-xl">Alusta mängu</Button>
          <Button variant="outline" className="rounded-xl">Lõpeta mäng</Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Jaamad</div>
          <div className="text-xs text-slate-500">1 = tugevam • 6 = lihtsam</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {stations.map((station) => (
            <div key={station.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">Jaam {station.id}</div>
                <span
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-full font-semibold',
                    station.status === 'Mäng käib'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  )}
                >
                  {station.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
                {station.players.map((player, index) => (
                  <div key={player} className="rounded-xl bg-white px-3 py-3 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{player}</span>
                      <span className="text-[11px] font-semibold text-slate-500">{station.distance}m</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 text-[9px] text-slate-400">
                      {[5, 6, 7, 8, 9, 10].map((step) => (
                        <span key={`${player}-${step}`} className="text-center">
                          {step}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[5, 6, 7, 8, 9, 10].map((step) => (
                        <div
                          key={`${player}-bar-${step}`}
                          className={cn(
                            'h-1.5 rounded-full border',
                            step <= station.distance
                              ? index === 0
                                ? 'bg-emerald-400 border-emerald-400'
                                : 'bg-sky-400 border-sky-400'
                              : 'bg-slate-100 border-slate-200'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Ootejärjekord</div>
          <div className="text-xs text-slate-500">Ootab vaba jaama</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {queue.map((player) => (
            <span key={player} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {player}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
