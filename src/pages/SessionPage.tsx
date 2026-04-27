// 班級報到頁（Task 025）
//
// /session/:sessionId
// 兩個 realtime listener：sessions/{id} 與 attendance_records where sessionId==id。
// 顯示：場次抬頭（班級 / 時段 / 教室 / 老師 / 應到統計）+ 學生表格。
// Task 026 會把右側「操作」欄換成可點按的按鈕；本任務只先呈現資料與狀態欄。

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { subscribeAttendanceForSession, updateAttendance } from '../services/attendance';
import { subscribeSession } from '../services/sessions';
import { ROUTES } from '../routes/paths';
import { formatTimeWithSec } from '../utils/date';
import { canAccessBranch } from '../types/user';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type AttendanceRecordDoc,
  type AttendanceStatus,
} from '../types/attendance';
import type { SessionDoc } from '../types/session';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();
  const [session, setSession] = useState<SessionDoc | null | 'missing'>(null);
  const [records, setRecords] = useState<AttendanceRecordDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 手動報到：依目標狀態決定是否寫入 checkinTime / method=MANUAL。
  // 遲到判斷邏輯（Task 027）會接在 handleCheckIn 內，依 graceMinutes 決定 status。
  async function setStatus(record: AttendanceRecordDoc, target: AttendanceStatus) {
    setBusyId(record.recordId);
    try {
      const isPresent = target === 'CHECKED_IN' || target === 'LATE';
      await updateAttendance(record.recordId, {
        status: target,
        method: isPresent ? 'MANUAL' : null,
        confidence: null,
        operatorId: user?.userId ?? null,
        setCheckinNow: isPresent,
        clearCheckin: !isPresent,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeSession(sessionId, (s) => {
      setSession(s ?? 'missing');
    }, (e) => setError(e.message));
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeAttendanceForSession(
      sessionId,
      setRecords,
      (e) => setError(e.message),
    );
    return unsub;
  }, [sessionId]);

  const counts = useMemo(() => {
    const acc: Record<AttendanceStatus, number> = {
      SCHEDULED: 0, CHECKED_IN: 0, LATE: 0, LEAVE: 0, ABSENT: 0, MAKEUP: 0, CANCELLED: 0,
    };
    for (const r of records) acc[r.status] += 1;
    return acc;
  }, [records]);

  if (session === null) return <div style={{ color: '#6b7280' }}>載入中…</div>;
  if (session === 'missing') {
    return (
      <section>
        <h1>找不到場次</h1>
        <p><code>{sessionId}</code> 不存在。場次可能尚未產生 → 至「設定」頁觸發產生。</p>
        <Link to={ROUTES.classes}>← 回班級列表</Link>
      </section>
    );
  }

  // 跨分校保護
  if (user && !canAccessBranch(user, session.branchId)) {
    return <Navigate to={ROUTES.login} replace />;
  }

  const branchName = branches.find((b) => b.branchId === session.branchId)?.name ?? session.branchId;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <Link to={ROUTES.branchDashboard(session.branchId)} style={styles.back}>
            ← 回 {branchName} 看板
          </Link>
          <h1 style={styles.title}>{session.className}</h1>
          <p style={styles.subtitle}>
            {session.date} · {session.startTime}–{session.endTime}
            {session.classroom ? ` · 教室 ${session.classroom}` : ''}
            {session.teacherId ? ` · 老師 ${session.teacherId}` : ''}
            {' · '}<code>{session.sessionId}</code>
          </p>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.summary}>
        <SummaryPill label="應到" value={records.length} status="SCHEDULED" />
        <SummaryPill label="已到" value={counts.CHECKED_IN + counts.LATE} status="CHECKED_IN" />
        <SummaryPill label="遲到" value={counts.LATE} status="LATE" />
        <SummaryPill label="請假" value={counts.LEAVE} status="LEAVE" />
        <SummaryPill label="未到" value={counts.ABSENT + counts.SCHEDULED} status="ABSENT" />
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>學生</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>報到時間</th>
              <th style={styles.th}>方式</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={5} style={styles.empty}>
                  此場次尚無應到名單。請至「班級學生管理」加入學生，再重新產生場次。
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.recordId}>
                <td style={styles.td}>
                  <Link to={`/students/${r.studentId}`}>{r.studentName}</Link>
                  <span style={styles.studentIdMeta}><code>{r.studentId}</code></span>
                </td>
                <td style={styles.td}><StatusPill status={r.status} /></td>
                <td style={styles.td}>
                  {r.checkinTime
                    ? formatTimeWithSec(r.checkinTime.toDate())
                    : '—'}
                </td>
                <td style={styles.td}>{methodLabel(r.method)}</td>
                <td style={styles.td}>
                  <ActionButtons
                    record={r}
                    busy={busyId === r.recordId}
                    onSet={setStatus}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionButtons({
  record, busy, onSet,
}: {
  record: AttendanceRecordDoc;
  busy: boolean;
  onSet: (r: AttendanceRecordDoc, s: AttendanceStatus) => Promise<void>;
}) {
  const isPresent = record.status === 'CHECKED_IN' || record.status === 'LATE';
  const isLeave = record.status === 'LEAVE';
  const isAbsent = record.status === 'ABSENT';

  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      <ActionBtn
        label="已到"
        active={isPresent}
        accent="#166534"
        disabled={busy}
        onClick={() => onSet(record, 'CHECKED_IN')}
      />
      <ActionBtn
        label="請假"
        active={isLeave}
        accent="#1e40af"
        disabled={busy}
        onClick={() => onSet(record, 'LEAVE')}
      />
      <ActionBtn
        label="未到"
        active={isAbsent}
        accent="#b91c1c"
        disabled={busy}
        onClick={() => onSet(record, 'ABSENT')}
      />
      <ActionBtn
        label="重設"
        active={false}
        accent="#6b7280"
        disabled={busy || record.status === 'SCHEDULED'}
        onClick={() => onSet(record, 'SCHEDULED')}
      />
    </div>
  );
}

function ActionBtn({
  label, active, accent, disabled, onClick,
}: {
  label: string; active: boolean; accent: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.25rem 0.6rem',
        fontSize: '0.85rem',
        borderRadius: 6,
        border: `1px solid ${active ? accent : '#d1d5db'}`,
        background: active ? accent : '#fff',
        color: active ? '#fff' : accent,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function methodLabel(m: AttendanceRecordDoc['method']): string {
  if (m === 'FACE') return '人臉';
  if (m === 'MANUAL') return '手動';
  return '—';
}

function StatusPill({ status }: { status: AttendanceStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: c.bg, color: c.fg }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function SummaryPill({ label, value, status }: { label: string; value: number; status: AttendanceStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${c.fg}` }}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c.fg, marginTop: '0.2rem' }}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '1.25rem' },
  back: { color: '#6b7280', fontSize: '0.9rem', display: 'inline-block', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
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
  td: { padding: '0.65rem 1rem', borderBottom: '1px solid #f3f4f6' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  studentIdMeta: { color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.5rem' },
};
