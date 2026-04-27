// 分校列表頁（Task 009）+ CRUD 操作（Task 010）
//
// HQ 看全部、可新增 / 編輯 / 停用；其他角色只看自己的 branchIds 內的分校。

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { BranchFormDialog } from '../components/BranchFormDialog';
import { useAuth } from '../hooks/useAuth';
import { setBranchStatus, subscribeBranches } from '../services/branches';
import { ROUTES } from '../routes/paths';
import type { BranchDoc } from '../types/branch';

export function BranchesPage() {
  const { user } = useAuth();
  const isHQ = user?.role === 'hq_admin';
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BranchDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(b: BranchDoc) {
    setEditing(b);
    setDialogOpen(true);
  }

  async function toggleStatus(b: BranchDoc) {
    const next = b.status === 'active' ? 'disabled' : 'active';
    const verb = next === 'disabled' ? '停用' : '啟用';
    if (!window.confirm(`確定要${verb}分校「${b.name}」？`)) return;
    setBusyId(b.branchId);
    try {
      await setBranchStatus(b.branchId, next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>分校管理</h1>
          <p style={styles.subtitle}>{isHQ ? '顯示全部分校' : '僅顯示您所屬的分校'}</p>
        </div>
        {isHQ && (
          <button type="button" style={styles.primaryBtn} onClick={openCreate}>
            ＋ 新增分校
          </button>
        )}
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
              {isHQ && <th style={styles.th}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td style={styles.empty} colSpan={isHQ ? 6 : 5}>載入中…</td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td style={styles.empty} colSpan={isHQ ? 6 : 5}>目前沒有可顯示的分校</td>
              </tr>
            )}
            {visible.map((b) => (
              <tr key={b.branchId}>
                <td style={styles.td}><code>{b.branchId}</code></td>
                <td style={styles.td}>{b.name}</td>
                <td style={styles.td}>{b.address || '—'}</td>
                <td style={styles.td}><StatusPill status={b.status} /></td>
                <td style={styles.td}>
                  <Link to={ROUTES.branchDashboard(b.branchId)}>進入 →</Link>
                </td>
                {isHQ && (
                  <td style={styles.td}>
                    <button type="button" style={styles.linkBtn} onClick={() => openEdit(b)}>
                      編輯
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.linkBtn, color: b.status === 'active' ? '#b91c1c' : '#166534' }}
                      onClick={() => toggleStatus(b)}
                      disabled={busyId === b.branchId}
                    >
                      {busyId === b.branchId ? '處理中…' : b.status === 'active' ? '停用' : '啟用'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BranchFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {/* realtime listener 會自動更新清單 */}}
      />
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
  primaryBtn: {
    padding: '0.55rem 1rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.95rem',
    fontWeight: 600,
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
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontWeight: 600,
  },
  td: { padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  linkBtn: {
    padding: '0.2rem 0.5rem',
    background: 'transparent',
    color: '#2563eb',
    border: 'none',
    fontSize: '0.9rem',
    marginRight: '0.25rem',
  },
};
