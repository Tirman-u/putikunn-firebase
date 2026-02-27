import React from 'react';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const baseClasses =
  'inline-flex items-center rounded-2xl border border-border bg-card text-foreground shadow-[0_6px_18px_rgba(26,43,46,0.12)] transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

const compactClasses = 'h-12 w-12 justify-center p-0';
const labeledClasses = 'min-h-[44px] gap-2 px-4 py-2.5 text-sm font-semibold';

export default function HomeButton({
  label = 'Avaleht',
  onClick,
  showLabel = false,
  className = ''
}) {
  const navigate = useNavigate();

  const handleClick = React.useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    navigate(createPageUrl('Home'));
  }, [navigate, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseClasses} ${showLabel ? labeledClasses : compactClasses} ${className}`}
      aria-label={label}
    >
      <Home className="h-5 w-5" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
