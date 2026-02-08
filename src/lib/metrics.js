const SAMPLE_RATE = 0.2;

export async function logSyncMetric(name, durationMs, context = {}) {
  try {
    if (Math.random() > SAMPLE_RATE) return;
    const payload = {
      name,
      duration_ms: Math.round(durationMs),
      ...context,
      created_at: new Date().toISOString()
    };

    // Temporarily disable base44 logging
    // if (typeof base44?.appLogs?.logEvent === 'function') {
    //   await base44.appLogs.logEvent(name, payload);
    //   return;
    // }

    // Avoid noisy console errors when metrics schema is not available in the app
    return;
  } catch (error) {
    // Silent fail - observability should not break UX
  }
}
