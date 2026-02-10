import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { getStoredTheme, setTheme, subscribeTheme } from '@/lib/theme';

export default function ThemeToggle({ className = '' }) {
  const [theme, setThemeState] = React.useState(getStoredTheme());

  React.useEffect(() => {
    return subscribeTheme((nextTheme) => {
      setThemeState(nextTheme);
    });
  }, []);

  const handleToggle = React.useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/70 text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white dark:bg-black dark:border-white/10 dark:text-slate-200 ${className}`}
      aria-label="Vaheta teemat"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
