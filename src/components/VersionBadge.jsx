const resolveEnvironment = () => {
  if (typeof window === 'undefined') return 'app';
  const host = window.location.hostname;
  if (host.includes('test.putikunn.ee') || host.includes('putikunn-test')) return 'test';
  if (host.includes('putikunn.ee') || host.includes('putikunn-migration')) return 'prod';
  return host || 'app';
};

export default function VersionBadge() {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
  const envLabel = resolveEnvironment();
  const handleRefresh = async () => {
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
  };

  return (
    <div
      className="fixed bottom-3 right-3 z-50 cursor-pointer rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold text-slate-100 shadow-lg transition active:scale-95 hover:bg-slate-900/90"
      title={buildTime ? `Build: ${buildTime}. Tap to refresh.` : 'Tap to refresh.'}
      role="button"
      tabIndex={0}
      onClick={handleRefresh}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleRefresh();
        }
      }}
    >
      v{version} · {envLabel}
    </div>
  );
}
