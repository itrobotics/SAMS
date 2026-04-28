// 選項管理頁（Task 045）
// 管理下拉選單的選項清單，例如「可教授課程」與「緊急聯絡人關係」。
// 僅 hq_admin 可進入（由 AppLayout 控制顯示 navItem，路由層未額外限制）。

import { useEffect, useState } from 'react';

import { saveOptions, subscribeOptions } from '../services/appOptions';
import { OPTION_KEYS, OPTION_LABELS, type OptionKey } from '../types/appOptions';

const ALL_KEYS = Object.values(OPTION_KEYS) as OptionKey[];

export function OptionsPage() {
  return (
    <section>
      <header style={styles.header}>
        <h1 style={styles.title}>選項管理</h1>
        <p style={styles.subtitle}>管理表單中的下拉選單內容</p>
      </header>
      <div style={styles.panels}>
        {ALL_KEYS.map((key) => (
          <OptionPanel key={key} optionKey={key} />
        ))}
      </div>
    </section>
  );
}

function OptionPanel({ optionKey }: { optionKey: OptionKey }) {
  const [values, setValues] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeOptions(
      optionKey,
      (vals) => {
        setValues(vals);
        setDraft(vals);
        setDirty(false);
      },
      (e) => setError(e.message),
    );
    return unsub;
  }, [optionKey]);

  function addItem() {
    const trimmed = newItem.trim();
    if (!trimmed || draft.includes(trimmed)) return;
    const next = [...draft, trimmed];
    setDraft(next);
    setNewItem('');
    setDirty(JSON.stringify(next) !== JSON.stringify(values));
  }

  function removeItem(idx: number) {
    const next = draft.filter((_, i) => i !== idx);
    setDraft(next);
    setDirty(JSON.stringify(next) !== JSON.stringify(values));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveOptions(optionKey, draft);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft(values);
    setDirty(false);
    setNewItem('');
  }

  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>{OPTION_LABELS[optionKey]}</h2>

      <div style={styles.chips}>
        {draft.map((val, idx) => (
          <span key={val} style={styles.chip}>
            {val}
            <button
              type="button"
              style={styles.chipRemove}
              onClick={() => removeItem(idx)}
              title="刪除"
            >
              ×
            </button>
          </span>
        ))}
        {draft.length === 0 && (
          <span style={styles.emptyHint}>尚無選項</span>
        )}
      </div>

      <div style={styles.addRow}>
        <input
          type="text"
          placeholder="新增選項…"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          style={styles.input}
        />
        <button type="button" style={styles.addBtn} onClick={addItem}>
          新增
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.actions}>
        <button
          type="button"
          style={{ ...styles.primaryBtn, opacity: dirty ? 1 : 0.5 }}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? '儲存中…' : '儲存'}
        </button>
        {dirty && (
          <button type="button" style={styles.ghostBtn} onClick={handleReset}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '1.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  panels: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  panel: {
    background: '#fff', borderRadius: 8,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    padding: '1.25rem 1.5rem',
    maxWidth: 560,
  },
  panelTitle: { margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 600 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem', minHeight: 32 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.2rem 0.55rem', background: '#e0e7ff', color: '#3730a3',
    borderRadius: 99, fontSize: '0.88rem', fontWeight: 500,
  },
  chipRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#6366f1', fontWeight: 700, fontSize: '1rem', lineHeight: 1, padding: 0,
  },
  emptyHint: { color: '#9ca3af', fontSize: '0.9rem', alignSelf: 'center' },
  addRow: { display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' },
  input: {
    flex: 1, padding: '0.45rem 0.7rem', fontSize: '0.95rem',
    border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
  },
  addBtn: {
    padding: '0.45rem 0.9rem', background: '#f3f4f6', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', fontWeight: 500,
  },
  error: {
    padding: '0.5rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.9rem',
  },
  actions: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  primaryBtn: {
    padding: '0.5rem 1.1rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600,
  },
  ghostBtn: {
    padding: '0.5rem 0.9rem', background: 'transparent', color: '#6b7280',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem',
  },
};
