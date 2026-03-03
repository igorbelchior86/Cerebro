import { monitorEventLoopDelay } from 'node:perf_hooks';
import { operationalLogger } from './operational-logger.js';

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function nanosToMs(value: number): number {
  return Number((value / 1_000_000).toFixed(3));
}

export function startEventLoopMonitor(): void {
  const enabled = String(process.env.API_EVENT_LOOP_MONITOR_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return;

  const resolutionMs = readPositiveInt(process.env.API_EVENT_LOOP_MONITOR_RESOLUTION_MS, 20);
  const sampleIntervalMs = readPositiveInt(process.env.API_EVENT_LOOP_MONITOR_INTERVAL_MS, 15_000);
  const warnP99Ms = readPositiveInt(process.env.API_EVENT_LOOP_WARN_P99_MS, 250);

  const histogram = monitorEventLoopDelay({ resolution: resolutionMs });
  histogram.enable();

  const timer = setInterval(() => {
    if (histogram.count === 0) return;

    const p50Ms = nanosToMs(histogram.percentile(50));
    const p95Ms = nanosToMs(histogram.percentile(95));
    const p99Ms = nanosToMs(histogram.percentile(99));
    const maxMs = nanosToMs(histogram.max);
    const meanMs = nanosToMs(histogram.mean);

    operationalLogger.info('api.runtime.event_loop_lag', {
      module: 'api.event-loop-monitor',
      sample_interval_ms: sampleIntervalMs,
      resolution_ms: resolutionMs,
      event_loop_p50_ms: p50Ms,
      event_loop_p95_ms: p95Ms,
      event_loop_p99_ms: p99Ms,
      event_loop_max_ms: maxMs,
      event_loop_mean_ms: meanMs,
    });

    if (p99Ms >= warnP99Ms) {
      operationalLogger.warn('api.runtime.event_loop_lag_high', {
        module: 'api.event-loop-monitor',
        sample_interval_ms: sampleIntervalMs,
        event_loop_p99_ms: p99Ms,
        event_loop_warn_p99_ms: warnP99Ms,
        degraded_mode: true,
      });
    }

    histogram.reset();
  }, sampleIntervalMs);
  timer.unref();

  operationalLogger.info('api.runtime.event_loop_monitor_started', {
    module: 'api.event-loop-monitor',
    sample_interval_ms: sampleIntervalMs,
    resolution_ms: resolutionMs,
    event_loop_warn_p99_ms: warnP99Ms,
  });
}
