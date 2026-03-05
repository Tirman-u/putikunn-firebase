import React from 'react';
import SoloDuelPreview from '@/components/putting/SoloDuelPreview';
import BackButton from '@/components/ui/back-button';
import { createPageUrl } from '@/utils';
import HomeButton from '@/components/ui/home-button';

export default function SoloDuelPreviewPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(31,156,141,0.18),_rgba(247,252,253,1)_55%)] dark:bg-black">
      <div className="max-w-xl mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <div className="flex items-center gap-2">
            <BackButton fallbackTo={createPageUrl('Home')} forceFallback />
            <HomeButton />
          </div>
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (SOLO)</div>
          <div className="w-12" />
        </div>

        <SoloDuelPreview />
      </div>
    </div>
  );
}
