// 班級列表頁（Task 017）
// 篩選：分校 / 上課日（weekday）/ 啟用狀態 / 老師代碼。
// 點擊班級名稱進入「班級學生管理頁」（Task 019）。

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ClassFormDialog } from '../components/ClassFormDialog';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { setClassActive, subscribeClasses } from '../services/classes';
import { WEEKDAY_LABELS, formatMeetingsLabel, type ClassDoc } from '../types/class';

const ALL = '__all__';

export function ClassesPage() {
  const { user } = useAuth();
  const { branches } = useBranches();
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterBranch, setFilterBranch] = useState<string>(ALL);
  const [filterWeekday, setFilterWeekday] = useState<number | typeof ALL>(ALL);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'disabled'>('active');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [editing, setEditing] = useState<ClassDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(c: ClassDoc) { setEditing(c); setDialogOpen(true); }
  async function toggleActive(c: ClassDoc) {
    const next = !c.active;
    if (!window.confirm(`確定要${next ? '啟用' : '停用'}班級「${c.name}」？`)) return;
    setBusyId(c.classId);
    try {
      await setClassActive(c.classId, next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    const branchIds = user.role === 'hq_admin' ? undefined : user.branchIds;
    if (user.role !== 'hq_admin' && (!branchIds || branchIds.length === 0)) {
      setClasses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeClasses(
      { branchIds },
      (list) => {
        setClasses(list);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  const visible = useMemo(() => {
    const teacherKw = filterTeacher.trim().toLowerCase();
    return classes.filter((c) => {
      if (filterBranch !== ALL && c.branchId !== filterBranch) return false;
      if (filterWeekday !== ALL && !(c.weekdays ?? []).includes(filterWeekday)) return false;
      if (filterActive === 'active' && !c.active) return false;
      if (filterActive === 'disabled' && c.active) return false;
      if (teacherKw) {
        // 比對預設老師 + 任一 meeting 的老師覆蓋
        const haystack = [
          c.teacherId,
          ...(c.meetings ?? []).map((m) => m.teacherId ?? ''),
        ].join(' ').toLowerCase();
        if (!haystack.includes(teacherKw)) return false;
      }
      return true;
    });
  }, [classes, filterBranch, filterWeekday, filterActive, filterTeacher]);

  const branchName = (id: string) => branches.find((b) => b.branchId === id)?.name ?? id;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>班級管理</h1>
          <p style={styles.subtitle}>共 {visible.length} 個班級</p>
        </div>
        <button type="button" style={styles.primaryBtn} onClick={openCreate}>
          ＋ 新增班級
        </button>
      </header>

      <div style={styles.filterBar}>
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={styles.input}>
          <option value={ALL}>全部分校</option>
          {branches.map((b) => (
            <option key={b.branchId} value={b.branchId}>{b.name}</option>
          ))}
        </select>
        <select
          value={filterWeekday}
          onChange={(e) => setFilterWeekday(e.target.value === ALL ? ALL : Number(e.target.value))}
          style={styles.input}
        >
          <option value={ALL}>全部上課日</option>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>
          ))}
        </select>
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
          placeholder="老師代碼"
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
          style={{ ...styles.input, width: 140 }}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>班級代碼</th>
              <th style={styles.th}>名稱</th>
              <th style={styles.th}>分校</th>
              <th style={styles.th}>預設老師</th>
              <th style={styles.th}>預設教室</th>
              <th style={styles.th}>上課時段</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={styles.empty}>載入中…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={8} style={styles.empty}>沒有符合條件的班級</td></tr>
            )}
            {visible.map((c) => (
              <tr key={c.classId}>
                <td style={styles.td}><code>{c.classId}</code></td>
                <td style={styles.td}>
                  <Link to={`/classes/${c.classId}`}>{c.name}</Link>
                </td>
                <td style={styles.td}>{branchName(c.branchId)}</td>
                <td style={styles.td}>{c.teacherId || '—'}</td>
                <td style={styles.td}>{c.classroom || '—'}</td>
                <td style={styles.td}>{formatMeetingsLabel(c.meetings ?? [])}</td>
                <td style={styles.td}>
                  <span style={c.active ? styles.pillActive : styles.pillInactive}>
                    {c.active ? '啟用' : '停用'}
                  </span>
                </td>
                <td style={styles.td}>
                  <button type="button" style={styles.linkBtn} onClick={() => openEdit(c)}>編輯</button>
                  <button
                    type="button"
                    style={{ ...styles.linkBtn, color: c.active ? '#b91c1c' : '#166534' }}
                    onClick={() => toggleActive(c)}
                    disabled={busyId === c.classId}
                  >
                    {busyId === c.classId ? '處理中…' : c.active ? '停用' : '啟用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ClassFormDialog
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
