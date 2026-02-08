import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AIInsights() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI sooritusanalüüs
        </h3>
      </div>
      <div className="text-center py-8 text-slate-400">
        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">AI sooritusanalüüs on peagi tulekul.</p>
        <p className="text-sm">See funktsionaalsus aktiveeritakse pärast andmete migreerimist.</p>
      </div>
    </div>
  );
}
