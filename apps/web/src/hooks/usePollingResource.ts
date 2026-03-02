'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkflowRealtimeEnvelope } from '@cerebro/types';

export interface PollingResourceState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  realtime: {
    enabled: boolean;
    connected: boolean;
    degraded: boolean;
    reason: string | null;
    reconnectAttempt: number;
    lastEventAt: string | null;
  };
  refresh: () => Promise<void>;
}

export function usePollingResource<T>(
  fetcher: () => Promise<T>,
  options?: { intervalMs?: number; enabled?: boolean; realtime?: { path: string; enabled?: boolean } }
): PollingResourceState<T> {
  const intervalMs = options?.intervalMs ?? 15000;
  const enabled = options?.enabled ?? true;
  const realtimeEnabled = Boolean(enabled && options?.realtime?.path && (options?.realtime?.enabled ?? true));
  const realtimePath = options?.realtime?.path || '';
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeDegraded, setRealtimeDegraded] = useState(false);
  const [realtimeReason, setRealtimeReason] = useState<string | null>(null);
  const [realtimeReconnectAttempt, setRealtimeReconnectAttempt] = useState(0);
  const [realtimeLastEventAt, setRealtimeLastEventAt] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const dataRef = useRef<T | null>(null);
  const fetcherRef = useRef(fetcher);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const run = useCallback(async (isManual = false) => {
    if (!enabled) {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    if (mountedRef.current) {
      if (dataRef.current === null && !isManual) setLoading(true);
      else setRefreshing(true);
      setError(null);
    }

    try {
      const next = await fetcherRef.current();
      if (!mountedRef.current) return;
      setData(next);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void run(false);
    const id = window.setInterval(() => {
      void run(false);
    }, Math.max(5000, intervalMs));
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, run]);

  useEffect(() => {
    if (!realtimeEnabled) {
      setRealtimeConnected(false);
      setRealtimeDegraded(false);
      setRealtimeReason(null);
      setRealtimeReconnectAttempt(0);
      setRealtimeLastEventAt(null);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
    const streamUrl = `${apiBase}${realtimePath}`;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (cancelled || !mountedRef.current) return;
      clearReconnectTimer();
      const source = new EventSource(streamUrl, { withCredentials: true });
      eventSourceRef.current = source;

      source.onopen = () => {
        if (!mountedRef.current || cancelled) return;
        reconnectAttemptRef.current = 0;
        setRealtimeReconnectAttempt(0);
        setRealtimeConnected(true);
        setRealtimeDegraded(false);
        setRealtimeReason(null);
      };

      source.onmessage = () => {
        if (!mountedRef.current || cancelled) return;
        setRealtimeLastEventAt(new Date().toISOString());
      };

      const onEnvelope = (raw: MessageEvent<string>) => {
        if (!mountedRef.current || cancelled) return;
        try {
          const envelope = JSON.parse(raw.data) as WorkflowRealtimeEnvelope;
          setRealtimeLastEventAt(new Date().toISOString());
          if (envelope.kind === 'connection.state' && envelope.payload.state === 'degraded') {
            setRealtimeDegraded(true);
            setRealtimeReason(envelope.payload.reason || 'realtime_degraded');
          } else if (envelope.kind === 'ticket.change') {
            void run(false);
          }
        } catch {
          // ignore malformed events and keep stream alive
        }
      };

      source.addEventListener('ticket.change', onEnvelope as EventListener);
      source.addEventListener('connection.state', onEnvelope as EventListener);
      source.addEventListener('heartbeat', onEnvelope as EventListener);

      source.onerror = () => {
        if (!mountedRef.current || cancelled) return;
        setRealtimeConnected(false);
        setRealtimeDegraded(true);
        setRealtimeReason('realtime_unavailable_using_polling');
        source.close();
        reconnectAttemptRef.current += 1;
        const attempt = reconnectAttemptRef.current;
        setRealtimeReconnectAttempt(attempt);
        const delayMs = Math.min(30_000, 1_000 * Math.pow(2, Math.min(attempt, 5)));
        reconnectTimerRef.current = window.setTimeout(() => {
          if (cancelled || !mountedRef.current) return;
          connect();
        }, delayMs);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [realtimeEnabled, realtimePath, run]);

  return {
    data,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    realtime: {
      enabled: realtimeEnabled,
      connected: realtimeConnected,
      degraded: realtimeDegraded,
      reason: realtimeReason,
      reconnectAttempt: realtimeReconnectAttempt,
      lastEventAt: realtimeLastEventAt,
    },
    refresh: () => run(true),
  };
}
