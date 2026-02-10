import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const baseClasses =
  'inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:bg-black dark:border-white/10 dark:text-slate-200';

export default function BackButton({
  label = 'Tagasi',
  onClick,
  fallbackTo,
  forceFallback = false,
  showLabel = true,
  className = ''
}) {
  const navigate = useNavigate();

  const handleClick = React.useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    if (forceFallback && fallbackTo) {
      navigate(fallbackTo);
      return;
    }
    const hasHistory = typeof window !== 'undefined' && window.history.length > 1;
    if (hasHistory) {
      navigate(-1);
      return;
    }
    if (fallbackTo) {
      navigate(fallbackTo);
    }
  }, [fallbackTo, navigate, onClick]);

  return (
    <button type="button" onClick={handleClick} className={`${baseClasses} ${className}`}>
      <ArrowLeft className="w-4 h-4" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
