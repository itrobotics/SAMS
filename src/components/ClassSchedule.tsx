// 班級視覺化課表（F1）
//
// 顯示某班級所有 sessions 的課表，分「全部課表」/ 「本月課表」兩個 Tab。
// 每筆場次顯示：日期時間、課程主題、講師、報到人數 / 總人數。
// 資料源：sessions + attendance_records（由 classId 查詢，不新增 collection）。

import { useEffect, useMemo, useState } from 'react';

import { subscribeAttendanceForClass } from '../services/attendance';
import { subscribeSessionsForClass } from '../services/sessions';
import type { AttendanceRecordDoc } from '../types/attendance';
import type { SessionDoc } from '../types/session';

const WEEKDAY_ZH: Record<number, string> = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日',
};

function isoWeekdayFromDate(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 ? 7 : dow;
}

function formatSessionDate(dateISO: string): string {
  const [, m, d] = dateISO.split('-').map(Number);
  const wd = isoWeekdayFromDate(dateISO);
  return `${m}/${d} (週${WEEKDAY_ZH[wd] ?? '?'})`;
}

type Tab = 'all' | 'month';

interface AttendanceSummary {
  present: number;
  total: number;
}

interface Props {
  classId: string;
  instructorMap: Map<string, string>;
}

export function ClassSchedule({ classId, instructorMap }: Props) {
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [records, setRecords] = useState<AttendanceRecordDoc[]>([]);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    return subscribeSessionsForClass(classId, setSessions);
  }, [classId]);

  useEffect(() => {
    return subscribeAttendanceForClass(classId, setRecords);
  }, [classId]);

  // 依 sessionId 彙整出席統計
  const summaryBySession = useMemo(() => {
    const map = new Map<string, AttendanceSummary>();
    for (const rec of records) {
      const entry = map.get(rec.sessionId) ?? { present: 0, total: 0 };
      if (rec.status !== 'CANCELLED') entry.total += 1;
      if (rec.status === 'CHECKED_IN' || rec.status === 'LATE') entry.present += 1;
      map.set(rec.sessionId, entry);
    }
    return map;
  }, [records]);

  const currentYM = useMemo(() => {
    const now = new Date();
    const m = now.getMonth() + 1;
    return `${now.getFullYear()}-${m < 10 ? `0${m}` : m}`;
  }, []);

  const displaySessions = useMemo(
    () => tab === 'month' ? sessions.filter((s) => s.date.startsWith(currentYM)) : sessions,
    [sessions, tab, currentYM],
  );

  const monthLabel = useMemo(() => {
    const [y, m] = currentYM.split('-');
    return `${y} 年 ${Number(m)} 月`;
  }, [currentYM]);

  return (
    <article style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.h2}>課表</h2>
        <div style={styles.tabs}>
          <button
            type="button"
            style={tab === 'all' ? styles.tabActive : styles.tab}
            onClick={() => setTab('all')}
          >
            全部課表（{sessions.length}）
          </button>
          <button
            type="button"
            style={tab === 'month' ? styles.tabActive : styles.tab}
            onClick={() => setTab('month')}
          >
            {monthLabel}（{sessions.filter((s) => s.date.startsWith(currentYM)).length}）
          </button>
        </div>
      </div>

      {displaySessions.length === 0 ? (
        <p style={styles.empty}>
          {tab === 'month' ? `${monthLabel}無排課` : '尚未產生任何場次'}
        </p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>日期</th>
                <th style={styles.th}>時間</th>
                <th style={styles.th}>課程</th>
                <th style={styles.th}>教室</th>
                <th style={styles.th}>講師</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>報到</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>狀態</th>
              </tr>
            </thead>
            <tbody>
              {displaySessions.map((s) => {
                const summary = summaryBySession.get(s.sessionId);
                const instructorName = s.teacherId
                  ? (instructorMap.get(s.teacherId) ?? s.teacherId)
                  : '—';
                return (
                  <tr key={s.sessionId}>
                    <td style={styles.td}>{formatSessionDate(s.date)}</td>
                    <td style={styles.td}>{s.startTime}–{s.endTime}</td>
                    <td style={styles.td}>{s.className}</td>
                    <td style={styles.td}>{s.classroom || '—'}</td>
                    <td style={styles.td}>{instructorName}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {summary
                        ? <span style={styles.attendance}>{summary.present} / {summary.total}</span>
                        : <span style={styles.noData}>—</span>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={statusStyle(s.status)}>{STATUS_LABELS[s.status]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

const STATUS_LABELS: Record<string, string> = {
  waiting: '待開始',
  running: '進行中',
  finished: '已完成',
};

function statusStyle(status: string): React.CSSProperties {
  if (status === 'running') return { ...styles.pill, background: '#dcfce7', color: '#166534' };
  if (status === 'finished') return { ...styles.pill, background: '#f3f4f6', color: '#6b7280' };
  return { ...styles.pill, background: '#dbeafe', color: '#1e40af' };
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '1.25rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  h2: { margin: 0, fontSize: '1.05rem', color: '#374151' },
  tabs: { display: 'flex', gap: '0.25rem' },
  tab: {
    padding: '0.3rem 0.75rem',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: 20,
    fontSize: '0.88rem',
    color: '#6b7280',
    cursor: 'pointer',
  },
  tabActive: {
    padding: '0.3rem 0.75rem',
    background: '#2563eb',
    border: '1px solid #2563eb',
    borderRadius: 20,
    fontSize: '0.88rem',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' },
  th: {
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    borderBottom: '2px solid #e5e7eb',
    background: '#f9fafb',
    fontWeight: 600,
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid #f3f4f6',
    whiteSpace: 'nowrap',
  },
  attendance: { fontWeight: 600, color: '#2563eb' },
  noData: { color: '#d1d5db' },
  pill: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  empty: { color: '#9ca3af', fontSize: '0.9rem', margin: 0, fontStyle: 'italic', padding: '1rem 0' },
};
