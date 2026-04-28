// 講師管理列表頁（Task 046）

import { useEffect, useMemo, useState } from 'react';

import { InstructorFormDialog } from '../components/InstructorFormDialog';
import { setInstructorActive, subscribeInstructors } from '../services/instructors';
import type { InstructorDoc } from '../types/instructor';

export function InstructorsPage() {
  const [instructors, setInstructors] = useState<InstructorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'disabled'>('active');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [editing, setEditing] = useState<InstructorDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(inst: InstructorDoc) { setEditing(inst); setDialogOpen(true); }

  async function toggleActive(inst: InstructorDoc) {
    const next = !inst.active;
    if (!window.confirm(`確定要${next ? '啟用' : '停用'}講師「${inst.name}」？`)) return;
    setBusyId(inst.instructorId);
    try {
      await setInstructorActive(inst.instructorId, next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeInstructors(
      {},
      (list) => { setInstructors(list); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
    return unsub;
  }, []);

  const visible = useMemo(() => {
    const kw = filterKeyword.trim().toLowerCase();
    return instructors.filter((inst) => {
      if (filterActive === 'active' && !inst.active) return false;
      if (filterActive === 'disabled' && inst.active) return false;
      if (kw && !`${inst.name} ${inst.instructorId}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [instructors, filterActive, filterKeyword]);

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>講師管理</h1>
          <p style={styles.subtitle}>共 {visible.length} 位講師</p>
        </div>
        <button type="button" style={styles.primaryBtn} onClick={openCreate}>
          ＋ 新增講師
        </button>
      </header>

      <div style={styles.filterBar}>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'disabled')}
          style={styles.input}
        >
          <option value="active">啟用中</option>
          <option value="disabled">已停用</option>
          <option value="all">全部狀態</option>
        </select>
        <input
          type="search"
          placeholder="姓名 / 編號搜尋"
          value={filterKeyword}
          onChange={(e) => setFilterKeyword(e.target.value)}
          style={{ ...styles.input, width: 180 }}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>講師編號</th>
              <th style={styles.th}>姓名</th>
              <th style={styles.th}>可教授課程</th>
              <th style={styles.th}>聯絡電話</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={styles.empty}>載入中…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={6} style={styles.empty}>沒有符合條件的講師</td></tr>
            )}
            {visible.map((inst) => (
              <tr key={inst.instructorId}>
                <td style={styles.td}><code>{inst.instructorId}</code></td>
                <td style={styles.td}>{inst.name}</td>
                <td style={styles.td}>
                  {inst.courses.length > 0
                    ? inst.courses.join('、')
                    : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={styles.td}>{inst.phone1 || '—'}</td>
                <td style={styles.td}>
                  <span style={inst.active ? styles.pillActive : styles.pillInactive}>
                    {inst.active ? '啟用' : '停用'}
                  </span>
                </td>
                <td style={styles.td}>
                  <button type="button" style={styles.linkBtn} onClick={() => openEdit(inst)}>
                    編輯
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.linkBtn, color: inst.active ? '#b91c1c' : '#166534' }}
                    onClick={() => toggleActive(inst)}
                    disabled={busyId === inst.instructorId}
                  >
                    {busyId === inst.instructorId ? '處理中…' : inst.active ? '停用' : '啟用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InstructorFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {/* realtime listener 自動更新 */}}
      />
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' },
  input: {
    padding: '0.5rem 0.7rem', fontSize: '0.95rem',
    border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', outline: 'none',
  },
  error: {
    padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, marginBottom: '1rem',
  },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' },
  th: {
    textAlign: 'left', padding: '0.7rem 1rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600,
  },
  td: { padding: '0.7rem 1rem', borderBottom: '1px solid #f3f4f6' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  pillActive: { padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: '#dcfce7', color: '#166534' },
  pillInactive: { padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: '#f3f4f6', color: '#6b7280' },
  primaryBtn: {
    padding: '0.55rem 1rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600,
  },
  linkBtn: {
    padding: '0.2rem 0.5rem', background: 'transparent', color: '#2563eb',
    border: 'none', fontSize: '0.9rem', marginRight: '0.25rem',
  },
};
