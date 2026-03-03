'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  preferences?: Record<string, unknown>;
  role: 'owner' | 'admin' | 'member';
  mfaEnabled: boolean;
  createdAt: string;
  tenant: { id: string; name: string; slug: string };
}

export type AuthSessionState = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable';

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  sessionState: AuthSessionState;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState<AuthSessionState>('loading');

  const fetchUser = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include', signal: controller.signal });
      if (res.ok) {
        setUser(await res.json() as AuthUser);
        setSessionState('authenticated');
      } else {
        if (res.status === 401 || res.status === 403) {
          setUser(null);
          setSessionState('unauthenticated');
        } else {
          setSessionState('unavailable');
        }
      }
    } catch {
      setSessionState('unavailable');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const logout = useCallback(async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    setSessionState('unauthenticated');
    window.location.href = '/login';
  }, []);

  const updateProfile = useCallback(async (data: Partial<AuthUser>) => {
    try {
      const res = await fetch(`${API}/auth/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (res.ok) {
        const { profile } = await res.json();
        setUser((prev) => prev ? { ...prev, ...profile } : null);
      }
    } catch (e) {
      console.error('Failed to update profile', e);
    }
  }, []);

  return { user, loading, sessionState, logout, refresh: fetchUser, updateProfile };
}
