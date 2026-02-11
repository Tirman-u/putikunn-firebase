import React from 'react';
import PlayerDuelPreview from '@/components/putting/PlayerDuelPreview';
import BackButton from '@/components/ui/back-button';
import { createPageUrl } from '@/utils';

export default function PlayerDuelPreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="max-w-xl mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <BackButton fallbackTo={createPageUrl('Home')} forceFallback />
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (Mängija)</div>
          <div className="w-12" />
        </div>

        <PlayerDuelPreview />
      </div>
    </div>
  );
}
