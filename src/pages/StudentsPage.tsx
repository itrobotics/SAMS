// 學生列表頁（Task 012）
//
// 篩選：分校 / 年級 / 啟用狀態 / 姓名（含學號）關鍵字搜尋。
// 非 HQ 使用者：在 server-side 用 branchId in [...] 過濾，避免拉到不該看的資料。
// CRUD UI 於 Task 013 加入；點列名稱進入詳細頁（Task 014）。

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { StudentFormDialog } from '../components/StudentFormDialog';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { fetchStudentLearningHours } from '../services/learningHours';
import { setStudentActive, subscribeStudents } from '../services/students';
import { ROUTES } from '../routes/paths';
import type { StudentDoc } from '../types/student';

const ALL = '__all__';

export function StudentsPage() {
  const { user } = useAuth();
  const { branches } = useBranches();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterBranch, setFilterBranch] = useState<string>(ALL);
  const [filterGrade, setFilterGrade] = useState<string>(ALL);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'disabled'>('active');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<StudentDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(s: StudentDoc) {
    setEditing(s);
    setDialogOpen(true);
  }
  async function toggleActive(s: StudentDoc) {
    const next = !s.active;
    if (!window.confirm(`確定要${next ? '啟用' : '停用'}學生「${s.name}」？`)) return;
    setBusyId(s.studentId);
    try {
      await setStudentActive(s.studentId, next);
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
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeStudents(
      { branchIds },
      (list) => {
        setStudents(list);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => s.grade && set.add(s.grade));
    return Array.from(set).sort();
  }, [students]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return students.filter((s) => {
      if (filterBranch !== ALL && s.branchId !== filterBranch) return false;
      if (filterGrade !== ALL && s.grade !== filterGrade) return false;
      if (filterActive === 'active' && !s.active) return false;
      if (filterActive === 'disabled' && s.active) return false;
      if (kw) {
        const hay = `${s.name} ${s.studentId} ${s.parentName ?? ''} ${s.parentPhone ?? ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [students, filterBranch, filterGrade, filterActive, keyword]);

  const branchName = (id: string) => branches.find((b) => b.branchId === id)?.name ?? id;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>學生主檔</h1>
          <p style={styles.subtitle}>
            共 {visible.length} 位（{filterActive === 'active' ? '啟用中' : filterActive === 'disabled' ? '已停用' : '全部狀態'}）
          </p>
        </div>
        <button type="button" style={styles.primaryBtn} onClick={openCreate}>
          ＋ 新增學生
        </button>
      </header>

      <div style={styles.filterBar}>
        <input
          type="search"
          placeholder="搜尋姓名 / 學號 / 家長 / 電話"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ ...styles.input, flex: 1, minWidth: 200 }}
        />
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={styles.input}>
          <option value={ALL}>全部分校</option>
          {branches.map((b) => (
            <option key={b.branchId} value={b.branchId}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} style={styles.input}>
          <option value={ALL}>全部年級</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
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
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>學號</th>
              <th style={styles.th}>姓名</th>
              <th style={styles.th}>年級</th>
              <th style={styles.th}>分校</th>
              <th style={styles.th}>家長</th>
              <th style={styles.th}>電話</th>
              <th style={styles.th}>狀態</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>累計時數</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={styles.empty}>載入中…</td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={9} style={styles.empty}>沒有符合條件的學生</td>
              </tr>
            )}
            {visible.map((s) => (
              <tr key={s.studentId}>
                <td style={styles.td}><code>{s.studentId}</code></td>
                <td style={styles.td}>
                  <Link to={ROUTES.studentDetail(s.studentId)}>{s.name}</Link>
                </td>
                <td style={styles.td}>{s.grade || '—'}</td>
                <td style={styles.td}>{branchName(s.branchId)}</td>
                <td style={styles.td}>{s.parentName || '—'}</td>
                <td style={styles.td}>{s.parentPhone || '—'}</td>
                <td style={styles.td}>
                  <span style={s.active ? styles.pillActive : styles.pillInactive}>
                    {s.active ? '啟用' : '停用'}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <StudentHoursCell studentId={s.studentId} />
                </td>
                <td style={styles.td}>
                  <button type="button" style={styles.linkBtn} onClick={() => openEdit(s)}>
                    編輯
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.linkBtn, color: s.active ? '#b91c1c' : '#166534' }}
                    onClick={() => toggleActive(s)}
                    disabled={busyId === s.studentId}
                  >
                    {busyId === s.studentId ? '處理中…' : s.active ? '停用' : '啟用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StudentFormDialog
        open={dialogOpen}
        initial={editing}
        defaultBranchId={filterBranch !== ALL ? filterBranch : undefined}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {/* realtime listener 會更新清單 */}}
      />
    </section>
  );
}

function StudentHoursCell({ studentId }: { studentId: string }) {
  const [hours, setHours] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStudentLearningHours(studentId)
      .then((h) => { if (!cancelled) setHours(h); })
      .catch(() => { if (!cancelled) setHours(0); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (hours === null) return <span style={{ color: '#d1d5db', fontSize: '0.85rem' }}>…</span>;
  return (
    <span style={{ fontWeight: hours > 0 ? 600 : 400, color: hours > 0 ? '#1d4ed8' : '#9ca3af' }}>
      {hours.toFixed(1)} h
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' },
  input: {
    padding: '0.5rem 0.7rem',
    fontSize: '0.95rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: '#fff',
    outline: 'none',
  },
  error: {
    padding: '0.6rem 0.75rem',
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 6,
    marginBottom: '1rem',
  },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' },
  th: {
    textAlign: 'left',
    padding: '0.7rem 1rem',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontWeight: 600,
  },
  td: { padding: '0.7rem 1rem', borderBottom: '1px solid #f3f4f6' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  pillActive: {
    padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: '#dcfce7', color: '#166534',
  },
  pillInactive: {
    padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: '#f3f4f6', color: '#6b7280',
  },
  primaryBtn: {
    padding: '0.55rem 1rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  linkBtn: {
    padding: '0.2rem 0.5rem',
    background: 'transparent',
    color: '#2563eb',
    border: 'none',
    fontSize: '0.9rem',
    marginRight: '0.25rem',
  },
};
