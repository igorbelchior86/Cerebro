'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function AcceptInviteForm() {
    const router = useRouter();
    const params = useSearchParams();
    const token = params.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!token) {
        return (
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#F87171', marginBottom: '8px' }}>Invalid invite link</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>The invite token is missing. Please use the link from your email.</p>
                <a href="/login" style={{ display: 'inline-block', marginTop: '16px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                    ← Back to sign in
                </a>
            </div>
        );
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        if (password !== confirm) { setError('Passwords do not match'); return; }
        if (password.length < 12) { setError('Password must be at least 12 characters'); return; }

        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/accept-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Failed to accept invite'); return; }
            router.replace('/triage/home');
        } catch {
            setError('Network error — is the API running?');
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Accept your invitation</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Set a password to activate your account</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <input
                        type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 12 characters" required
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm password</label>
                    <input
                        type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat password" required
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>

                {error && (
                    <div style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
                        <p style={{ fontSize: '12px', color: '#F87171', margin: 0 }}>{error}</p>
                    </div>
                )}

                <button
                    type="submit" disabled={loading || !password || !confirm}
                    style={{
                        width: '100%', padding: '11px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                        background: loading ? 'rgba(91,127,255,0.5)' : 'var(--accent)',
                        color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                        marginTop: '4px', opacity: !password || !confirm ? 0.5 : 1,
                    }}
                >
                    {loading ? 'Activating account…' : 'Activate account'}
                </button>
            </form>
        </>
    );
}

export default function AcceptInvitePage() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-root)', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: '380px' }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                        ⚡
                    </div>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Playbook Brain</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>IT Automation Copilot</p>
                    </div>
                </div>

                <div style={{ background: 'var(--modal-surface)', border: '1px solid var(--modal-border)', borderRadius: '16px', padding: '32px', backdropFilter: 'blur(24px)' }}>
                    <Suspense fallback={<p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</p>}>
                        <AcceptInviteForm />
                    </Suspense>
                </div>

                <p style={{ textAlign: 'center', marginTop: '16px' }}>
                    <a href="/login" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                        ← Back to sign in
                    </a>
                </p>
            </div>
        </div>
    );
}
