import React from 'react';
import { Trophy, Target } from 'lucide-react';

export default function PuttingRecords() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h2 className="text-2xl font-bold text-slate-800">Puttingu rekordid</h2>
      </div>
      <div className="text-center py-12 text-slate-400">
        <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Edetabeli funktsionaalsus on peagi tulekul.</p>
        <p className="text-sm">Migreerime andmeid uude süsteemi.</p>
      </div>
    </div>
  );
}
