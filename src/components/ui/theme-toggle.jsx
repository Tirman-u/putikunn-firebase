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
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d7e4e8] bg-white text-slate-700 shadow-fp-card backdrop-blur-sm transition hover:bg-secondary dark:bg-black dark:border-[#14363f] dark:text-slate-200 dark:hover:bg-[#07161b] ${className}`}
      aria-label="Vaheta teemat"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
