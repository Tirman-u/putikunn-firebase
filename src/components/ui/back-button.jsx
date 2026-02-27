import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const baseClasses =
  'inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-[0_6px_18px_rgba(26,43,46,0.12)] transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

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
  }, [fallbackTo, navigate, onClick, forceFallback]);

  return (
    <button type="button" onClick={handleClick} className={`${baseClasses} ${className}`}>
      <ArrowLeft className="w-5 h-5" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
