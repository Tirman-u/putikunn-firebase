import React from 'react';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const baseClasses =
  'inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:bg-black dark:border-white/10 dark:text-slate-200';

export default function HomeButton({
  label = 'Avaleht',
  onClick,
  showLabel = true,
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
    <button type="button" onClick={handleClick} className={`${baseClasses} ${className}`}>
      <Home className="w-4 h-4" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
