// 學程列表頁
//
// 與 ClassesPage 並列：班級是固定週期循環、學程是有總時數目標的長期課程。
// 顯示計畫總時數 / 實際完成時數 / 進度% / 學員數 / 單元數。
//
// 權限：HQ 看全部、Branch Admin 看本分校、Teacher 只看自己是 defaultInstructor 的。

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CourseFormDialog } from '../components/CourseFormDialog';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import {
  fetchAllActiveEnrollmentCounts,
  fetchAllActiveModuleCounts,
  fetchAllCourseActualHours,
  setCourseActive,
  subscribeCourses,
} from '../services/courses';
import { ROUTES } from '../routes/paths';
import {
  COURSE_STATUS_LABELS,
  type CourseDoc,
  type CourseStatus,
} from '../types/course';

const ALL = '__all__';

export function CoursesPage() {
  const { user } = useAuth();
  const { branches } = useBranches();
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Map<string, number>>(new Map());
  const [moduleCounts, setModuleCounts] = useState<Map<string, number>>(new Map());
  const [actualHoursMap, setActualHoursMap] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<CourseDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [filterBranch, setFilterBranch] = useState<string>(ALL);
  const [filterStatus, setFilterStatus] = useState<CourseStatus | typeof ALL>(ALL);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'disabled'>('active');
  const [keyword, setKeyword] = useState('');

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(c: CourseDoc) { setEditing(c); setDialogOpen(true); }

  async function toggleActive(c: CourseDoc) {
    const next = !c.active;
    if (!window.confirm(`確定要${next ? '啟用' : '停用'}學程「${c.name}」？`)) return;
    setBusyId(c.courseId);
    try {
      await setCourseActive(c.courseId, next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  // 初始載入：學員數 / 單元數 / 已完成時數
  useEffect(() => {
    fetchAllActiveEnrollmentCounts().then(setEnrollmentCounts).catch(() => {});
    fetchAllActiveModuleCounts().then(setModuleCounts).catch(() => {});
    fetchAllCourseActualHours().then(setActualHoursMap).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const branchIds = user.role === 'hq_admin' ? undefined : user.branchIds;
    if (user.role !== 'hq_admin' && (!branchIds || branchIds.length === 0)) {
      setCourses([]); setLoading(false); return;
    }
    setLoading(true);
    const unsub = subscribeCourses(
      user.role === 'teacher'
        ? { branchIds, defaultInstructorId: user.userId }
        : { branchIds },
      (list) => { setCourses(list); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
    return unsub;
  }, [user]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return courses.filter((c) => {
      if (filterBranch !== ALL && c.branchId !== filterBranch) return false;
      if (filterStatus !== ALL && c.status !== filterStatus) return false;
      if (filterActive === 'active' && !c.active) return false;
      if (filterActive === 'disabled' && c.active) return false;
      if (kw) {
        const hay = `${c.name} ${c.courseId} ${c.description}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [courses, filterBranch, filterStatus, filterActive, keyword]);

  const branchName = (id: string) => branches.find((b) => b.branchId === id)?.name ?? id;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>學程管理</h1>
          <p style={styles.subtitle}>共 {visible.length} 個學程</p>
        </div>
        {user?.role !== 'teacher' && (
          <button type="button" style={styles.primaryBtn} onClick={openCreate}>
            ＋ 新增學程
          </button>
        )}
      </header>

      <div style={styles.filterBar}>
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={styles.input}>
          <option value={ALL}>全部分校</option>
          {branches.map((b) => (
            <option key={b.branchId} value={b.branchId}>{b.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CourseStatus | typeof ALL)}
          style={styles.input}
        >
          <option value={ALL}>全部狀態</option>
          <option value="active">進行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'disabled')}
          style={styles.input}
        >
          <option value="active">啟用中</option>
          <option value="disabled">已停用</option>
          <option value="all">全部啟用狀態</option>
        </select>
        <input
          type="search"
          placeholder="搜尋名稱 / 代碼 / 說明"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ ...styles.input, width: 220 }}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>課程代碼</th>
              <th style={styles.th}>名稱</th>
              <th style={styles.th}>分校</th>
              <th style={styles.th}>期間</th>
              <th style={styles.thNum}>計畫時數</th>
              <th style={styles.thNum}>實際時數</th>
              <th style={styles.th}>進度</th>
              <th style={styles.thNum}>單元</th>
              <th style={styles.thNum}>學員</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} style={styles.empty}>載入中…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={11} style={styles.empty}>沒有符合條件的學程</td></tr>
            )}
            {visible.map((c) => {
              const planned = c.totalPlannedHours || 0;
              const actual = actualHoursMap.get(c.courseId) ?? c.totalActualHours ?? 0;
              const pct = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
              return (
                <tr key={c.courseId}>
                  <td style={styles.td}><code>{c.courseId}</code></td>
                  <td style={styles.td}>
                    <Link to={ROUTES.courseDetail(c.courseId)}>{c.name}</Link>
                  </td>
                  <td style={styles.td}>{branchName(c.branchId)}</td>
                  <td style={{ ...styles.td, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {c.startDate || c.endDate
                      ? `${c.startDate || '—'} ~ ${c.endDate || '—'}`
                      : '—'}
                  </td>
                  <td style={styles.tdNum}>{planned}</td>
                  <td style={styles.tdNum}>{actual}</td>
                  <td style={styles.td}>
                    <ProgressBar pct={pct} />
                  </td>
                  <td style={styles.tdNum}>{moduleCounts.get(c.courseId) ?? 0}</td>
                  <td style={styles.tdNum}>{enrollmentCounts.get(c.courseId) ?? 0}</td>
                  <td style={styles.td}>
                    <StatusPill course={c} />
                  </td>
                  <td style={styles.td}>
                    {user?.role !== 'teacher' && (
                      <>
                        <button type="button" style={styles.linkBtn} onClick={() => openEdit(c)}>編輯</button>
                        <button
                          type="button"
                          style={{ ...styles.linkBtn, color: c.active ? '#b91c1c' : '#166534' }}
                          onClick={() => toggleActive(c)}
                          disabled={busyId === c.courseId}
                        >
                          {busyId === c.courseId ? '處理中…' : c.active ? '停用' : '啟用'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CourseFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          fetchAllActiveEnrollmentCounts().then(setEnrollmentCounts).catch(() => {});
          fetchAllActiveModuleCounts().then(setModuleCounts).catch(() => {});
          fetchAllCourseActualHours().then(setActualHoursMap).catch(() => {});
        }}
      />
    </section>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 140 }}>
      <div style={{
        flex: 1, height: 8, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: pct >= 100 ? '#16a34a' : '#2563eb',
        }} />
      </div>
      <span style={{ fontSize: '0.8rem', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
        {pct}%
      </span>
    </div>
  );
}

function StatusPill({ course }: { course: CourseDoc }) {
  const status = course.status;
  const label = COURSE_STATUS_LABELS[status];
  const colors: Record<typeof status, { bg: string; fg: string }> = {
    active:    { bg: '#dbeafe', fg: '#1e40af' },
    completed: { bg: '#dcfce7', fg: '#166534' },
    cancelled: { bg: '#f3f4f6', fg: '#6b7280' },
  };
  const c = colors[status] ?? { bg: '#f3f4f6', fg: '#6b7280' };
  return (
    <span style={{
      display: 'inline-flex', gap: '0.25rem', alignItems: 'center',
    }}>
      <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: c.bg, color: c.fg }}>
        {label}
      </span>
      {!course.active && (
        <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.75rem', background: '#fee2e2', color: '#b91c1c' }}>
          停用
        </span>
      )}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' },
  input: {
    padding: '0.5rem 0.7rem', fontSize: '0.95rem',
    border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', outline: 'none',
  },
  error: {
    padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, marginBottom: '1rem',
  },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: {
    textAlign: 'left', padding: '0.7rem 0.85rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600, whiteSpace: 'nowrap',
  },
  thNum: {
    textAlign: 'right', padding: '0.7rem 0.85rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600, whiteSpace: 'nowrap',
  },
  td: { padding: '0.65rem 0.85rem', borderBottom: '1px solid #f3f4f6' },
  tdNum: { padding: '0.65rem 0.85rem', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  primaryBtn: {
    padding: '0.55rem 1rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600,
  },
  linkBtn: {
    padding: '0.2rem 0.5rem', background: 'transparent', color: '#2563eb',
    border: 'none', fontSize: '0.9rem', marginRight: '0.25rem',
  },
};
