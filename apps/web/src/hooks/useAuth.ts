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

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        setUser(await res.json() as AuthUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const logout = useCallback(async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
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

  return { user, loading, logout, refresh: fetchUser, updateProfile };
}
