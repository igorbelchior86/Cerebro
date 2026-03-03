'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CerebroLogo from '@/components/CerebroLogo';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const tokenFromUrl = useMemo(() => params.get('token') || '', [params]);

  const [email, setEmail] = useState('');
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [error, setError] = useState('');

  async function handleRequestReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    setRequestMessage('');
    setRequestLoading(true);
    try {
      const res = await fetch(`${API}/auth/password/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to request reset');
        return;
      }
      setRequestMessage(data.message || 'If this email exists, a reset link was sent.');
    } catch {
      setError('Network error while requesting reset');
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleConfirmReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    setConfirmMessage('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await fetch(`${API}/auth/password/reset-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }
      setConfirmMessage(data.message || 'Password reset successfully.');
    } catch {
      setError('Network error while resetting password');
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-root)' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: 'var(--modal-surface)', border: '1px solid var(--modal-border)', borderRadius: '16px', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
          <CerebroLogo size={34} priority />
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cerebro</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Password recovery</p>
          </div>
        </div>

        <p style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 10px', color: 'var(--text-primary)' }}>Reset password</p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
          Request a reset link and then set your new password with the token.
        </p>

        <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
          <ActionButton loading={requestLoading} label="Send reset link" />
          {requestMessage && <p style={{ margin: 0, fontSize: '12px', color: '#34D399' }}>{requestMessage}</p>}
        </form>

        <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Field label="Reset token" type="text" value={token} onChange={setToken} placeholder="Paste token from email link" />
          <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="At least 12 characters" />
          <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat password" />
          <ActionButton loading={confirmLoading} label="Reset password" />
          {confirmMessage && <p style={{ margin: 0, fontSize: '12px', color: '#34D399' }}>{confirmMessage}</p>}
        </form>

        {error && <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#F87171' }}>{error}</p>}
        <a href="/login" style={{ display: 'inline-block', marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Back to login
        </a>
      </div>
    </div>
  );
}

function Field({
  label, type, value, onChange, placeholder,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          color: 'var(--text-primary)',
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'var(--font-dm-sans, sans-serif)',
        }}
      />
    </div>
  );
}

function ActionButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: '100%',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: 600,
        background: loading ? 'rgba(91,127,255,0.5)' : 'var(--accent)',
        color: '#fff',
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'Please wait…' : label}
    </button>
  );
}
