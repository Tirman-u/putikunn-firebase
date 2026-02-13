import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { base44 } from '@/api/base44Client';
import { pagesConfig } from '@/pages.config';

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export default function NavigationTracker() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { Pages, mainPage } = pagesConfig;
  const mainPageKey = mainPage ?? Object.keys(Pages)[0];

  const pageName = useMemo(() => {
    const pathname = location.pathname;
    if (pathname === '/' || pathname === '') {
      return mainPageKey;
    }

    const pathSegment = pathname.replace(/^\//, '').split('/')[0];
    const pageKeys = Object.keys(Pages);
    const matchedKey = pageKeys.find((key) => key.toLowerCase() === pathSegment.toLowerCase());
    return matchedKey || null;
  }, [location.pathname, Pages, mainPageKey]);

  useEffect(() => {
    if (!isAuthenticated || !pageName) return;

    base44.appLogs.logUserInApp(pageName, {
      reason: 'navigation',
      path: `${location.pathname}${location.search || ''}`
    }).catch(() => {
      // Silent fail - logging should not block UX
    });
  }, [isAuthenticated, pageName, location.pathname, location.search]);

  useEffect(() => {
    if (!isAuthenticated || !pageName) return;

    const sendHeartbeat = (reason = 'heartbeat') => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && reason === 'heartbeat') {
        return;
      }
      base44.appLogs.logUserInApp(pageName, {
        reason,
        path: `${location.pathname}${location.search || ''}`
      }).catch(() => {
        // Silent fail - logging should not block UX
      });
    };

    const timer = window.setInterval(() => sendHeartbeat('heartbeat'), HEARTBEAT_INTERVAL_MS);
    const handleFocus = () => sendHeartbeat('focus');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat('visibility');
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, pageName, location.pathname, location.search]);

  return null;
}
