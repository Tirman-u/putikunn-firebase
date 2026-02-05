import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISTANCES = [5, 6, 7, 8, 9, 10];

function ProgressRow({ label, distance, colorClass }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          {distance}m
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {DISTANCES.map((step) => (
          <div
            key={`${label}-${step}`}
            className={cn(
              'h-2 rounded-full border',
              step <= distance ? colorClass : 'bg-slate-100 border-slate-200'
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-6 text-[10px] text-slate-400">
        {DISTANCES.map((step) => (
          <span key={`${label}-label-${step}`} className="text-center">
            {step}m
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PlayerDuelPreview() {
  const [discCount, setDiscCount] = React.useState('3');
  const [viewMode, setViewMode] = React.useState('active');
  const numberButtons = discCount === '3' ? [1, 2, 3] : [1, 2, 3, 4, 5];
  const gridCols = discCount === '5' ? 'grid-cols-5' : 'grid-cols-3';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Jaam</div>
            <div className="text-lg font-semibold text-slate-800">Jaam 3</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Vastane</div>
            <div className="text-lg font-semibold text-slate-800">Marko</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Režiim: {discCount} ketast • Distants 5–10m</span>
          <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
            Punktid: 4
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Progress</div>
          <div className="text-xs text-slate-500">Mõlemad sisestavad paralleelselt</div>
        </div>
        <div className="space-y-4">
          <ProgressRow label="Sina" distance={8} colorClass="bg-emerald-500 border-emerald-500" />
          <ProgressRow label="Vastane" distance={7} colorClass="bg-sky-500 border-sky-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Sisesta tulemus</div>
          <ToggleGroup
            type="single"
            value={discCount}
            onValueChange={(value) => value && setDiscCount(value)}
            className="grid grid-cols-3 gap-1"
          >
            <ToggleGroupItem value="1" className="rounded-full text-[11px]">1</ToggleGroupItem>
            <ToggleGroupItem value="3" className="rounded-full text-[11px]">3</ToggleGroupItem>
            <ToggleGroupItem value="5" className="rounded-full text-[11px]">5</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {discCount === '1' ? (
          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-4 text-base font-semibold text-emerald-700 shadow-sm">
              Sees
            </button>
            <button className="rounded-2xl border-2 border-rose-200 bg-rose-50 py-4 text-base font-semibold text-rose-700 shadow-sm">
              Mööda
            </button>
          </div>
        ) : (
          <div className={cn('grid gap-3', gridCols)}>
            {numberButtons.map((num) => (
              <button
                key={`made-${num}`}
                className="rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 text-base font-semibold text-slate-800 shadow-sm"
              >
                {num}
              </button>
            ))}
          </div>
        )}

        <Button variant="outline" className="w-full rounded-xl">
          Undo
        </Button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">Uue duelli olek</div>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value)}
            className="grid grid-cols-3 gap-1"
          >
            <ToggleGroupItem value="active" className="rounded-full text-[11px]">
              Duell käib
            </ToggleGroupItem>
            <ToggleGroupItem value="ready" className="rounded-full text-[11px]">
              Uus paariline
            </ToggleGroupItem>
            <ToggleGroupItem value="summary" className="rounded-full text-[11px]">
              Raport
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {viewMode === 'active' && (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Ootab vastase sisestust…
          </div>
        )}

        {viewMode === 'ready' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-slate-700">
              Uus vastane: Marko • Jaam 2 • 9m
            </div>
            <Button className="w-full rounded-xl">Kinnita jaam</Button>
          </div>
        )}

        {viewMode === 'summary' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-slate-700">
              Võitja: Oscar • Punktid: 9 • Kõrgeim jaam: 1
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-4 bg-slate-50 text-[11px] font-semibold text-slate-600 px-3 py-2">
                <div>Mängija</div>
                <div className="text-center">Punktid</div>
                <div className="text-center">V/K</div>
                <div className="text-center">Jaam</div>
              </div>
              {[
                { name: 'Oscar', points: 9, wins: 8, losses: 4, station: 1 },
                { name: 'Marko', points: 7, wins: 6, losses: 5, station: 2 },
                { name: 'Liis', points: 5, wins: 4, losses: 6, station: 3 }
              ].map((row, idx) => (
                <div
                  key={row.name}
                  className={cn(
                    'grid grid-cols-4 items-center px-3 py-2 text-xs',
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
            <Button variant="outline" className="w-full rounded-xl">Tagasi avalehele</Button>
          </div>
        )}
      </div>
    </div>
  );
}
