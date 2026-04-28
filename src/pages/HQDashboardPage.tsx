// HQ Dashboard（Task 042）
//
// 全公司今日彙整：每個分校一行，顯示
//   今日班級數 / 應到 / 已到 / 未到 / 請假 / 遲到 / 到班率
//
// 兩個跨分校 realtime listener：
//   subscribeAllSessionsForDate(date)
//   subscribeAllAttendanceForDate(date)
//
// 非 HQ 角色登入後不會走到這裡（AppLayout 不顯示連結 + AuthGuard 不阻擋
// 此頁但實務上 hq_admin 才會看到入口）。為穩固，仍在頁面顯示 fallback 訊息。
//
// Task 043: 點分校列 → /branch-dashboard/:branchId
// Task 044: 異常提醒區（未到比例過高 / 人臉失敗過多 / 未完成點名）

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { HQAnomalyPanel } from '../components/HQAnomalyPanel';
import { useAuth } from '../hooks/useAuth';
import { subscribeBranches } from '../services/branches';
import { subscribeAllAttendanceForDate } from '../services/attendance';
import { subscribeAllSessionsForDate } from '../services/sessions';
import { ROUTES } from '../routes/paths';
import { todayISO } from '../utils/date';
import type { BranchDoc } from '../types/branch';
import type { SessionDoc } from '../types/session';
import type { AttendanceRecordDoc, AttendanceStatus } from '../types/attendance';

interface BranchRow {
  branch: BranchDoc;
  classCount: number;
  total: number;       // 應到
  checkedIn: number;   // CHECKED_IN
  late: number;        // LATE
  leave: number;       // LEAVE
  absent: number;      // ABSENT
  scheduled: number;   // SCHEDULED（仍未報到）
  attendanceRate: number; // (checkedIn + late) / total
}

const EMPTY_ROW = (b: BranchDoc): BranchRow => ({
  branch: b,
  classCount: 0,
  total: 0,
  checkedIn: 0,
  late: 0,
  leave: 0,
  absent: 0,
  scheduled: 0,
  attendanceRate: 0,
});

export function HQDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [records, setRecords] = useState<AttendanceRecordDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeBranches(setBranches, (e) => setError(e.message));
  }, []);

  useEffect(() => {
    return subscribeAllSessionsForDate(date, setSessions, (e) => setError(e.message));
  }, [date]);

  useEffect(() => {
    return subscribeAllAttendanceForDate(date, setRecords, (e) => setError(e.message));
  }, [date]);

  const rows = useMemo(() => buildRows(branches, sessions, records), [branches, sessions, records]);
  const totals = useMemo(() => sumRows(rows), [rows]);

  // 非 HQ 不該看到此頁；保險導回 login（AuthGuard 不會擋）
  if (user && user.role !== 'hq_admin') {
    return <Navigate to={ROUTES.login} replace />;
  }

  const isToday = date === todayISO();

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>總部 Dashboard</h1>
          <p style={styles.subtitle}>
            {date}{isToday && <span style={styles.todayBadge}>今天</span>} · 共 {rows.length} 個分校
          </p>
        </div>
        <div style={styles.dateBox}>
          <label style={{ fontSize: '0.85rem', color: '#374151' }}>查看日期：</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.dateInput}
          />
          {!isToday && (
            <button type="button" style={styles.btnGhost} onClick={() => setDate(todayISO())}>
              回到今天
            </button>
          )}
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.summary}>
        <SummaryCard label="今日班級總數" value={totals.classCount} accent="#1f2937" />
        <SummaryCard label="應到" value={totals.total} accent="#374151" />
        <SummaryCard label="已到" value={totals.checkedIn + totals.late} accent="#166534" />
        <SummaryCard label="遲到" value={totals.late} accent="#92400e" />
        <SummaryCard label="請假" value={totals.leave} accent="#1e40af" />
        <SummaryCard label="未到" value={totals.absent + totals.scheduled} accent="#b91c1c" />
        <SummaryCard
          label="到班率"
          value={`${(totals.attendanceRate * 100).toFixed(1)}%`}
          accent="#0f766e"
        />
      </div>

      <HQAnomalyPanel date={date} sessions={sessions} records={records} />

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>分校</th>
              <th style={styles.thNum}>今日班級</th>
              <th style={styles.thNum}>應到</th>
              <th style={styles.thNum}>已到</th>
              <th style={styles.thNum}>遲到</th>
              <th style={styles.thNum}>請假</th>
              <th style={styles.thNum}>未到</th>
              <th style={styles.thNum}>到班率</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={styles.empty}>尚無分校資料</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.branch.branchId}
                style={styles.rowClickable}
                onClick={() => navigate(ROUTES.branchDashboard(r.branch.branchId))}
                title={`進入 ${r.branch.name} 看板`}
              >
                <td style={styles.td}>
                  <Link
                    to={ROUTES.branchDashboard(r.branch.branchId)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontWeight: 600, color: '#1f2937' }}
                  >
                    {r.branch.name}
                  </Link>
                  <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                    <code>{r.branch.branchId}</code>
                  </div>
                </td>
                <td style={styles.tdNum}>{r.classCount}</td>
                <td style={styles.tdNum}>{r.total}</td>
                <td style={{ ...styles.tdNum, color: '#166534' }}>{r.checkedIn + r.late}</td>
                <td style={{ ...styles.tdNum, color: '#92400e' }}>{r.late}</td>
                <td style={{ ...styles.tdNum, color: '#1e40af' }}>{r.leave}</td>
                <td style={{ ...styles.tdNum, color: (r.absent + r.scheduled) > 0 ? '#b91c1c' : '#9ca3af' }}>
                  {r.absent + r.scheduled}
                </td>
                <td style={{ ...styles.tdNum, fontWeight: 600 }}>
                  {r.total === 0 ? '—' : `${(r.attendanceRate * 100).toFixed(0)}%`}
                </td>
                <td style={styles.td}>
                  <Link
                    to={ROUTES.branchDashboard(r.branch.branchId)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: '#2563eb', fontSize: '0.9rem' }}
                  >
                    進入看板 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildRows(
  branches: BranchDoc[],
  sessions: SessionDoc[],
  records: AttendanceRecordDoc[],
): BranchRow[] {
  const map = new Map<string, BranchRow>();
  for (const b of branches) map.set(b.branchId, EMPTY_ROW(b));

  // 班級數：每個 branch 的 sessions count
  for (const s of sessions) {
    const row = map.get(s.branchId);
    if (row) row.classCount += 1;
  }

  // 應到 / 已到 / etc.
  for (const r of records) {
    const row = map.get(r.branchId);
    if (!row) continue;
    row.total += 1;
    bump(row, r.status);
  }

  // 到班率
  for (const row of map.values()) {
    if (row.total === 0) {
      row.attendanceRate = 0;
    } else {
      row.attendanceRate = (row.checkedIn + row.late) / row.total;
    }
  }

  // 排序：到班率高的在前；同分數按名稱
  return Array.from(map.values()).sort((a, b) => {
    if (b.attendanceRate !== a.attendanceRate) return b.attendanceRate - a.attendanceRate;
    return a.branch.name.localeCompare(b.branch.name);
  });
}

