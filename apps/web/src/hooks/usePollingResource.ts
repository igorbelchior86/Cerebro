'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingResourceState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  refresh: () => Promise<void>;
}

export function usePollingResource<T>(
  fetcher: () => Promise<T>,
  options?: { intervalMs?: number; enabled?: boolean }
): PollingResourceState<T> {
  const intervalMs = options?.intervalMs ?? 15000;
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (isManual = false) => {
    if (!enabled) {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    if (mountedRef.current) {
      if (data === null && !isManual) setLoading(true);
      else setRefreshing(true);
      setError(null);
    }

    try {
      const next = await fetcher();
      if (!mountedRef.current) return;
      setData(next);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [data, enabled, fetcher]);

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

  return {
    data,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    refresh: () => run(true),
  };
}
