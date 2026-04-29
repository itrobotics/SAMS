// 課程方案場次出席管理頁
//
// /courses/:courseId/sessions/:courseSessionId
// 類似 SessionPage：列出本場次所有 course_attendance，可手動切換狀態。
// 與班級 attendance 的差異：
//   - 沒有 SCHEDULED：建立場次時即以 ABSENT 寫入，老師標「已到」覆寫即可
//   - method 永遠是 MANUAL（人臉辨識僅班級用）

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';

import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { db } from '../services/firebase';
import {
  subscribeCourseAttendance,
  updateCourseAttendance,
} from '../services/courseAttendance';
import { ROUTES } from '../routes/paths';
import { formatTimeWithSec } from '../utils/date';
import { canAccessBranch } from '../types/user';
import {
  COURSE_SESSIONS_COLLECTION,
  COURSE_SESSION_STATUS_LABELS,
  type CourseSessionDoc,
} from '../types/courseSession';
import {
  COURSE_ATTENDANCE_STATUSES,
  COURSE_ATTENDANCE_STATUS_COLORS,
  COURSE_ATTENDANCE_STATUS_LABELS,
  type CourseAttendanceDoc,
  type CourseAttendanceStatus,
} from '../types/courseAttendance';

export function CourseSessionPage() {
  const { courseId, courseSessionId } = useParams<{ courseId: string; courseSessionId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();

  const [session, setSession] = useState<CourseSessionDoc | null | 'missing'>(null);
  const [records, setRecords] = useState<CourseAttendanceDoc[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseSessionId) return;
    const unsub = onSnapshot(
      doc(db, COURSE_SESSIONS_COLLECTION, courseSessionId),
      (snap) => {
        if (!snap.exists()) {
          setSession('missing');
        } else {
          setSession({ courseSessionId: snap.id, ...(snap.data() as Omit<CourseSessionDoc, 'courseSessionId'>) });
        }
      },
      (e) => setError(e.message),
    );
    return unsub;
  }, [courseSessionId]);

  useEffect(() => {
    if (!courseSessionId) return;
    return subscribeCourseAttendance(courseSessionId, setRecords, (e) => setError(e.message));
  }, [courseSessionId]);

  async function setStatus(rec: CourseAttendanceDoc, target: CourseAttendanceStatus) {
    setBusyId(rec.attendanceId);
    try {
      const isPresent = target === 'CHECKED_IN' || target === 'LATE';
      await updateCourseAttendance(rec.attendanceId, {
        status: target,
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

  const counts = useMemo(() => {
    const acc: Record<CourseAttendanceStatus, number> = {
      CHECKED_IN: 0, LATE: 0, LEAVE: 0, ABSENT: 0,
    };
    for (const r of records) acc[r.status] += 1;
    return acc;
  }, [records]);

  if (session === null) return <div style={{ color: '#6b7280' }}>載入中…</div>;
  if (session === 'missing') {
    return (
      <section>
        <h1>找不到場次</h1>
        <p><code>{courseSessionId}</code> 不存在。</p>
        <Link to={courseId ? ROUTES.courseDetail(courseId) : ROUTES.courses}>← 回課程方案</Link>
      </section>
    );
  }
  if (user && !canAccessBranch(user, session.branchId)) {
    return <Navigate to={ROUTES.login} replace />;
  }

  const branchName = branches.find((b) => b.branchId === session.branchId)?.name ?? session.branchId;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <Link to={ROUTES.courseDetail(session.courseId)} style={styles.back}>
            ← 回課程方案
          </Link>
          <h1 style={styles.title}>場次報到</h1>
          <p style={styles.subtitle}>
            {branchName} · {session.date} · {session.startTime}–{session.endTime}
            {' · 時數 '}{session.hours}
            {session.classroom ? ` · 教室 ${session.classroom}` : ''}
            {session.instructorId ? ` · 講師 ${session.instructorId}` : ''}
            {' · '}<code>{session.courseSessionId}</code>
            {' · '}{COURSE_SESSION_STATUS_LABELS[session.status]}
          </p>
          {session.notes && (
            <p style={styles.notes}>備註：{session.notes}</p>
          )}
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.summary}>
        <SummaryPill label="應到" value={records.length} />
        <SummaryPill label="已到" value={counts.CHECKED_IN + counts.LATE} status="CHECKED_IN" />
        <SummaryPill label="遲到" value={counts.LATE} status="LATE" />
        <SummaryPill label="請假" value={counts.LEAVE} status="LEAVE" />
        <SummaryPill label="未到" value={counts.ABSENT} status="ABSENT" />
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>學員</th>
              <th style={styles.th}>狀態</th>
              <th style={styles.th}>報到時間</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={4} style={styles.empty}>
                  此場次尚無學員。請先在課程方案加入學員，再重新建立場次。
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.attendanceId}>
                <td style={styles.td}>
                  <Link to={`/students/${r.studentId}`}>{r.studentName}</Link>
                  <span style={styles.studentIdMeta}><code>{r.studentId}</code></span>
                </td>
                <td style={styles.td}><StatusPill status={r.status} /></td>
                <td style={styles.td}>
                  {r.checkinTime ? formatTimeWithSec(r.checkinTime.toDate()) : '—'}
                </td>
                <td style={styles.td}>
                  <ActionButtons
                    record={r}
                    busy={busyId === r.attendanceId}
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
  record: CourseAttendanceDoc;
  busy: boolean;
  onSet: (r: CourseAttendanceDoc, s: CourseAttendanceStatus) => Promise<void>;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      {COURSE_ATTENDANCE_STATUSES.map((s) => (
        <ActionBtn
          key={s}
          label={COURSE_ATTENDANCE_STATUS_LABELS[s]}
          active={record.status === s}
          accent={COURSE_ATTENDANCE_STATUS_COLORS[s].fg}
          disabled={busy}
          onClick={() => onSet(record, s)}
        />
      ))}
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

function StatusPill({ status }: { status: CourseAttendanceStatus }) {
  const c = COURSE_ATTENDANCE_STATUS_COLORS[status];
  return (
    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: c.bg, color: c.fg }}>
      {COURSE_ATTENDANCE_STATUS_LABELS[status]}
    </span>
  );
}

function SummaryPill({
  label, value, status,
}: { label: string; value: number; status?: CourseAttendanceStatus }) {
  const c = status
    ? COURSE_ATTENDANCE_STATUS_COLORS[status]
    : { bg: '#f3f4f6', fg: '#374151' };
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
  notes: { margin: '0.3rem 0 0', color: '#374151', fontSize: '0.85rem', whiteSpace: 'pre-wrap' },
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
