import React from 'react';
import HostDuelPreview from '@/components/putting/HostDuelPreview';
import BackButton from '@/components/ui/back-button';
import { createPageUrl } from '@/utils';

export default function HostDuelPreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="max-w-5xl mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <BackButton fallbackTo={createPageUrl('Home')} forceFallback />
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (HOST)</div>
          <div className="w-12" />
        </div>

        <HostDuelPreview />
      </div>
    </div>
  );
}
