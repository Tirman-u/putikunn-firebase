import React from 'react';
import { Button } from '@/components/ui/button';

export default function PuttTypeSelector({ selectedType, onSelect }) {
  const puttTypes = [
    { id: 'regular', label: 'Tavaline', icon: '🎯' },
    { id: 'straddle', label: 'Straddle', icon: '🦵' },
    { id: 'turbo', label: 'Turbo', icon: '⚡' },
    { id: 'kneeling', label: 'Põlvelt', icon: '🧎' },
    { id: 'marksman', label: 'Marksman', icon: '🏹' }
  ];

  return (
    <div className="mb-4">
      <div className="text-sm text-slate-600 mb-2 text-center">Puti stiil:</div>
      <div className="grid grid-cols-3 gap-2">
        {puttTypes.map(type => (
          <Button
            key={type.id}
            onClick={() => onSelect(type.id)}
            variant={selectedType === type.id ? 'default' : 'outline'}
            className={`h-12 ${selectedType === type.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          >
            <span className="mr-1">{type.icon}</span>
            {type.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
