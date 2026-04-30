// 課程方案場次出席管理頁
//
// /courses/:courseId/sessions/:courseSessionId
// 列出本場次所有 course_attendance；老師可逐位切「應到 / 已到 / 遲到 / 請假 / 未到」。
// 頂部提供「標記為已完成」/「標記為取消」按鈕，狀態為 'completed' 才會計入課程方案實際時數。

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
import { updateCourseSession } from '../services/courseSessions';
import { fetchCourse } from '../services/courses';
import { fetchCourseModule } from '../services/courseModules';
import { fetchInstructor } from '../services/instructors';
import { ROUTES } from '../routes/paths';
import { formatTimeWithSec } from '../utils/date';
import { canAccessBranch } from '../types/user';
import {
  COURSE_SESSIONS_COLLECTION,
  COURSE_SESSION_STATUS_LABELS,
  type CourseSessionDoc,
  type CourseSessionStatus,
} from '../types/courseSession';
import type { CourseDoc } from '../types/course';
import type { CourseModuleDoc } from '../types/courseModule';
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

  // 顯示用的 metadata（從 session 上的 ID 一次撈出來）
  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [module, setModule] = useState<CourseModuleDoc | null>(null);
  const [instructorName, setInstructorName] = useState<string | null>(null);

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

  // 撈 course / module / instructor 用以顯示完整名稱
  useEffect(() => {
    if (!session || session === 'missing') return;
    fetchCourse(session.courseId).then(setCourse).catch(() => {});
    if (session.moduleId) {
      fetchCourseModule(session.moduleId).then(setModule).catch(() => {});
    } else {
      setModule(null);
    }
    if (session.instructorId) {
      fetchInstructor(session.instructorId)
        .then((i) => setInstructorName(i?.name ?? null))
        .catch(() => {});
    } else {
      setInstructorName(null);
    }
  }, [session]);

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

  async function setSessionStatus(target: CourseSessionStatus) {
    if (!courseSessionId) return;
    const labels: Record<CourseSessionStatus, string> = {
      scheduled: '待上課',
      completed: '已完成',
      cancelled: '已取消',
    };
    if (!window.confirm(`將本場次狀態改為「${labels[target]}」？\n${target === 'completed' ? '時數會計入課程方案實際時數。' : ''}`)) return;
    setBusyId('__session__');
    try {
      await updateCourseSession(courseSessionId, { status: target });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const acc: Record<CourseAttendanceStatus, number> = {
      SCHEDULED: 0, CHECKED_IN: 0, LATE: 0, LEAVE: 0, ABSENT: 0,
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
  const courseDisplay = course?.name ?? session.courseId;
  const moduleDisplay = module?.name ?? session.moduleId;
  const instructorLabel = session.instructorId
    ? (instructorName ? `${session.instructorId}-${instructorName}` : session.instructorId)
    : null;

  return (
    <section>
      <header style={styles.header}>
        <div style={{ flex: 1 }}>
          <Link to={ROUTES.courseDetail(session.courseId)} style={styles.back}>
            ← 回課程方案
          </Link>
          <h1 style={styles.title}>
            {courseDisplay}
            <code style={styles.idInline}>{session.courseId}</code>
          </h1>
          {session.moduleId && (
            <p style={styles.moduleLine}>
              {moduleDisplay}
              <code style={styles.idInline}>{session.moduleId}</code>
              {instructorLabel && <span style={{ marginLeft: '0.5rem' }}>講師 {instructorLabel}</span>}
            </p>
          )}
          <p style={styles.subtitle}>
            {branchName} · {session.date} · {session.startTime}–{session.endTime}
            {' · 時數 '}{session.hours}
            {session.classroom ? ` · 教室 ${session.classroom}` : ''}
            {!session.moduleId && instructorLabel ? ` · 講師 ${instructorLabel}` : ''}
            {' · '}<code>{session.courseSessionId}</code>
            {' · '}<SessionStatusPill status={session.status} />
          </p>
          {session.notes && (
            <p style={styles.notes}>備註：{session.notes}</p>
          )}
        </div>
        <div style={styles.statusActions}>
          <SessionStatusBtn
            label="標記為已完成"
            primary
            disabled={busyId === '__session__' || session.status === 'completed'}
            onClick={() => setSessionStatus('completed')}
          />
          <SessionStatusBtn
            label="標記為取消"
            disabled={busyId === '__session__' || session.status === 'cancelled'}
            onClick={() => setSessionStatus('cancelled')}
          />
          {session.status !== 'scheduled' && (
            <SessionStatusBtn
              label="重設為待上課"
              disabled={busyId === '__session__'}
              onClick={() => setSessionStatus('scheduled')}
            />
          )}
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.summary}>
        <SummaryPill label="應到" value={records.length} />
        <SummaryPill label="已到" value={counts.CHECKED_IN + counts.LATE} status="CHECKED_IN" />
        <SummaryPill label="遲到" value={counts.LATE} status="LATE" />
        <SummaryPill label="請假" value={counts.LEAVE} status="LEAVE" />
        <SummaryPill label="未到" value={counts.ABSENT + counts.SCHEDULED} status="ABSENT" />
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
      {COURSE_ATTENDANCE_STATUSES.map((s) => {
        // SCHEDULED 是「重設」用的按鈕：已經是 SCHEDULED 時不必再點
        const isCurrent = record.status === s;
        const isReset = s === 'SCHEDULED';
        return (
          <ActionBtn
            key={s}
            label={isReset ? '重設' : COURSE_ATTENDANCE_STATUS_LABELS[s]}
            active={isCurrent}
            accent={COURSE_ATTENDANCE_STATUS_COLORS[s].fg}
            disabled={busy || (isReset && isCurrent)}
            onClick={() => onSet(record, s)}
          />
        );
      })}
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

function SessionStatusPill({ status }: { status: CourseSessionStatus }) {
  const map: Record<CourseSessionStatus, { bg: string; fg: string }> = {
    scheduled: { bg: '#dbeafe', fg: '#1e40af' },
    completed: { bg: '#dcfce7', fg: '#166534' },
    cancelled: { bg: '#fee2e2', fg: '#b91c1c' },
  };
  const c = map[status];
  return (
    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: c.bg, color: c.fg }}>
      {COURSE_SESSION_STATUS_LABELS[status]}
    </span>
  );
}

function SessionStatusBtn({
  label, primary, disabled, onClick,
}: { label: string; primary?: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.4rem 0.85rem',
        fontSize: '0.85rem',
        borderRadius: 6,
        border: primary ? 'none' : '1px solid #d1d5db',
        background: primary ? '#16a34a' : '#fff',
        color: primary ? '#fff' : '#374151',
        fontWeight: primary ? 600 : 400,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
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
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap',
  },
  statusActions: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'flex-start',
  },
  back: { color: '#6b7280', fontSize: '0.9rem', display: 'inline-block', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  moduleLine: {
    margin: '0.25rem 0 0', fontSize: '1rem', color: '#374151',
  },
  idInline: {
    marginLeft: '0.45rem', padding: '0.05rem 0.45rem',
    background: '#f3f4f6', borderRadius: 4,
    color: '#6b7280', fontSize: '0.75rem', fontWeight: 400,
  },
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
