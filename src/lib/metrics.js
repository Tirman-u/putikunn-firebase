import { base44 } from '@/api/base44Client';

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

    if (typeof base44?.appLogs?.logEvent === 'function') {
      await base44.appLogs.logEvent(name, payload);
      return;
    }

    const metricEntity = base44?.entities?.SyncMetric || base44?.entities?.Metric;
    if (metricEntity?.create) {
      await metricEntity.create(payload);
    }
  } catch (error) {
    // Silent fail - observability should not break UX
  }
}
