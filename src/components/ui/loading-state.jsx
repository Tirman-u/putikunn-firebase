import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingState({ title = 'Laen...', description = 'Palun oota hetk', fullPage = true }) {
  const Wrapper = fullPage ? 'div' : 'div';
  return (
    <Wrapper className={fullPage ? 'min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white' : ''}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-lg font-semibold text-slate-700">{title}</div>
          <div className="text-sm text-slate-500">{description}</div>
        </div>
        <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-emerald-300 animate-pulse" />
        </div>
      </div>
    </Wrapper>
  );
}
