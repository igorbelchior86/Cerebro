'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface ResizableLayoutProps {
  sidebarContent: React.ReactNode;
  mainContent: React.ReactNode;
  rightContent?: React.ReactNode;
  transparentSidebar?: boolean;
}

export default function ResizableLayout({
  sidebarContent,
  mainContent,
  rightContent,
  transparentSidebar = false
}: ResizableLayoutProps) {
  const { user, updateProfile } = useAuth();

  // Configured defaults: 20 / 40 / 40 roughly maps to 272px / rest / rest
  const [sidebarWidth, setSidebarWidth] = useState(272);
  const [rightWidth, setRightWidth] = useState(400);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const isResizingSidebar = useRef(false);
  const isResizingRight = useRef(false);

  // Read from preferences once on load
  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.sidebarWidth) setSidebarWidth(user.preferences.sidebarWidth);
      if (user.preferences.rightWidth) setRightWidth(user.preferences.rightWidth);
    }
  }, [user?.preferences?.sidebarWidth, user?.preferences?.rightWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar.current) {
        const newWidth = Math.max(200, Math.min(e.clientX, 600));
        setSidebarWidth(newWidth);
      }
      if (isResizingRight.current) {
        const newWidth = Math.max(300, Math.min(document.body.clientWidth - e.clientX, 800));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      let savedAny = false;
      const newPrefs: any = {};

      if (isResizingSidebar.current) {
        isResizingSidebar.current = false;
        newPrefs.sidebarWidth = sidebarWidth;
        savedAny = true;
      }
      if (isResizingRight.current) {
        isResizingRight.current = false;
        newPrefs.rightWidth = rightWidth;
        savedAny = true;
      }

      if (savedAny && user) {
        // Persist to database without stalling UI
        updateProfile({ preferences: { ...user.preferences, ...newPrefs } });
      }

      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth, rightWidth, user, updateProfile]);

  const resizerStyle = {
    width: '10px',
    cursor: 'col-resize',
    background: 'transparent',
    transition: 'background 0.2s',
    zIndex: 10,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const panelShellStyle = {
    borderRadius: '18px',
    border: '1px solid var(--bento-outline)',
    background: 'var(--bg-bento-panel)',
    boxShadow: 'var(--shadow-panel)',
    overflow: 'hidden',
  } as const;

  return (
    <div
      className="flex h-screen p-2.5 md:p-3"
      style={{
        background: 'var(--bg-root)',
        overflow: 'hidden',
        gap: '8px',
      }}
    >
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{
          width: `${sidebarWidth}px`,
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          ...(transparentSidebar ? {} : panelShellStyle),
        }}
      >
        {sidebarContent}
      </div>

      {/* Resize Handle 1 */}
      <div
        style={resizerStyle}
        onMouseDown={() => {
          isResizingSidebar.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(110,134,201,0.06)'; }}
        onMouseLeave={(e) => { if (!isResizingSidebar.current) e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ width: '1px', height: '42%', background: 'var(--bento-outline-strong)', borderRadius: '999px' }} />
      </div>

      {/* Main Content */}
      <div
        className="flex-1 flex flex-col"
        style={{
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          ...panelShellStyle,
        }}
      >
        {mainContent}
      </div>

      {/* Right Column (Optional) */}
      {rightContent && (
        <>
          <div
            style={resizerStyle}
            onMouseDown={() => {
              isResizingRight.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(110,134,201,0.06)'; }}
            onMouseLeave={(e) => { if (!isResizingRight.current) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ width: '1px', height: '42%', background: 'var(--bento-outline-strong)', borderRadius: '999px' }} />
          </div>
          <div
            ref={rightRef}
            style={{
              width: `${rightWidth}px`,
              flexShrink: 0,
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              ...panelShellStyle,
            }}
          >
            {rightContent}
          </div>
        </>
      )}
    </div>
  );
}
