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
const playerStats = {
  Rasmus: { wins: 6, draws: 1, losses: 2, points: 8 },
  Oscar: { wins: 5, draws: 2, losses: 3, points: 7 },
  Sten: { wins: 4, draws: 1, losses: 4, points: 5 },
  Katrin: { wins: 4, draws: 0, losses: 3, points: 4 },
  Marko: { wins: 3, draws: 2, losses: 4, points: 4 },
  Liis: { wins: 3, draws: 1, losses: 5, points: 4 },
  Urmas: { wins: 2, draws: 1, losses: 4, points: 3 },
  Marge: { wins: 2, draws: 0, losses: 4, points: 2 },
  Jaan: { wins: 1, draws: 1, losses: 4, points: 2 },
  Mari: { wins: 1, draws: 2, losses: 3, points: 3 },
  Karl: { wins: 0, draws: 1, losses: 4, points: 1 },
  Grete: { wins: 0, draws: 2, losses: 3, points: 2 }
};
const leaderboard = [
  { name: 'Rasmus', points: 7, wins: 6, losses: 2, station: 1 },
  { name: 'Oscar', points: 6, wins: 5, losses: 3, station: 2 },
  { name: 'Katrin', points: 5, wins: 4, losses: 2, station: 2 },
  { name: 'Marko', points: 4, wins: 3, losses: 3, station: 3 },
  { name: 'Liis', points: 3, wins: 2, losses: 4, station: 4 }
];

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
                      <span className="font-semibold text-slate-800">{player}</span>
                      <span className="text-[11px] text-slate-400">
                        V {playerStats[player]?.wins ?? 0} · Viik {playerStats[player]?.draws ?? 0} · K {playerStats[player]?.losses ?? 0} · P {playerStats[player]?.points ?? 0}
                      </span>
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
          <div className="text-sm font-semibold text-slate-800">Live edetabel</div>
          <div className="text-xs text-slate-500">Punktid + võidud/kaotused</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-4 bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-2">
            <div>Mängija</div>
            <div className="text-center">Punktid</div>
            <div className="text-center">V/K</div>
            <div className="text-center">Jaam</div>
          </div>
          {leaderboard.map((row, idx) => (
            <div
              key={row.name}
              className={cn(
                'grid grid-cols-4 items-center px-3 py-2 text-sm',
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
              )}
            >
              <div className="font-semibold text-slate-800">{row.name}</div>
              <div className="text-center font-semibold text-emerald-600">{row.points}</div>
              <div className="text-center text-slate-600">{row.wins}/{row.losses}</div>
              <div className="text-center text-slate-600">{row.station}</div>
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
