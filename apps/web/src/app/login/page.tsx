'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }

      if (data.mfaRequired) {
        setTempToken(data.tempToken);
        setStep('mfa');
      } else {
        router.replace('/');
      }
    } catch {
      setError('Network error — is the API running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/mfa/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid code'); return; }
      router.replace('/');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-root)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--modal-surface)',
          border: '1px solid var(--modal-border)',
          borderRadius: '16px',
          padding: '32px',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <div
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            ⚡
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Playbook Brain
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>IT Automation Copilot</p>
          </div>
        </div>

        {step === 'credentials' ? (
          <>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Sign in
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Enter your credentials to continue
            </p>
            <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@yourcompany.com" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••••••" />
              {error && <ErrorBanner message={error} />}
              <SubmitButton loading={loading} label="Sign in" />
            </form>
          </>
        ) : (
          <>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Two-factor authentication
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Enter the 6-digit code from your authenticator app (Google Authenticator / Authy)
            </p>
            <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field
                label="Authentication code"
                type="text"
                value={code}
                onChange={setCode}
                placeholder="000 000"
                inputMode="numeric"
                maxLength={7}
                autoFocus
              />
              {error && <ErrorBanner message={error} />}
              <SubmitButton loading={loading} label="Verify" />
              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setCode(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}
              >
                ← Back to sign in
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function Field({
  label, type, value, onChange, placeholder, inputMode, maxLength, autoFocus,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: 'numeric' | 'text'; maxLength?: number; autoFocus?: boolean;
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
        inputMode={inputMode}
        maxLength={maxLength}
        autoFocus={autoFocus}
        required
        style={{
          width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
          color: 'var(--text-primary)', background: 'var(--input-bg)',
          border: '1px solid var(--input-border)', outline: 'none', boxSizing: 'border-box',
          fontFamily: 'var(--font-dm-sans, sans-serif)',
        }}
      />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
      <p style={{ fontSize: '12px', color: '#F87171', margin: 0 }}>{message}</p>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: '100%', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        background: loading ? 'rgba(91,127,255,0.5)' : 'var(--accent)',
        color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.15s', marginTop: '4px',
      }}
    >
      {loading ? 'Please wait…' : label}
    </button>
  );
}
