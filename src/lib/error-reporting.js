import { base44 } from '@/api/base44Client';

const recentErrorSignatures = new Map();
const DEDUPE_WINDOW_MS = 15000;

const getBuildVersion = () => (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0');
const getBuildTime = () => (typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null);

const resolveEnvLabel = () => {
  if (typeof window === 'undefined') return 'app';
  const host = window.location.hostname;
  if (host.includes('test.putikunn.ee') || host.includes('putikunn-test')) return 'test';
  if (host.includes('putikunn.ee') || host.includes('putikunn-migration')) return 'prod';
  return host || 'local';
};

const normalizeError = (error) => {
  if (!error) {
    return { message: 'Unknown error', stack: '' };
  }
  if (typeof error === 'string') {
    return { message: error, stack: '' };
  }
  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error',
      stack: error.stack ? String(error.stack) : '',
      name: error.name || 'Error'
    };
  }
  if (typeof error === 'object') {
    return {
      message: error.message ? String(error.message) : JSON.stringify(error),
      stack: error.stack ? String(error.stack) : '',
      name: error.name ? String(error.name) : undefined
    };
  }
  return { message: String(error), stack: '' };
};

export const reportClientError = async ({
  source = 'client.error',
  error,
  componentStack = '',
  details = {},
  tags = []
} = {}) => {
  const normalized = normalizeError(error);
  const stack = normalized.stack || '';
  const signature = [
    source,
    normalized.message,
    stack.slice(0, 500),
    componentStack.slice(0, 500),
    typeof window !== 'undefined' ? window.location.href : ''
  ].join('\n');

  const now = Date.now();
  const lastSeenAt = recentErrorSignatures.get(signature) || 0;
  if (now - lastSeenAt < DEDUPE_WINDOW_MS) return;
  recentErrorSignatures.set(signature, now);

  let user = null;
  try {
    user = await base44.auth.me();
  } catch {
    user = null;
  }

  const payload = {
    message: normalized.message,
    error_name: normalized.name || null,
    stack,
    component_stack: componentStack || '',
    source,
    status: 'error',
    tags: Array.from(new Set(['client', source, ...tags].filter(Boolean))),
    details,
    app_version: getBuildVersion(),
    build_time: getBuildTime(),
    app_env: resolveEnvLabel(),
    url: typeof window !== 'undefined' ? window.location.href : null,
    path: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search || ''}` : null,
    user_email: user?.email || null,
    user_id: user?.id || null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    occurred_at: new Date().toISOString()
  };

  try {
    await base44.entities.ErrorLog.create(payload);
  } catch (logError) {
    // eslint-disable-next-line no-console
    console.error('Failed to log client error:', logError);
  }
};

export const installGlobalErrorHandlers = () => {
  if (typeof window === 'undefined') return;
  if (window.__putikunnErrorHandlersInstalled) return;
  window.__putikunnErrorHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      source: 'window.error',
      error: event.error || event.message,
      details: {
        filename: event.filename || null,
        lineno: event.lineno || null,
        colno: event.colno || null
      },
      tags: ['global_error']
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError({
      source: 'window.unhandledrejection',
      error: event.reason || 'Unhandled promise rejection',
      tags: ['promise_rejection']
    });
  });
};
