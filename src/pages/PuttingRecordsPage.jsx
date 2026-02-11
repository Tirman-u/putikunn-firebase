import React from 'react';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import PuttingRecords from '@/components/leaderboard/PuttingRecords';

export default function PuttingRecordsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 pt-4">
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
          </div>
          <div className="w-16" />
        </div>

        <PuttingRecords />
      </div>
    </div>
  );
}
