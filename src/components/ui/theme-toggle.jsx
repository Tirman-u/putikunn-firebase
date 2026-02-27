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
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-[0_6px_18px_rgba(26,43,46,0.12)] transition hover:bg-secondary ${className}`}
      aria-label="Vaheta teemat"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
