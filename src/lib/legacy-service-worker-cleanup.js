export async function cleanupLegacyServiceWorkers() {
  if (typeof window === 'undefined') return;

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const marker = `putikunn:legacy-sw-cleanup:${version}`;
  const params = new URLSearchParams(window.location.search);
  const forceReset = params.get('reset') === '1' || params.get('clear_cache') === '1';

  try {
    if (!forceReset && window.localStorage?.getItem(marker) === 'done') return;
  } catch {
    // Continue cleanup even if storage is blocked.
  }

  let hadServiceWorkers = false;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      hadServiceWorkers = registrations.length > 0;
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn('Legacy service worker cleanup failed', error);
  }

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      const staleKeys = hadServiceWorkers
        ? keys
        : keys.filter((key) => /putikunn|base44|workbox|precache|vite/i.test(key));
      await Promise.all(staleKeys.map((key) => window.caches.delete(key)));
    }
  } catch (error) {
    console.warn('Legacy cache cleanup failed', error);
  }

  try {
    window.localStorage?.setItem(marker, 'done');
  } catch {
    // Ignore storage failures.
  }

  if (forceReset || (hadServiceWorkers && navigator.serviceWorker?.controller)) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('reset');
    nextUrl.searchParams.delete('clear_cache');
    nextUrl.searchParams.set('v', version);
    window.location.replace(nextUrl.toString());
  }
}
