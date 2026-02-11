import React from 'react';
import { Check, Target, Medal, Swords, ArrowLeftRight, ArrowDownRight, ArrowUpRight, Flame, Shuffle, Globe, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

const GAME_FORMATS = [
  {
    id: 'classic',
    name: 'Classic',
    distance: '5-10m',
    description: 'Standardne formaat',
    color: 'emerald',
    icon: Target
  },
  {
    id: 'mini_league',
    name: 'Mini Liiga',
    distance: '5-10m',
    description: 'Classic 10 ringi',
    color: 'teal',
    badge: 'BETA',
    icon: Medal
  },
  {
    id: 'duel',
    name: 'Sõbraduell',
    distance: '5-10m',
    description: 'Duell PIN-iga',
    color: 'emerald',
    badge: 'BETA',
    icon: Swords
  },
  {
    id: 'back_and_forth',
    name: 'Back & Forth',
    distance: '5-10m',
    description: 'Sees→kaugemale, Mööda→lähemale',
    color: 'blue',
    icon: ArrowLeftRight
  },
  {
    id: 'short',
    name: 'Short',
    distance: '3-8m',
    description: 'Lähedalt harjutus',
    color: 'amber',
    icon: ArrowDownRight
  },
  {
    id: 'long',
    name: 'Long',
    distance: '10-15m',
    description: 'Pika distantsi väljakutse',
    color: 'purple',
    icon: ArrowUpRight
  },
  {
    id: 'streak_challenge',
    name: 'Streak',
    distance: '3-15m',
    description: 'Vali distants, lõpeb möödalöögiga',
    color: 'red',
    icon: Flame
  },
  {
    id: 'random_distance',
    name: 'Random',
    distance: '3-10m',
    description: 'Juhuslik distants igas ringis',
    color: 'indigo',
    icon: Shuffle
  },
  {
    id: 'time_ladder',
    name: 'Aja väljakutse',
    distance: '5-10m',
    description: 'Stopper + 5 järjest sees → +1m',
    color: 'emerald',
    icon: Timer
  },
  {
    id: 'around_the_world',
    name: 'Around the World',
    distance: '5-10m',
    description: 'Liigu jaamade kaupa',
    color: 'emerald',
    badge: 'BETA',
    icon: Globe
  }
];

const COLOR_STYLES = {
  emerald: {
    border: 'border-emerald-400',
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    icon: 'text-emerald-600',
    ring: 'ring-emerald-200'
  },
  teal: {
    border: 'border-teal-400',
    bg: 'bg-teal-50',
    iconBg: 'bg-teal-100',
    icon: 'text-teal-600',
    ring: 'ring-teal-200'
  },
  blue: {
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    icon: 'text-blue-600',
    ring: 'ring-blue-200'
  },
  amber: {
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    icon: 'text-amber-600',
    ring: 'ring-amber-200'
  },
  purple: {
    border: 'border-purple-400',
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    icon: 'text-purple-600',
    ring: 'ring-purple-200'
  },
  red: {
    border: 'border-red-400',
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    icon: 'text-red-600',
    ring: 'ring-red-200'
  },
  indigo: {
    border: 'border-indigo-400',
    bg: 'bg-indigo-50',
    iconBg: 'bg-indigo-100',
    icon: 'text-indigo-600',
    ring: 'ring-indigo-200'
  }
};

export default function GameFormatSelector({ selected, onSelect, excludeFormats = [], size = 'regular' }) {
  const filteredFormats = GAME_FORMATS.filter(f => !excludeFormats.includes(f.id));
  const isCompact = size === 'compact';
  
  return (
    <div className={cn("grid", isCompact ? "grid-cols-3 gap-2 sm:grid-cols-3" : "grid-cols-2 gap-3")}>
      {filteredFormats.map((format) => (
        <button
          key={format.id}
          onClick={() => onSelect(format.id)}
          className={cn(
            "relative rounded-2xl border-2 text-center transition-all",
            isCompact ? "p-2" : "p-3",
            selected === format.id
              ? `${COLOR_STYLES[format.color]?.border} ${COLOR_STYLES[format.color]?.bg}`
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          {format.badge && (
            <div className={cn(
              "absolute px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded-full",
              isCompact ? "top-1.5 right-1.5" : "top-2 right-2"
            )}>
              {format.badge}
            </div>
          )}
          {selected === format.id && (
            <div className={cn(
              "absolute bg-emerald-500 rounded-full flex items-center justify-center",
              isCompact ? "top-1.5 left-1.5 w-5 h-5" : "top-2 left-2 w-6 h-6"
            )}>
              <Check className={cn("text-white", isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
            </div>
          )}
          <div className={cn(
            "mx-auto mb-2 flex items-center justify-center rounded-2xl ring-1",
            isCompact ? "h-9 w-9" : "h-12 w-12",
            COLOR_STYLES[format.color]?.iconBg,
            COLOR_STYLES[format.color]?.ring
          )}>
            {format.icon && <format.icon className={cn(COLOR_STYLES[format.color]?.icon, isCompact ? "h-5 w-5" : "h-6 w-6")} />}
          </div>
          <div className={cn("font-semibold text-slate-800 mb-0.5", isCompact ? "text-xs" : "text-sm")}>{format.name}</div>
          <div className={cn("text-slate-500", isCompact ? "text-[10px]" : "text-[11px]")}>{format.distance}</div>
          {!isCompact && (
            <div className="mt-1 text-[10px] leading-snug text-slate-400">{format.description}</div>
          )}
        </button>
      ))}
    </div>
  );
}