function bump(row: BranchRow, status: AttendanceStatus): void {
  switch (status) {
    case 'CHECKED_IN': row.checkedIn += 1; break;
    case 'LATE':       row.late += 1; break;
    case 'LEAVE':      row.leave += 1; break;
    case 'ABSENT':     row.absent += 1; break;
    case 'SCHEDULED':  row.scheduled += 1; break;
    case 'MAKEUP':     row.checkedIn += 1; break;
    case 'CANCELLED':  break;
  }
}

interface Totals {
  classCount: number;
  total: number;
  checkedIn: number;
  late: number;
  leave: number;
  absent: number;
  scheduled: number;
  attendanceRate: number;
}

function sumRows(rows: BranchRow[]): Totals {
  const t: Totals = {
    classCount: 0, total: 0, checkedIn: 0, late: 0, leave: 0, absent: 0, scheduled: 0, attendanceRate: 0,
  };
  for (const r of rows) {
    t.classCount += r.classCount;
    t.total += r.total;
    t.checkedIn += r.checkedIn;
    t.late += r.late;
    t.leave += r.leave;
    t.absent += r.absent;
    t.scheduled += r.scheduled;
  }
  if (t.total > 0) t.attendanceRate = (t.checkedIn + t.late) / t.total;
  return t;
}

function SummaryCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div style={styles.card}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: accent, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
  );
}

// 在頁面外 export，方便 Task 044 anomaly 區參考
export function notArrivedCount(row: BranchRow): number {
  return row.absent + row.scheduled;
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  todayBadge: {
    marginLeft: '0.5rem', padding: '0.1rem 0.45rem',
    background: '#dbeafe', color: '#1e40af',
    borderRadius: 10, fontSize: '0.75rem',
  },
  dateBox: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  dateInput: {
    padding: '0.45rem 0.6rem', fontSize: '0.9rem',
    border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', outline: 'none',
  },
  btnGhost: {
    padding: '0.4rem 0.7rem', background: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem',
  },
  error: {
    padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, marginBottom: '1rem',
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem', marginBottom: '1rem',
  },
  card: {
    background: '#fff', borderRadius: 8, padding: '0.85rem 1rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' },
  th: {
    textAlign: 'left', padding: '0.7rem 1rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600,
  },
  thNum: {
    textAlign: 'right', padding: '0.7rem 1rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600,
  },
  td: { padding: '0.7rem 1rem', borderBottom: '1px solid #f3f4f6' },
  tdNum: { padding: '0.7rem 1rem', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  rowClickable: { cursor: 'pointer' },
};

// 給 Task 044 用：BranchRow 與 Totals 型別 export
export type { BranchRow, Totals };
