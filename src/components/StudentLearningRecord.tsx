// 學生學習紀錄區塊（F2）
//
// 顯示：累計學習時數（CHECKED_IN / LATE 且無有效請假的場次時數合計）
//        + 請假單狀態一覽（全部 leave_requests）。
// 時數計算邏輯委派給 services/learningHours.ts。

import { useEffect, useMemo, useState } from 'react';

import { subscribeAllAttendanceForStudent } from '../services/attendance';
import { subscribeLeaveRequestsForStudent } from '../services/leaveRequests';
import {
  calcStudentLearningHours,
  fetchSessionsByIds,
} from '../services/learningHours';
import type { AttendanceRecordDoc } from '../types/attendance';
import {
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  type LeaveRequestDoc,
} from '../types/leaveRequest';
import type { SessionDoc } from '../types/session';

interface Props {
  studentId: string;
}

export function StudentLearningRecord({ studentId }: Props) {
  const [records, setRecords] = useState<AttendanceRecordDoc[]>([]);
  const [sessionsById, setSessionsById] = useState<Map<string, SessionDoc>>(new Map());
  const [leaves, setLeaves] = useState<LeaveRequestDoc[]>([]);

  // 訂閱全部出席紀錄
  useEffect(() => {
    return subscribeAllAttendanceForStudent(studentId, setRecords);
  }, [studentId]);

  // 訂閱請假單
  useEffect(() => {
    return subscribeLeaveRequestsForStudent(studentId, setLeaves);
  }, [studentId]);

  // 當 records 改變時，批次補齊對應的 session 資料
  useEffect(() => {
    const presentRecords = records.filter(
      (r) => r.status === 'CHECKED_IN' || r.status === 'LATE',
    );
    const sessionIds = Array.from(new Set(presentRecords.map((r) => r.sessionId)));
    // 只查詢尚未快取的 session
    const missing = sessionIds.filter((id) => !sessionsById.has(id));
    if (missing.length === 0) return;
    fetchSessionsByIds(missing).then((newMap) => {
      setSessionsById((prev) => {
        const next = new Map(prev);
        for (const [k, v] of newMap) next.set(k, v);
        return next;
      });
    });
  }, [records]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalHours = useMemo(
    () => calcStudentLearningHours(records, sessionsById),
    [records, sessionsById],
  );

  // 最近 10 筆出席紀錄供快速瀏覽
  const recentRecords = useMemo(() => records.slice(0, 10), [records]);

  return (
    <>
      {/* 累計時數卡 */}
      <article style={styles.card}>
        <h2 style={styles.h2}>學習紀錄</h2>

        <div style={styles.hoursBanner}>
          <span style={styles.hoursLabel}>累計學習時數</span>
          <span style={styles.hoursValue}>{totalHours.toFixed(1)}</span>
          <span style={styles.hoursUnit}>小時</span>
        </div>

        {recentRecords.length > 0 && (
          <>
            <p style={styles.sectionTitle}>最近出席紀錄</p>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>場次</th>
                    <th style={styles.th}>班級</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRecords.map((r) => {
                    const session = sessionsById.get(r.sessionId);
                    const dateLabel = session
                      ? `${session.date} ${session.startTime}`
                      : r.sessionId.split('_')[0] ?? r.sessionId;
                    return (
                      <tr key={r.recordId}>
                        <td style={styles.td}>{dateLabel}</td>
                        <td style={styles.td}>{session?.className ?? '—'}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <span style={recStatusStyle(r.status)}>{STATUS_LABELS[r.status] ?? r.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {records.length > 10 && (
              <p style={styles.moreNote}>共 {records.length} 筆，顯示最近 10 筆</p>
            )}
          </>
        )}
      </article>

      {/* 請假單一覽 */}
      <article style={styles.card}>
        <h2 style={styles.h2}>請假紀錄（{leaves.length}）</h2>
        {leaves.length === 0 ? (
          <p style={styles.empty}>無請假紀錄</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>日期</th>
                  <th style={styles.th}>原因</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>狀態</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((lv) => {
                  const dateLabel = lv.createdAt
                    ? new Date(lv.createdAt.seconds * 1000).toLocaleDateString('zh-TW')
                    : '—';
                  const colors = LEAVE_STATUS_COLORS[lv.status];
                  return (
                    <tr key={lv.leaveId}>
                      <td style={styles.td}>{dateLabel}</td>
                      <td style={styles.td}>{lv.reason || '—'}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span style={{ ...styles.pill, background: colors.bg, color: colors.text }}>
                          {LEAVE_STATUS_LABELS[lv.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: '應到',
  CHECKED_IN: '已到',
  LATE: '遲到',
  LEAVE: '請假',
  ABSENT: '未到',
  MAKEUP: '補課',
  CANCELLED: '取消',
};

function recStatusStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    CHECKED_IN: { bg: '#dcfce7', fg: '#166534' },
    LATE: { bg: '#fef3c7', fg: '#92400e' },
    LEAVE: { bg: '#dbeafe', fg: '#1e40af' },
    ABSENT: { bg: '#fee2e2', fg: '#b91c1c' },
    MAKEUP: { bg: '#ede9fe', fg: '#5b21b6' },
    SCHEDULED: { bg: '#f3f4f6', fg: '#6b7280' },
    CANCELLED: { bg: '#f3f4f6', fg: '#9ca3af' },
  };
  const c = colors[status] ?? { bg: '#f3f4f6', fg: '#374151' };
  return { ...styles.pill, background: c.bg, color: c.fg };
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '1.25rem',
  },
  h2: { margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#374151' },
  hoursBanner: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    padding: '0.75rem 1rem',
    background: '#eff6ff',
    borderRadius: 8,
    marginBottom: '1rem',
  },
  hoursLabel: { fontSize: '0.9rem', color: '#1d4ed8', flex: 1 },
  hoursValue: { fontSize: '2rem', fontWeight: 700, color: '#1d4ed8' },
  hoursUnit: { fontSize: '0.9rem', color: '#1d4ed8' },
  sectionTitle: { margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' },
  th: {
    textAlign: 'left',
    padding: '0.45rem 0.75rem',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontWeight: 600,
    color: '#374151',
  },
  td: { padding: '0.45rem 0.75rem', borderBottom: '1px solid #f3f4f6' },
  pill: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  empty: { color: '#9ca3af', fontSize: '0.9rem', margin: 0, fontStyle: 'italic' },
  moreNote: { margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#9ca3af', textAlign: 'right' },
};
