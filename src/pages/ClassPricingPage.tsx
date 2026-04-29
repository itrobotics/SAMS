// 班級定價表頁
//
// 功能：
//   - 列出所有定價（依登入者角色過濾分校）
//   - 篩選：分校、班級名稱、生效期間（YYYY-MM 範圍）、啟用狀態
//   - CRUD：新增、編輯、停用 / 啟用
//   - 列表顯示「目前人數 × 定價 = 預估營收」
//
// 預估營收採當前 class_students 啟用人數計算（一次性 fetch，不訂閱）。
// 設計理由：人數變動頻率低，不需要 realtime；表格 row 數少時 Map 查找成本可忽略。

import { useEffect, useMemo, useState } from 'react';

import { ClassPricingFormDialog } from '../components/ClassPricingFormDialog';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { fetchAllActiveClassStudentCounts } from '../services/classStudents';
import {
  setClassPricingActive,
  subscribeClassPricing,
} from '../services/classPricing';
import {
  PRICE_TYPE_LABELS,
  formatEffectiveRange,
  pricingOverlapsRange,
  type ClassPricingDoc,
} from '../types/classPricing';

const ALL = '__all__';

function defaultMonth(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TWD = new Intl.NumberFormat('zh-TW');

export function ClassPricingPage() {
  const { user } = useAuth();
  const { branches } = useBranches();

  const [rows, setRows] = useState<ClassPricingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentCounts, setStudentCounts] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<ClassPricingDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ── filters ──
  const [filterBranch, setFilterBranch] = useState<string>(ALL);
  const [filterName, setFilterName] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'disabled'>('active');
  const [filterFrom, setFilterFrom] = useState<string>(''); // YYYY-MM
  const [filterTo, setFilterTo] = useState<string>('');     // YYYY-MM

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(p: ClassPricingDoc) { setEditing(p); setDialogOpen(true); }

  async function toggleActive(p: ClassPricingDoc) {
    const next = !p.active;
    if (!window.confirm(`確定要${next ? '啟用' : '停用'}「${p.className}」的此筆定價？`)) return;
    setBusyId(p.pricingId);
    try {
      await setClassPricingActive(p.pricingId, next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    fetchAllActiveClassStudentCounts().then(setStudentCounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const branchIds = user.role === 'hq_admin' ? undefined : user.branchIds;
    if (user.role !== 'hq_admin' && (!branchIds || branchIds.length === 0)) {
      setRows([]); setLoading(false); return;
    }
    setLoading(true);
    const unsub = subscribeClassPricing(
      { branchIds },
      (list) => { setRows(list); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
    return unsub;
  }, [user]);

  const visible = useMemo(() => {
    const kw = filterName.trim().toLowerCase();
    const from = filterFrom.trim();
    const to = filterTo.trim();
    const hasRange = from !== '' && to !== '';

    return rows.filter((p) => {
      if (filterBranch !== ALL && p.branchId !== filterBranch) return false;
      if (filterActive === 'active' && !p.active) return false;
      if (filterActive === 'disabled' && p.active) return false;
      if (kw && !p.className.toLowerCase().includes(kw)) return false;
      if (hasRange && !pricingOverlapsRange(p, from, to)) return false;
      // 單側填寫也支援：from 為下界，to 為上界
      if (from && !to) {
        if (p.effectiveTo !== null && p.effectiveTo < from) return false;
      }
      if (!from && to) {
        if (p.effectiveFrom > to) return false;
      }
      return true;
    });
  }, [rows, filterBranch, filterName, filterActive, filterFrom, filterTo]);

  const totalRevenue = useMemo(() => {
    return visible.reduce((sum, p) => {
      if (!p.active) return sum;
      const count = studentCounts.get(p.classId) ?? 0;
      return sum + p.price * count;
    }, 0);
  }, [visible, studentCounts]);

  const branchName = (id: string) => branches.find((b) => b.branchId === id)?.name ?? id;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>班級定價表</h1>
          <p style={styles.subtitle}>
            共 {visible.length} 筆定價・啟用中預估營收合計 NT$ {TWD.format(totalRevenue)}
          </p>
        </div>
        <button type="button" style={styles.primaryBtn} onClick={openCreate}>
          ＋ 新增定價
        </button>
      </header>

      <div style={styles.filterBar}>
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={styles.input}>
          <option value={ALL}>全部分校</option>
          {branches.map((b) => (
            <option key={b.branchId} value={b.branchId}>{b.name}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="班級名稱"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          style={{ ...styles.input, width: 180 }}
        />
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'disabled')}
          style={styles.input}
        >
          <option value="active">啟用中</option>
          <option value="disabled">已停用</option>
          <option value="all">全部狀態</option>
        </select>
        <span style={styles.filterLabel}>生效期間</span>
        <input
          type="month"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          style={styles.input}
          aria-label="生效起始月份"
        />
        <span style={{ alignSelf: 'center', color: '#6b7280' }}>~</span>
        <input
          type="month"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          style={styles.input}
          aria-label="生效結束月份"
        />
        <button
          type="button"
          style={styles.linkBtn}
          onClick={() => { setFilterFrom(defaultMonth()); setFilterTo(defaultMonth()); }}
        >
          本月
        </button>
        <button
          type="button"
          style={styles.linkBtn}
          onClick={() => { setFilterFrom(''); setFilterTo(''); }}
        >
          清除期間
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>班級名稱</th>
              <th style={styles.th}>分校</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>定價/人</th>
              <th style={styles.th}>計費方式</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>目前人數</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>預估營收</th>
              <th style={styles.th}>生效期間</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={styles.empty}>載入中…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={9} style={styles.empty}>沒有符合條件的定價</td></tr>
            )}
            {visible.map((p) => {
              const count = studentCounts.get(p.classId) ?? 0;
              const revenue = p.price * count;
              return (
                <tr key={p.pricingId}>
                  <td style={styles.td}>
                    <div>{p.className}</div>
                    <div style={styles.subText}>
                      <code>{p.classId}</code>
                      {p.notes && <span style={styles.note}>・{p.notes}</span>}
                    </div>
                  </td>
                  <td style={styles.td}>{branchName(p.branchId)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    NT$ {TWD.format(p.price)}
                  </td>
                  <td style={styles.td}>{PRICE_TYPE_LABELS[p.priceType]}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{count}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                    NT$ {TWD.format(revenue)}
                  </td>
                  <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                    {formatEffectiveRange(p)}
                  </td>
                  <td style={styles.td}>
                    <span style={p.active ? styles.pillActive : styles.pillInactive}>
                      {p.active ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button type="button" style={styles.linkBtn} onClick={() => openEdit(p)}>編輯</button>
                    <button
                      type="button"
                      style={{ ...styles.linkBtn, color: p.active ? '#b91c1c' : '#166534' }}
                      onClick={() => toggleActive(p)}
                      disabled={busyId === p.pricingId}
                    >
                      {busyId === p.pricingId ? '處理中…' : p.active ? '停用' : '啟用'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ClassPricingFormDialog
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
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' },
  filterLabel: { alignSelf: 'center', color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.5rem' },
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
  td: { padding: '0.65rem 0.85rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
  subText: { color: '#6b7280', fontSize: '0.8rem', marginTop: 2 },
  note: { color: '#9ca3af' },
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
