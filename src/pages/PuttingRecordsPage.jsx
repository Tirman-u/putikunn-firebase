import React from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import PuttingRecords from '@/components/leaderboard/PuttingRecords';

export default function PuttingRecordsPage() {
  return (
    <DashboardShell
      activeNav="records"
      title="Records"
      subtitle="Puttingu rekordid ja tulemuste võrdlus."
    >
      <div className="mx-auto w-full max-w-[1060px]">
        <PuttingRecords />
      </div>
    </DashboardShell>
  );
}
