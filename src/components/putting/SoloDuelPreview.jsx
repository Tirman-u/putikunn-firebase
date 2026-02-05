import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISTANCES = [5, 6, 7, 8, 9, 10];

function ProgressRow({ name, distance, activeClass, badgeClass }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{name}</div>
        <div className={cn('text-xs font-semibold px-2 py-1 rounded-full', badgeClass)}>
          {distance}m
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {DISTANCES.map((step) => (
          <div
            key={`${name}-${step}`}
            className={cn(
              'h-2 rounded-full border',
              step <= distance ? activeClass : 'bg-slate-100 border-slate-200'
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-6 text-[10px] text-slate-400">
        {DISTANCES.map((step) => (
          <span key={`${name}-label-${step}`} className="text-center">
            {step}m
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SoloDuelPreview() {
  const [discCount, setDiscCount] = React.useState('3');
  const playerA = { name: 'Oscar', distance: 7 };
  const playerB = { name: 'Rasmus', distance: 8 };

  const numberButtons = discCount === '3' ? [1, 2, 3] : [1, 2, 3, 4, 5];
  const gridCols = discCount === '5' ? 'grid-cols-5' : 'grid-cols-3';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">PIN</div>
            <div className="text-lg font-semibold text-slate-800">4821</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Režiim</div>
            <div className="text-sm font-semibold text-slate-800">{discCount} ketast</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Progress 5–10m</span>
          <span>Mõlemad sisestavad paralleelselt</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
        <ProgressRow
          name={`${playerA.name} (sina)`}
          distance={playerA.distance}
          activeClass="bg-emerald-500 border-emerald-500"
          badgeClass="bg-emerald-50 text-emerald-700"
        />
        <ProgressRow
          name={playerB.name}
          distance={playerB.distance}
          activeClass="bg-sky-500 border-sky-500"
          badgeClass="bg-sky-50 text-sky-700"
        />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Sisesta tulemus</div>
          <div className="text-xs text-slate-500">Undo kuni vastane pole sisestanud</div>
        </div>

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

        {discCount === '1' ? (
          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-5 text-base font-semibold text-emerald-700 shadow-sm">
              Sees
            </button>
            <button className="rounded-2xl border-2 border-rose-200 bg-rose-50 py-5 text-base font-semibold text-rose-700 shadow-sm">
              Mööda
            </button>
          </div>
        ) : (
          <div className={cn('grid gap-3', gridCols)}>
            {numberButtons.map((num) => (
              <button
                key={`made-${num}`}
                className="rounded-2xl border-2 border-slate-200 bg-slate-50 py-4 text-base font-semibold text-slate-800 shadow-sm"
              >
                {num}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Ootab vastase sisestust…
        </div>

        <Button variant="outline" className="w-full rounded-xl">
          Undo
        </Button>
      </div>
    </div>
  );
}
