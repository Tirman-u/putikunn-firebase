import React from 'react';

const resolveEnvironment = () => {
  if (typeof window === 'undefined') return 'app';
  const host = window.location.hostname;
  if (host.includes('test.putikunn.ee') || host.includes('putikunn-test')) return 'test';
  if (host.includes('putikunn.ee') || host.includes('putikunn-migration')) return 'prod';
  return host || 'app';
};

async function runHardRefresh() {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('Cache clear failed', err);
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch (err) {
    console.warn('Service worker unregister failed', err);
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('v', Date.now().toString());
  window.location.replace(nextUrl.toString());
}

export default function VersionBadge({ inline = false }) {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
  const envLabel = resolveEnvironment();
  const [isOpen, setIsOpen] = React.useState(false);

  const containerClass = inline
    ? 'relative inline-flex flex-col items-end'
    : 'fixed bottom-3 right-3 z-50 inline-flex flex-col items-end';

  const triggerClass = inline
    ? 'cursor-pointer rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm transition hover:bg-white dark:bg-black dark:border-white/10 dark:text-slate-300'
    : 'cursor-pointer rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold text-slate-100 shadow-lg transition hover:bg-slate-900/90';

  return (
    <div className={containerClass}>
      <button
        type="button"
        className={triggerClass}
        title={buildTime ? `Build: ${buildTime}` : 'Versioon'}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        v{version} · {envLabel}
      </button>

      {isOpen && (
        <button
          type="button"
          onClick={runHardRefresh}
          className="mt-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 dark:bg-black dark:border-amber-400/40 dark:text-amber-300"
        >
          Hard refresh
        </button>
      )}
    </div>
  );
}
