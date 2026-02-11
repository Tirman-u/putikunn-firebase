import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

export default function PuttTypeSelector({ selectedType, onSelect, compact = false }) {
  const { t } = useLanguage();
  const puttTypes = [
    { id: 'regular', label: t('putt.regular', 'Tavaline'), icon: '🎯', color: 'emerald' },
    { id: 'straddle', label: t('putt.straddle', 'Straddle'), icon: '🦵', color: 'blue' },
    { id: 'turbo', label: t('putt.turbo', 'Turbo'), icon: '⚡', color: 'amber' },
    { id: 'kneeling', label: t('putt.kneeling', 'Põlvelt'), icon: '🧎', color: 'teal' },
    { id: 'marksman', label: t('putt.marksman', 'Marksman'), icon: '🏹', color: 'purple' }
  ];

  const COLOR_STYLES = {
    emerald: { border: 'border-emerald-300', bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600' },
    blue: { border: 'border-blue-300', bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600' },
    amber: { border: 'border-amber-300', bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600' },
    teal: { border: 'border-teal-300', bg: 'bg-teal-50', icon: 'bg-teal-100 text-teal-600' },
    purple: { border: 'border-purple-300', bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600' }
  };

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 mb-2">
        {t('host.putt_style', 'Puti stiil')}
      </div>
      <div className={cn("grid", compact ? "grid-cols-3 gap-2" : "grid-cols-3 gap-3")}>
        {puttTypes.map((type) => {
          const style = COLOR_STYLES[type.color] || COLOR_STYLES.emerald;
          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id)}
              className={cn(
                "relative border text-left transition",
                compact ? "rounded-[16px] p-2 flex items-center gap-2" : "rounded-[22px] p-3",
                selectedType === type.id
                  ? `${style.border} ${style.bg} shadow-[0_8px_18px_rgba(15,23,42,0.08)]`
                  : "border-slate-200 bg-white/80 hover:border-slate-300"
              )}
            >
              <div className={cn(
                "inline-flex items-center justify-center rounded-2xl text-lg",
                compact ? "h-7 w-7" : "h-9 w-9",
                style.icon
              )}>
                {type.icon}
              </div>
              <div className={cn("font-semibold text-slate-800 leading-tight", compact ? "text-[11px]" : "text-[12px]")}>
                {type.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
