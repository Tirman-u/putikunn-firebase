import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PuttingKingScoreInput({ 
  match, 
  tournament, 
  distances, 
  onScore,
  getPlayerName 
}) {
  const [manualScoreA, setManualScoreA] = useState('');
  const [manualScoreB, setManualScoreB] = useState('');

  const handleManualScoreSubmit = () => {
    const scoreA = parseInt(manualScoreA);
    const scoreB = parseInt(manualScoreB);
    
    if (isNaN(scoreA) || isNaN(scoreB)) {
      return;
    }

    onScore({ 
      finalScoreA: scoreA, 
      finalScoreB: scoreB,
      isManual: true 
    });

    setManualScoreA('');
    setManualScoreB('');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-purple-600 font-semibold mb-1">Tiim A skoor</div>
          <Input
            type="number"
            value={manualScoreA}
            onChange={(e) => setManualScoreA(e.target.value)}
            placeholder="0"
            className="text-center"
          />
        </div>
        <div>
          <div className="text-xs text-blue-600 font-semibold mb-1">Tiim B skoor</div>
          <Input
            type="number"
            value={manualScoreB}
            onChange={(e) => setManualScoreB(e.target.value)}
            placeholder="0"
            className="text-center"
          />
        </div>
      </div>
      <Button
        onClick={handleManualScoreSubmit}
        className="w-full bg-purple-600 hover:bg-purple-700"
        disabled={!manualScoreA || !manualScoreB}
      >
        Kinnita skoor
      </Button>
    </div>
  );
}
