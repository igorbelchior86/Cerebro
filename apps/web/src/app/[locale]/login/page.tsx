'use client';

import { type FormEvent, useState } from 'react';
import CerebroLogo from '@/components/CerebroLogo';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('Login');
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
      if (!res.ok) { setError(data.error || t('loginFailed')); return; }

      if (data.mfaRequired) {
        setTempToken(data.tempToken);
        setStep('mfa');
      } else {
        router.replace('/');
      }
    } catch {
      setError(t('networkErrorApi'));
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
      if (!res.ok) { setError(data.error || t('invalidCode')); return; }
      router.replace('/');
    } catch {
      setError(t('networkError'));
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
          <CerebroLogo size={36} priority />
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Cerebro
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{t('copilot')}</p>
          </div>
        </div>

        {step === 'credentials' ? (
          <>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {t('signIn')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {t('credentialsDesc')}
            </p>
            <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label={t('emailLabel')} type="email" value={email} onChange={setEmail} placeholder={t('emailPlaceholder')} />
              <Field label={t('passwordLabel')} type="password" value={password} onChange={setPassword} placeholder={t('passwordPlaceholder')} />
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                You can also sign in with <strong>MASTER</strong> in the email field.
              </p>
              {error && <ErrorBanner message={error} />}
              <SubmitButton loading={loading} label={t('signIn')} tWait={t('pleaseWait')} />
              <a href="/reset-password" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none', textAlign: 'center' }}>
                Forgot password?
              </a>
            </form>
          </>
        ) : (
          <>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {t('mfaTitle')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {t('mfaDesc')}
            </p>
            <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field
                label={t('mfaCodeLabel')}
                type="text"
                value={code}
                onChange={setCode}
                placeholder="000 000"
                inputMode="numeric"
                maxLength={7}
                autoFocus
              />
              {error && <ErrorBanner message={error} />}
              <SubmitButton loading={loading} label={t('verifyBtn')} tWait={t('pleaseWait')} />
              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setCode(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}
              >
                {t('backToSignIn')}
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

function SubmitButton({ loading, label, tWait }: { loading: boolean; label: string; tWait?: string }) {
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
      {loading ? (tWait || 'Please wait…') : label}
    </button>
  );
}
