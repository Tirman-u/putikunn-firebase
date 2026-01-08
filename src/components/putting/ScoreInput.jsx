import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ScoreInput({ player, maxScore = 10, onSubmit, currentScore = null }) {
  const [score, setScore] = useState(currentScore ?? 0);

  const handleIncrement = () => {
    if (score < maxScore) setScore(s => s + 1);
  };

  const handleDecrement = () => {
    if (score > 0) setScore(s => s - 1);
  };

  const handleQuickScore = (value) => {
    setScore(value);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-slate-800">{player}</h3>
        <p className="text-sm text-slate-400">Enter putts made</p>
      </div>

      {/* Score Display */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <button
          onClick={handleDecrement}
          className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Minus className="w-6 h-6 text-slate-600" />
        </button>
        
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
          <span className="text-4xl font-bold text-white">{score}</span>
        </div>
        
        <button
          onClick={handleIncrement}
          className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6 text-slate-600" />
        </button>
      </div>

      {/* Quick Score Buttons */}
      <div className="grid grid-cols-6 gap-2 mb-6">
        {Array.from({ length: maxScore + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => handleQuickScore(i)}
            className={cn(
              "py-2 rounded-lg text-sm font-medium transition-all",
              score === i 
                ? "bg-emerald-500 text-white shadow-md" 
                : "bg-slate-100 text-slate-600 active:scale-95"
            )}
          >
            {i}
          </button>
        ))}
      </div>

      {/* Submit Button */}
      <Button 
        onClick={() => onSubmit(score)} 
        className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-lg font-semibold rounded-xl shadow-lg shadow-emerald-200"
      >
        <Check className="w-5 h-5 mr-2" />
        Confirm Score
      </Button>
    </div>
  );
}