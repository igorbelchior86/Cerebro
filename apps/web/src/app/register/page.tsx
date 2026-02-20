'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');

        if (form.password !== form.confirm) {
            setError('Passwords do not match');
            return;
        }
        if (form.password.length < 12) {
            setError('Password must be at least 12 characters');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/register-tenant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Registration failed');
                return;
            }
            router.replace('/triage/home');
        } catch {
            setError('Network error — is the API running?');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-root)', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
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

                {/* Card */}
                <div style={{ background: 'var(--modal-surface)', border: '1px solid var(--modal-border)', borderRadius: '16px', padding: '32px', backdropFilter: 'blur(24px)' }}>
                    <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Create your workspace</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Set up your MSP account in Playbook Brain</p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <Field
                            label="Company name"
                            type="text"
                            value={form.name}
                            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                            placeholder="Acme MSP Corp"
                        />
                        <Field
                            label="Work email"
                            type="email"
                            value={form.email}
                            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                            placeholder="you@yourcompany.com"
                        />
                        <Field
                            label="Password"
                            type="password"
                            value={form.password}
                            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                            placeholder="Min. 12 characters"
                        />
                        <Field
                            label="Confirm password"
                            type="password"
                            value={form.confirm}
                            onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
                            placeholder="Repeat password"
                        />

                        {error && (
                            <div style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
                                <p style={{ fontSize: '12px', color: '#F87171', margin: 0 }}>{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !form.name || !form.email || !form.password || !form.confirm}
                            style={{
                                width: '100%', padding: '11px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                background: loading ? 'rgba(91,127,255,0.5)' : 'var(--accent)',
                                color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'opacity 0.15s', marginTop: '4px', opacity: (!form.name || !form.email || !form.password || !form.confirm) ? 0.5 : 1,
                            }}
                        >
                            {loading ? 'Creating workspace…' : 'Create workspace'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
                        Already have an account?{' '}
                        <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
                    </p>
                </div>

                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-faint)', marginTop: '16px' }}>
                    By creating an account you agree to our Terms of Service
                </p>
            </div>
        </div>
    );
}

function Field({ label, type, value, onChange, placeholder }: {
    label: string; type: string; value: string;
    onChange: (v: string) => void; placeholder?: string;
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
                    width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
                    color: 'var(--text-primary)', background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)', outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'var(--font-dm-sans, sans-serif)',
                }}
            />
        </div>
    );
}
