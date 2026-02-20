'use client';

/**
 * ThemeToggle
 * Classic OSS-style theme toggle: Icons sit in the background track.
 * 
 * In Light Mode (knob left) -> shows Moon on the right (prompting "switch to dark").
 * In Dark Mode (knob right) -> shows Sun on the left (prompting "switch to light").
 */

interface ThemeToggleProps {
    theme: 'dark' | 'light';
    onToggle: () => void;
    size?: 'sm' | 'md';
}

function MoonIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
            <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
        </svg>
    );
}

function SunIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
            <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
        </svg>
    );
}

export default function ThemeToggle({ theme, onToggle, size = 'sm' }: ThemeToggleProps) {
    const isDark = theme === 'dark';

    if (size === 'sm') {
        const PILL_W = 32;
        const PILL_H = 18;
        const KNOB = 14;
        const PAD = 2;
        // When knob is left (light), it is at PAD (2).
        // When right (dark), it is at PILL_W - KNOB - PAD (32 - 14 - 2 = 16).
        const TRACK_COLOR = isDark ? '#4d4d4d' : '#e5e7eb';

        return (
            <button
                onClick={onToggle}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle theme"
                style={{
                    position: 'relative',
                    width: PILL_W,
                    height: PILL_H,
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    background: TRACK_COLOR,
                    transition: 'background 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                }}
            >
                {/* Background Icons */}
                <div style={{ position: 'absolute', left: 4, color: '#f5a623', display: 'flex', opacity: isDark ? 1 : 0, transition: 'opacity 0.3s' }}>
                    <SunIcon size={10} />
                </div>
                <div style={{ position: 'absolute', right: 4, color: '#9ca3af', display: 'flex', opacity: isDark ? 0 : 1, transition: 'opacity 0.3s' }}>
                    <MoonIcon size={10} />
                </div>

                {/* Sliding Knob */}
                <span
                    style={{
                        position: 'absolute',
                        top: PAD,
                        left: isDark ? PILL_W - KNOB - PAD : PAD,
                        width: KNOB,
                        height: KNOB,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
                    }}
                />
            </button>
        );
    }

    /* ── md: 52×28 pill (settings panel) ── */
    const PILL_W = 56;
    const PILL_H = 28;
    const KNOB = 24;
    const PAD = 2;
    const TRACK_COLOR = isDark ? '#4d4d4d' : '#e5e7eb';

    return (
        <button
            onClick={onToggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            style={{
                position: 'relative',
                width: PILL_W,
                height: PILL_H,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                background: TRACK_COLOR,
                transition: 'background 0.3s, border-color 0.4s',
                display: 'flex',
                alignItems: 'center',
                boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)',
            }}
        >
            {/* Background Icons */}
            <div style={{ position: 'absolute', left: 6, color: '#f5a623', display: 'flex', opacity: isDark ? 1 : 0, transition: 'opacity 0.3s' }}>
                <SunIcon size={14} />
            </div>
            <div style={{ position: 'absolute', right: 6, color: '#9ba1a6', display: 'flex', opacity: isDark ? 0 : 1, transition: 'opacity 0.3s' }}>
                <MoonIcon size={14} />
            </div>

            {/* Sliding Knob */}
            <span
                style={{
                    position: 'absolute',
                    top: PAD,
                    left: isDark ? PILL_W - KNOB - PAD : PAD,
                    width: KNOB,
                    height: KNOB,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)',
                }}
            />
        </button>
    );
}
