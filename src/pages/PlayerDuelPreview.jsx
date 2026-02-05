import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlayerDuelPreview from '@/components/putting/PlayerDuelPreview';

export default function PlayerDuelPreviewPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="max-w-xl mx-auto px-4 pb-10">
        <div className="flex items-center justify-between pt-6 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Tagasi</span>
          </button>
          <div className="text-sm font-semibold text-slate-700">Sõbraduell (Mängija)</div>
          <div className="w-12" />
        </div>

        <PlayerDuelPreview />
      </div>
    </div>
  );
}
