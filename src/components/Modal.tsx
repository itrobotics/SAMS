// 簡易 Modal（Task 010）
//
// 沒有引入額外 UI library，使用 fixed overlay。背景點擊與 Esc 關閉。

import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, width = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose} role="presentation">
      <div
        style={{ ...styles.panel, width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <header style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button type="button" style={styles.close} onClick={onClose} aria-label="關閉">
            ×
          </button>
        </header>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  panel: {
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #e5e7eb',
  },
  title: { margin: 0, fontSize: '1.1rem' },
  close: {
    background: 'transparent',
    border: 'none',
    fontSize: '1.5rem',
    color: '#6b7280',
    lineHeight: 1,
    padding: '0 0.25rem',
  },
  body: { padding: '1.25rem', overflow: 'auto' },
};
