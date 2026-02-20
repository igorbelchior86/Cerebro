import type { ReactNode } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  type?: 'text' | 'status' | 'autotask' | 'evidence' | 'diagnosis' | 'validation';
  steps?: { label: string; status: 'done' | 'running' | 'idle' }[];
}

interface ChatMessageProps {
  message: Message;
  children?: ReactNode;
}

const SOURCE_CONFIG: Record<string, { icon: string; label: string }> = {
  autotask: { icon: '🎟', label: 'Autotask' },
  evidence: { icon: '⚡', label: 'PrepareContext' },
  diagnosis: { icon: '🧠', label: 'LLM Diagnose' },
  validation: { icon: '🛡', label: 'ValidateAndPolicy' },
  text: { icon: '📋', label: 'PlaybookWriter' },
};

function MsgTag({ children, color, bg }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', fontWeight: 500, background: bg ?? 'rgba(255,255,255,0.05)', color: color ?? 'var(--accent)', border: '1px solid var(--border)', margin: '0 2px', verticalAlign: 'middle' }}>
      {children}
    </span>
  );
}

export default function ChatMessage({ message, children }: ChatMessageProps) {
  const isSystem = message.role === 'system' || message.type === 'status';

  if (isSystem) {
    return (
      <div className="animate-msgIn" style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} className="animate-throbber" />
          {message.content}
        </span>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="animate-msgIn" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: 'row-reverse', marginBottom: '10px' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', border: '1px solid rgba(91,127,255,0.2)', background: 'rgba(91,127,255,0.10)' }}>👤</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px', flexDirection: 'row-reverse' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>You</span>
            {message.timestamp && <span suppressHydrationWarning style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)' }}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <p style={{ background: 'rgba(91,127,255,0.10)', border: '1px solid rgba(91,127,255,0.15)', borderRadius: '10px 10px 2px 10px', padding: '8px 12px', display: 'inline-block', maxWidth: '80%', fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  const src = SOURCE_CONFIG[message.type ?? 'text'] ?? { icon: '📋', label: 'PlaybookWriter' };
  return (
    <div className="animate-msgIn" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
      <div style={{ width: '26px', height: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        {src.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>{src.label}</span>
          {message.timestamp && <span suppressHydrationWarning style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)' }}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
        </div>
        <MarkdownRenderer content={message.content + (message.type === 'validation' ? ' **Status:** `approved`' : '')} />
        {message.steps && message.steps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
            {message.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', flexShrink: 0, background: step.status === 'done' ? 'var(--green-muted)' : step.status === 'running' ? 'var(--accent-muted)' : 'var(--bg-badge)', border: `1px solid ${step.status === 'done' ? 'var(--green-border)' : step.status === 'running' ? 'rgba(91,127,255,0.25)' : 'var(--border)'}`, color: step.status === 'done' ? 'var(--green)' : 'transparent' }} className={step.status === 'running' ? 'animate-throbber' : undefined}>
                  {step.status === 'done' ? '✓' : ''}
                </span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        )}
        {children && <div style={{ marginTop: '8px' }}>{children}</div>}
      </div>
    </div>
  );
}
