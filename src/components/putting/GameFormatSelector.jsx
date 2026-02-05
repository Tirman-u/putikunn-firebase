import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const GAME_FORMATS = [
  {
    id: 'classic',
    name: 'Classic',
    distance: '5-10m',
    description: 'Standardne formaat',
    color: 'emerald'
  },
  {
    id: 'mini_league',
    name: 'Mini Liiga',
    distance: '5-10m',
    description: 'Classic 10 ringi',
    color: 'teal',
    badge: 'BETA'
  },
  {
    id: 'back_and_forth',
    name: 'Back & Forth',
    distance: '5-10m',
    description: 'Sees→kaugemale, Mööda→lähemale',
    color: 'blue'
  },
  {
    id: 'short',
    name: 'Short',
    distance: '3-8m',
    description: 'Lähedalt harjutus',
    color: 'amber'
  },
  {
    id: 'long',
    name: 'Long',
    distance: '10-15m',
    description: 'Pika distantsi väljakutse',
    color: 'purple'
  },
  {
    id: 'streak_challenge',
    name: 'Streak',
    distance: '3-15m',
    description: 'Vali distants, lõpeb möödalöögiga',
    color: 'red'
  },
  {
    id: 'random_distance',
    name: 'Random',
    distance: '3-10m',
    description: 'Juhuslik distants igas ringis',
    color: 'indigo'
  },
  {
    id: 'around_the_world',
    name: 'Around the World',
    distance: '5-10m',
    description: 'Liigu jaamade kaupa',
    color: 'emerald',
    badge: 'BETA'
  }
];

export default function GameFormatSelector({ selected, onSelect, excludeFormats = [] }) {
  const filteredFormats = GAME_FORMATS.filter(f => !excludeFormats.includes(f.id));
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {filteredFormats.map((format) => (
        <button
          key={format.id}
          onClick={() => onSelect(format.id)}
          className={cn(
            "relative p-4 rounded-xl border-2 transition-all text-left",
            selected === format.id
              ? `border-${format.color}-500 bg-${format.color}-50`
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          {format.badge && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded transform rotate-12">
              {format.badge}
            </div>
          )}
          {selected === format.id && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="font-bold text-slate-800 mb-1">{format.name}</div>
          <div className="text-sm text-slate-600 mb-1">{format.distance}</div>
          <div className="text-xs text-slate-500">{format.description}</div>
        </button>
      ))}
    </div>
  );
}
