// 分校列表頁（Task 009）
//
// HQ 看全部；branch_admin / teacher / staff 只看自己的 branchIds 內的分校。
// 透過 onSnapshot 即時更新；CRUD UI 於 Task 010 加上。

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { subscribeBranches } from '../services/branches';
import { ROUTES } from '../routes/paths';
import type { BranchDoc } from '../types/branch';

export function BranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeBranches(
      (list) => {
        setBranches(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const visible = useMemo(() => {
    if (!user) return [];
    if (user.role === 'hq_admin') return branches;
    return branches.filter((b) => user.branchIds.includes(b.branchId));
  }, [branches, user]);

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>分校管理</h1>
          <p style={styles.subtitle}>
            {user?.role === 'hq_admin' ? '顯示全部分校' : '僅顯示您所屬的分校'}
          </p>
        </div>
        {/* Task 010 將在此加入「新增分校」按鈕 */}
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>分校代碼</th>
              <th style={styles.th}>名稱</th>
              <th style={styles.th}>地址</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>今日看板</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td style={styles.empty} colSpan={5}>
                  載入中…
                </td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td style={styles.empty} colSpan={5}>
                  目前沒有可顯示的分校
                </td>
              </tr>
            )}
            {visible.map((b) => (
              <tr key={b.branchId}>
                <td style={styles.td}><code>{b.branchId}</code></td>
                <td style={styles.td}>{b.name}</td>
                <td style={styles.td}>{b.address || '—'}</td>
                <td style={styles.td}>
                  <StatusPill status={b.status} />
                </td>
                <td style={styles.td}>
                  <Link to={ROUTES.branchDashboard(b.branchId)}>進入 →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: 'active' | 'disabled' }) {
  const isActive = status === 'active';
  return (
    <span
      style={{
        padding: '0.15rem 0.55rem',
        borderRadius: 12,
        fontSize: '0.8rem',
        background: isActive ? '#dcfce7' : '#f3f4f6',
        color: isActive ? '#166534' : '#6b7280',
      }}
    >
      {isActive ? '啟用' : '停用'}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
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
  th: { textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 600 },
  td: { padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
};
