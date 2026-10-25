import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export type ThemeChoice = 'light' | 'dark' | 'system';

export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    return (localStorage.getItem('hcm_theme') as ThemeChoice) || 'system';
  });

  useEffect(() => {
    localStorage.setItem('hcm_theme', choice);
    const isDark =
      choice === 'dark' ||
      (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [choice]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-control)',
        padding: 2,
        border: '1px solid var(--color-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setChoice('light')}
        title="Light theme"
        aria-label="Light theme"
        style={{
          background: choice === 'light' ? 'var(--color-surface)' : 'transparent',
          color: choice === 'light' ? 'var(--color-text)' : 'var(--color-text-muted)',
          border: 'none',
          borderRadius: 4,
          padding: '4px 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Sun size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => setChoice('dark')}
        title="Dark theme"
        aria-label="Dark theme"
        style={{
          background: choice === 'dark' ? 'var(--color-surface)' : 'transparent',
          color: choice === 'dark' ? 'var(--color-text)' : 'var(--color-text-muted)',
          border: 'none',
          borderRadius: 4,
          padding: '4px 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Moon size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => setChoice('system')}
        title="System theme"
        aria-label="System theme"
        style={{
          background: choice === 'system' ? 'var(--color-surface)' : 'transparent',
          color: choice === 'system' ? 'var(--color-text)' : 'var(--color-text-muted)',
          border: 'none',
          borderRadius: 4,
          padding: '4px 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Monitor size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
