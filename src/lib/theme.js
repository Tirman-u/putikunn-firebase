const THEME_KEY = 'putikunn-theme';
const THEME_EVENT = 'putikunn-theme-change';

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === 'dark' ? 'dark' : 'light';
};

export const setTheme = (nextTheme) => {
  if (typeof window === 'undefined') return;
  const theme = nextTheme === 'dark' ? 'dark' : 'light';
  window.localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
};

export const initTheme = () => {
  setTheme(getStoredTheme());
};

export const subscribeTheme = (callback) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => {
    const nextTheme = event?.detail || getStoredTheme();
    callback(nextTheme);
  };
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
};
