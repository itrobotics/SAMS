// 分校今日班級看板（Task 024）
//
// /branch-dashboard/:branchId
// 顯示該分校「今日」所有 sessions，附每班的 應到 / 已到 / 未到 / 請假 / 遲到 統計。
// 兩個 realtime listener：sessions（過濾 branchId+date）+ attendance_records
// （以 sessionId 範圍查 [YYYYMMDD_, YYYYMMDD`)）。
// 點擊班級進入 /session/:sessionId 進行報到（Task 025）。

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useBranches } from '../hooks/useBranches';
import {
  useBranchDayAttendanceRealtime,
  useBranchDaySessionsRealtime,
} from '../hooks/useRealtime';
import { deleteSessionWithRecords } from '../services/sessions';
import { ROUTES } from '../routes/paths';
import { todayISO } from '../utils/date';
import type { AttendanceStatus } from '../types/attendance';

interface SessionStats {
  total: number;
  checkedIn: number;
  late: number;
  leave: number;
  absent: number;
  scheduled: number;
}

const EMPTY_STATS: SessionStats = {
  total: 0, checkedIn: 0, late: 0, leave: 0, absent: 0, scheduled: 0,
};

export function BranchDashboardPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const { branches } = useBranches();
  const [date, setDate] = useState<string>(todayISO());
  const [busyId, setBusyId] = useState<string | null>(null);

  const sessionsRT = useBranchDaySessionsRealtime(branchId, date);
  const recordsRT = useBranchDayAttendanceRealtime(branchId, date);
  const sessions = sessionsRT.data;
  const records = recordsRT.data;
  const error = sessionsRT.error ?? recordsRT.error;

  const branchName = branches.find((b) => b.branchId === branchId)?.name ?? branchId;

  const statsBySession = useMemo(() => {
    const map = new Map<string, SessionStats>();
    for (const r of records) {
      const cur = map.get(r.sessionId) ?? { ...EMPTY_STATS };
      cur.total += 1;
      bumpByStatus(cur, r.status);
      map.set(r.sessionId, cur);
    }
    return map;
  }, [records]);

  const totals = useMemo(() => {
    const acc: SessionStats = { ...EMPTY_STATS };
    for (const s of statsBySession.values()) {
      acc.total += s.total;
      acc.checkedIn += s.checkedIn;
      acc.late += s.late;
      acc.leave += s.leave;
      acc.absent += s.absent;
      acc.scheduled += s.scheduled;
    }
    return acc;
  }, [statsBySession]);

  async function handleDelete(sessionId: string, label: string) {
    if (!window.confirm(`確定刪除場次「${label}」？\n此操作無法復原，出席紀錄將一併刪除。`)) return;
    setBusyId(sessionId);
    try {
      await deleteSessionWithRecords(sessionId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '刪除失敗');
    } finally {
      setBusyId(null);
    }
  }

  const isToday = date === todayISO();

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{branchName} 今日看板</h1>
          <p style={styles.subtitle}>
            <code>{branchId}</code> · {date}
            {isToday && <span style={styles.todayBadge}>今天</span>}
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
        <SummaryCard label="今日班級" value={sessions.length} accent="#1f2937" />
        <SummaryCard label="應到" value={totals.total} accent="#374151" />
        <SummaryCard label="已到" value={totals.checkedIn + totals.late} accent="#166534" />
        <SummaryCard label="遲到" value={totals.late} accent="#92400e" />
        <SummaryCard label="請假" value={totals.leave} accent="#1e40af" />
        <SummaryCard label="未到" value={totals.absent + totals.scheduled} accent="#b91c1c" />
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>時間</th>
              <th style={styles.th}>班級</th>
              <th style={styles.th}>教室</th>
              <th style={styles.thNum}>應到</th>
              <th style={styles.thNum}>已到</th>
              <th style={styles.thNum}>遲到</th>
              <th style={styles.thNum}>請假</th>
              <th style={styles.thNum}>未到</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr>
                <td colSpan={10} style={styles.empty}>
                  此日期尚無場次。可至「設定 → 每日場次產生」建立。
                </td>
              </tr>
            )}
            {sessions.map((s) => {
              const stat = statsBySession.get(s.sessionId) ?? EMPTY_STATS;
              const notArrived = stat.absent + stat.scheduled;
              return (
                <tr key={s.sessionId}>
                  <td style={styles.td}>{s.startTime}–{s.endTime}</td>
                  <td style={styles.td}>
                    <Link to={ROUTES.session(s.sessionId)}>{s.className}</Link>
                  </td>
                  <td style={styles.td}>{s.classroom || '—'}</td>
                  <td style={styles.tdNum}>{stat.total}</td>
                  <td style={{ ...styles.tdNum, color: '#166534' }}>{stat.checkedIn + stat.late}</td>
                  <td style={{ ...styles.tdNum, color: '#92400e' }}>{stat.late}</td>
                  <td style={{ ...styles.tdNum, color: '#1e40af' }}>{stat.leave}</td>
                  <td style={{ ...styles.tdNum, color: notArrived > 0 ? '#b91c1c' : '#9ca3af' }}>
                    {notArrived}
                  </td>
                  <td style={styles.td}>
                    <SessionStatusPill status={s.status} />
                  </td>
                  <td style={styles.td}>
                    <Link to={ROUTES.session(s.sessionId)}>進入報到 →</Link>
                    <button
                      type="button"
                      style={styles.deleteBtn}
                      disabled={busyId === s.sessionId}
                      onClick={() => handleDelete(s.sessionId, `${s.className} ${s.startTime}`)}
                    >
                      {busyId === s.sessionId ? '刪除中…' : '刪除'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function bumpByStatus(stats: SessionStats, status: AttendanceStatus): void {
  switch (status) {
    case 'CHECKED_IN': stats.checkedIn += 1; return;
    case 'LATE':       stats.late += 1; return;
    case 'LEAVE':      stats.leave += 1; return;
    case 'ABSENT':     stats.absent += 1; return;
    case 'SCHEDULED':  stats.scheduled += 1; return;
    case 'MAKEUP':     stats.checkedIn += 1; return;
    case 'CANCELLED':  return;
  }
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={styles.card}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: accent, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
  );
}

function SessionStatusPill({ status }: { status: 'waiting' | 'running' | 'finished' }) {
  const map = {
    waiting:  { bg: '#f3f4f6', fg: '#6b7280', label: '等待中' },
    running:  { bg: '#dbeafe', fg: '#1e40af', label: '進行中' },
    finished: { bg: '#dcfce7', fg: '#166534', label: '已結束' },
  } as const;
  const c = map[status];
  return (
    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
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
  deleteBtn: {
    marginLeft: '0.5rem', padding: '0.2rem 0.5rem',
    background: 'transparent', color: '#b91c1c',
    border: '1px solid #fca5a5', borderRadius: 4,
    fontSize: '0.85rem', cursor: 'pointer',
  },
};
