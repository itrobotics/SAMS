// 課程方案詳情頁
//
// 四個區塊：基本資訊 + 單元列表 + 學員名單（左右兩欄加入/移除）+ 場次列表

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';

import { CourseModuleFormDialog } from '../components/CourseModuleFormDialog';
import { CourseSessionFormDialog } from '../components/CourseSessionFormDialog';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { db } from '../services/firebase';
import { deleteCourseDeep } from '../services/courses';
import {
  deleteCourseModule,
  fetchModuleActualHours,
  subscribeCourseModules,
} from '../services/courseModules';
import {
  deleteCourseSession,
  subscribeCourseSessions,
} from '../services/courseSessions';
import {
  addStudentToCourse,
  removeStudentFromCourse,
  setEnrollmentStatus,
  subscribeCourseEnrollments,
} from '../services/courseEnrollments';
import { subscribeInstructors } from '../services/instructors';
import { subscribeStudents } from '../services/students';
import { ROUTES } from '../routes/paths';
import { canAccessBranch } from '../types/user';
import {
  COURSES_COLLECTION,
  COURSE_STATUS_LABELS,
  type CourseDoc,
} from '../types/course';
import type { CourseModuleDoc } from '../types/courseModule';
import type { CourseSessionDoc } from '../types/courseSession';
import { COURSE_SESSION_STATUS_LABELS } from '../types/courseSession';
import {
  COURSE_ENROLLMENT_STATUS_LABELS,
  type CourseEnrollmentDoc,
  type CourseEnrollmentStatus,
} from '../types/courseEnrollment';
import type { InstructorDoc } from '../types/instructor';
import type { StudentDoc } from '../types/student';

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();

  const [course, setCourse] = useState<CourseDoc | null | 'missing'>(null);
  const [modules, setModules] = useState<CourseModuleDoc[]>([]);
  const [sessions, setSessions] = useState<CourseSessionDoc[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollmentDoc[]>([]);
  const [allStudents, setAllStudents] = useState<StudentDoc[]>([]);
  const [instructorMap, setInstructorMap] = useState<Map<string, string>>(new Map());
  const [moduleActualHours, setModuleActualHours] = useState<Map<string, number>>(new Map());

  const [keyword, setKeyword] = useState('');
  const [candidateBranch, setCandidateBranch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [moduleEditing, setModuleEditing] = useState<CourseModuleDoc | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [sessionEditing, setSessionEditing] = useState<CourseSessionDoc | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);

  // 訂閱 course
  useEffect(() => {
    if (!courseId) return;
    const unsub = onSnapshot(doc(db, COURSES_COLLECTION, courseId), (snap) => {
      if (!snap.exists()) {
        setCourse('missing');
      } else {
        setCourse({ courseId: snap.id, ...(snap.data() as Omit<CourseDoc, 'courseId'>) });
      }
    });
    return unsub;
  }, [courseId]);

  // 訂閱 modules / sessions / enrollments
  useEffect(() => {
    if (!courseId) return;
    const u1 = subscribeCourseModules(courseId, setModules);
    const u2 = subscribeCourseSessions(courseId, setSessions);
    const u3 = subscribeCourseEnrollments(courseId, setEnrollments);
    return () => { u1(); u2(); u3(); };
  }, [courseId]);

  // 訂閱所有啟用學生（給加入用）
  useEffect(() => {
    if (!course || course === 'missing') return;
    const unsub = subscribeStudents(
      { activeOnly: true },
      setAllStudents,
      (e) => setError(e.message),
    );
    return unsub;
  }, [course]);

  useEffect(() => {
    return subscribeInstructors({}, (list: InstructorDoc[]) => {
      setInstructorMap(new Map(list.map((t) => [t.instructorId, t.name])));
    });
  }, []);

  // 計算每個 module 已完成時數（每次 sessions 變動就重算 — 直接用 sessions state 算就好）
  useEffect(() => {
    const totals = new Map<string, number>();
    for (const s of sessions) {
      if (s.status !== 'completed') continue;
      if (!s.moduleId) continue;
      totals.set(s.moduleId, (totals.get(s.moduleId) ?? 0) + (Number(s.hours) || 0));
    }
    setModuleActualHours(totals);
  }, [sessions]);

  // 即使 course 未載入也要呼叫 hooks
  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'active'),
    [enrollments],
  );
  const activeIds = useMemo(
    () => new Set(activeEnrollments.map((e) => e.studentId)),
    [activeEnrollments],
  );
  const candidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allStudents
      .filter((s) => !activeIds.has(s.studentId))
      .filter((s) => !candidateBranch || s.branchId === candidateBranch)
      .filter((s) => {
        if (!kw) return true;
        return `${s.name} ${s.studentId}`.toLowerCase().includes(kw);
      })
      .slice(0, 50);
  }, [allStudents, activeIds, keyword, candidateBranch]);
  const studentById = useMemo(() => {
    const map = new Map<string, StudentDoc>();
    allStudents.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [allStudents]);

  const totalActual = useMemo(() => {
    let sum = 0;
    for (const s of sessions) if (s.status === 'completed') sum += Number(s.hours) || 0;
    return sum;
  }, [sessions]);

  if (course === null) return <div style={{ color: '#6b7280' }}>載入中…</div>;
  if (course === 'missing') {
    return (
      <section>
        <h1>找不到課程方案</h1>
        <p>課程代碼 <code>{courseId}</code> 不存在。</p>
        <Link to={ROUTES.courses}>← 回課程方案列表</Link>
      </section>
    );
  }
  if (user && !canAccessBranch(user, course.branchId)) {
    return (
      <section>
        <h1>無權限</h1>
        <p>此課程方案屬於其他分校。</p>
        <Link to={ROUTES.courses}>← 回課程方案列表</Link>
      </section>
    );
  }

  const branchName = branches.find((b) => b.branchId === course.branchId)?.name ?? course.branchId;
  const planned = course.totalPlannedHours || 0;
  const pct = planned > 0 ? Math.min(100, Math.round((totalActual / planned) * 100)) : 0;
  const canEdit = user?.role !== 'teacher';

  async function handleAddStudent(s: StudentDoc) {
    if (!courseId || !course || course === 'missing') return;
    setBusyId(s.studentId);
    try {
      await addStudentToCourse({
        courseId,
        branchId: course.branchId,
        studentId: s.studentId,
        studentName: s.name,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '加入失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveStudent(studentId: string) {
    if (!courseId) return;
    if (!window.confirm('確定要將此學員從課程方案移除？')) return;
    setBusyId(studentId);
    try {
      await removeStudentFromCourse(courseId, studentId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '移除失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function handleEnrollmentStatus(studentId: string, status: CourseEnrollmentStatus) {
    if (!courseId) return;
    setBusyId(studentId);
    try {
      await setEnrollmentStatus(courseId, studentId, status);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteModule(m: CourseModuleDoc) {
    if (!window.confirm(`確定要停用單元「${m.name}」？已建立的場次仍會保留。`)) return;
    setBusyId(m.moduleId);
    try {
      await deleteCourseModule(m.moduleId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteSession(s: CourseSessionDoc) {
    if (!window.confirm(`確定刪除場次（${s.date} ${s.startTime}）？\n此操作無法復原，出席紀錄將一併刪除。`)) return;
    setBusyId(s.courseSessionId);
    try {
      await deleteCourseSession(s.courseSessionId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '刪除失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteCourse() {
    if (!course || course === 'missing' || !courseId) return;
    if (!window.confirm(`確定要永久刪除課程方案「${course.name}」？\n所有單元、場次、學員、出席紀錄都會一併刪除，無法復原。`)) return;
    setBusyId('__course__');
    try {
      await deleteCourseDeep(courseId);
      window.location.href = ROUTES.courses;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '刪除失敗');
    } finally {
      setBusyId(null);
    }
  }

  function instructorLabel(id: string): string {
    if (!id) return '—';
    const name = instructorMap.get(id);
    return name ? `${id} ${name}` : id;
  }

  // 一次性 refresh module actual hours（給 child save 時可呼叫）
  async function refreshModuleHours() {
    if (!courseId) return;
    try {
      setModuleActualHours(await fetchModuleActualHours(courseId));
    } catch { /* ignore */ }
  }

  return (
    <section>
      <header style={styles.header}>
        <div>
          <Link to={ROUTES.courses} style={styles.back}>← 回課程方案列表</Link>
          <h1 style={styles.title}>{course.name}</h1>
          <p style={styles.subtitle}>
            <code>{course.courseId}</code> · {branchName}
            {' · '}
            <span style={{ color: '#374151' }}>{COURSE_STATUS_LABELS[course.status]}</span>
            {!course.active && (
              <span style={{ marginLeft: '0.4rem', color: '#b91c1c' }}>（已停用）</span>
            )}
          </p>
          <p style={styles.metaLine}>
            {course.startDate || course.endDate
              ? `${course.startDate || '—'} ~ ${course.endDate || '—'}`
              : '未設定期間'}
            {course.defaultInstructorId && ` · 預設講師 ${instructorLabel(course.defaultInstructorId)}`}
            {course.defaultClassroom && ` · 預設教室 ${course.defaultClassroom}`}
          </p>
          <div style={styles.progressBox}>
            <span style={styles.progressLabel}>
              已完成 <b>{totalActual}</b> / 計畫 <b>{planned}</b> 小時
            </span>
            <div style={styles.progressTrack}>
              <div style={{
                ...styles.progressFill,
                width: `${pct}%`,
                background: pct >= 100 ? '#16a34a' : '#2563eb',
              }} />
            </div>
            <span style={styles.progressPct}>{pct}%</span>
          </div>
          {course.description && (
            <p style={styles.description}>{course.description}</p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            style={styles.dangerBtn}
            onClick={handleDeleteCourse}
            disabled={busyId === '__course__'}
          >
            {busyId === '__course__' ? '刪除中…' : '刪除整個課程方案'}
          </button>
        )}
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {/* === 單元列表 === */}
      <article style={styles.card}>
        <header style={styles.cardHeader}>
          <h2 style={styles.h2}>課程單元（{modules.filter((m) => m.active).length}）</h2>
          {canEdit && (
            <button type="button" style={styles.smallPrimaryBtn}
              onClick={() => { setModuleEditing(null); setModuleDialogOpen(true); }}>
              ＋ 新增單元
            </button>
          )}
        </header>
        {modules.length === 0 ? (
          <p style={styles.placeholder}>還沒有單元</p>
        ) : (
          <table style={styles.subTable}>
            <thead>
              <tr>
                <th style={styles.subTh}>排序</th>
                <th style={styles.subTh}>代碼</th>
                <th style={styles.subTh}>名稱</th>
                <th style={styles.subThNum}>計畫時數</th>
                <th style={styles.subThNum}>已完成</th>
                <th style={styles.subTh}>狀態</th>
                <th style={styles.subTh}>操作</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.moduleId}>
                  <td style={styles.subTd}>{m.order ?? 0}</td>
                  <td style={styles.subTd}><code>{m.moduleId}</code></td>
                  <td style={styles.subTd}>{m.name}</td>
                  <td style={styles.subTdNum}>{m.plannedHours}</td>
                  <td style={styles.subTdNum}>{moduleActualHours.get(m.moduleId) ?? 0}</td>
                  <td style={styles.subTd}>
                    <span style={m.active ? styles.pillActive : styles.pillInactive}>
                      {m.active ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td style={styles.subTd}>
                    {canEdit && (
                      <>
                        <button type="button" style={styles.linkBtn}
                          onClick={() => { setModuleEditing(m); setModuleDialogOpen(true); }}>
                          編輯
                        </button>
                        {m.active && (
                          <button
                            type="button"
                            style={{ ...styles.linkBtn, color: '#b91c1c' }}
                            onClick={() => handleDeleteModule(m)}
                            disabled={busyId === m.moduleId}
                          >
                            停用
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      {/* === 學員名單（左右兩欄）=== */}
      <div style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.h2}>已加入學員（{activeEnrollments.length}）</h2>
          {activeEnrollments.length === 0 && (
            <p style={styles.placeholder}>還沒有學員</p>
          )}
          <ul style={styles.list}>
            {activeEnrollments.map((en) => {
              const s = studentById.get(en.studentId);
              return (
                <li key={en.enrollmentId} style={styles.row}>
                  <span>
                    <Link to={`/students/${en.studentId}`}>{en.studentName}</Link>
                    <span style={styles.rowMeta}>
                      <code>{en.studentId}</code>
                      {s?.grade ? ` · ${s.grade}` : ''}
                    </span>
                  </span>
                  {canEdit && (
                    <span style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        type="button"
                        style={styles.linkBtn}
                        onClick={() => handleEnrollmentStatus(en.studentId, 'completed')}
                        disabled={busyId === en.studentId}
                      >
                        標記完成
                      </button>
                      <button
                        type="button"
                        style={styles.removeBtn}
                        onClick={() => handleRemoveStudent(en.studentId)}
                        disabled={busyId === en.studentId}
                      >
                        {busyId === en.studentId ? '處理中…' : '移除'}
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* 已退訓 / 已完成 學員 */}
          {enrollments.some((e) => e.status !== 'active') && (
            <details style={{ marginTop: '0.75rem' }}>
              <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
                已退訓 / 已完成（{enrollments.filter((e) => e.status !== 'active').length}）
              </summary>
              <ul style={styles.list}>
                {enrollments
                  .filter((e) => e.status !== 'active')
                  .map((en) => (
                    <li key={en.enrollmentId} style={styles.row}>
                      <span>
                        <Link to={`/students/${en.studentId}`}>{en.studentName}</Link>
                        <span style={styles.rowMeta}>
                          <code>{en.studentId}</code> · {COURSE_ENROLLMENT_STATUS_LABELS[en.status]}
                        </span>
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          style={styles.linkBtn}
                          onClick={() => handleEnrollmentStatus(en.studentId, 'active')}
                          disabled={busyId === en.studentId}
                        >
                          重新加入
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </article>

        <article style={styles.card}>
          <h2 style={styles.h2}>可加入學員（全分校）</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <select
              value={candidateBranch}
              onChange={(e) => setCandidateBranch(e.target.value)}
              style={{ ...styles.search, margin: 0, flex: 1 }}
            >
              <option value="">全部分校</option>
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>{b.name}</option>
              ))}
            </select>
            <input
              type="search"
              placeholder="搜尋姓名 / 學號"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ ...styles.search, margin: 0, flex: 2 }}
            />
          </div>
          {candidates.length === 0 && (
            <p style={styles.placeholder}>找不到符合條件的學生</p>
          )}
          <ul style={styles.list}>
            {candidates.map((s) => {
              const sBranchName = branches.find((b) => b.branchId === s.branchId)?.name ?? s.branchId;
              return (
                <li key={s.studentId} style={styles.row}>
                  <span>
                    {s.name}
                    <span style={styles.rowMeta}>
                      <code>{s.studentId}</code>{s.grade ? ` · ${s.grade}` : ''}
                      {' · '}{sBranchName}
                    </span>
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      style={styles.addBtn}
                      onClick={() => handleAddStudent(s)}
                      disabled={busyId === s.studentId}
                    >
                      {busyId === s.studentId ? '處理中…' : '＋ 加入'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      {/* === 場次列表 === */}
      <article style={styles.card}>
        <header style={styles.cardHeader}>
          <h2 style={styles.h2}>排定場次（{sessions.length}）</h2>
          {canEdit && (
            <button type="button" style={styles.smallPrimaryBtn}
              onClick={() => { setSessionEditing(null); setSessionDialogOpen(true); }}>
              ＋ 新增場次
            </button>
          )}
        </header>
        {sessions.length === 0 ? (
          <p style={styles.placeholder}>還沒有場次</p>
        ) : (
          <table style={styles.subTable}>
            <thead>
              <tr>
                <th style={styles.subTh}>日期</th>
                <th style={styles.subTh}>時間</th>
                <th style={styles.subThNum}>時數</th>
                <th style={styles.subTh}>單元</th>
                <th style={styles.subTh}>講師</th>
                <th style={styles.subTh}>教室</th>
                <th style={styles.subTh}>狀態</th>
                <th style={styles.subTh}>操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const m = modules.find((mm) => mm.moduleId === s.moduleId);
                return (
                  <tr key={s.courseSessionId}>
                    <td style={styles.subTd}>{s.date}</td>
                    <td style={styles.subTd}>{s.startTime}–{s.endTime}</td>
                    <td style={styles.subTdNum}>{s.hours}</td>
                    <td style={styles.subTd}>{m?.name ?? '—'}</td>
                    <td style={styles.subTd}>{instructorLabel(s.instructorId)}</td>
                    <td style={styles.subTd}>{s.classroom || '—'}</td>
                    <td style={styles.subTd}>
                      <CourseSessionStatusPill status={s.status} />
                    </td>
                    <td style={styles.subTd}>
                      <Link to={ROUTES.courseSession(courseId!, s.courseSessionId)} style={styles.linkBtn}>
                        進入報到 →
                      </Link>
                      {canEdit && (
                        <>
                          <button type="button" style={styles.linkBtn}
                            onClick={() => { setSessionEditing(s); setSessionDialogOpen(true); }}>
                            編輯
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.linkBtn, color: '#b91c1c' }}
                            onClick={() => handleDeleteSession(s)}
                            disabled={busyId === s.courseSessionId}
                          >
                            {busyId === s.courseSessionId ? '刪除中…' : '刪除'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </article>

      <CourseModuleFormDialog
        open={moduleDialogOpen}
        initial={moduleEditing}
        courseId={courseId!}
        branchId={course.branchId}
        defaultOrder={modules.length}
        onClose={() => setModuleDialogOpen(false)}
        onSaved={() => { /* realtime listener 自動更新 */ }}
      />

      <CourseSessionFormDialog
        open={sessionDialogOpen}
        initial={sessionEditing}
        courseId={courseId!}
        branchId={course.branchId}
        modules={modules.filter((m) => m.active)}
        defaults={{
          instructorId: course.defaultInstructorId,
          classroom: course.defaultClassroom,
        }}
        onClose={() => setSessionDialogOpen(false)}
        onSaved={() => { void refreshModuleHours(); }}
      />
    </section>
  );
}

function CourseSessionStatusPill({ status }: { status: CourseSessionDoc['status'] }) {
  const map = {
    scheduled: { bg: '#f3f4f6', fg: '#6b7280' },
    completed: { bg: '#dcfce7', fg: '#166534' },
    cancelled: { bg: '#fee2e2', fg: '#b91c1c' },
  } as const;
  const c = map[status];
  return (
    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: c.bg, color: c.fg }}>
      {COURSE_SESSION_STATUS_LABELS[status]}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap',
  },
  back: { color: '#6b7280', fontSize: '0.9rem', display: 'inline-block', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  metaLine: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.85rem' },
  description: { margin: '0.5rem 0 0', color: '#374151', fontSize: '0.9rem', whiteSpace: 'pre-wrap' },
  progressBox: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    margin: '0.65rem 0 0', maxWidth: 460,
  },
  progressLabel: { fontSize: '0.85rem', color: '#374151', whiteSpace: 'nowrap' },
  progressTrack: {
    flex: 1, height: 10, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressPct: { fontSize: '0.85rem', color: '#374151', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' },

  error: {
    padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, marginBottom: '1rem',
  },
  card: {
    background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '1.25rem', marginBottom: '1rem',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '0.75rem',
  },
  h2: { margin: 0, fontSize: '1.05rem', color: '#374151' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  search: {
    width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem',
    border: '1px solid #d1d5db', borderRadius: 6, marginBottom: '0.75rem', outline: 'none',
  },
  list: { listStyle: 'none', padding: 0, margin: 0, maxHeight: 460, overflow: 'auto' },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.95rem',
  },
  rowMeta: { color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.5rem' },
  addBtn: {
    padding: '0.3rem 0.7rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: '0.85rem',
  },
  removeBtn: {
    padding: '0.3rem 0.7rem', background: '#fff', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.85rem',
  },
  linkBtn: {
    padding: '0.2rem 0.5rem', background: 'transparent', color: '#2563eb',
    border: 'none', fontSize: '0.85rem', marginRight: '0.25rem',
  },
  smallPrimaryBtn: {
    padding: '0.4rem 0.85rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600,
  },
  dangerBtn: {
    padding: '0.45rem 0.85rem', background: '#fff', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.85rem',
  },
  placeholder: { color: '#9ca3af', fontSize: '0.9rem', margin: '0.5rem 0', fontStyle: 'italic' },

  pillActive: { padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#dcfce7', color: '#166534' },
  pillInactive: { padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#f3f4f6', color: '#6b7280' },

  subTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  subTh: {
    textAlign: 'left', padding: '0.55rem 0.7rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600, whiteSpace: 'nowrap',
  },
  subThNum: {
    textAlign: 'right', padding: '0.55rem 0.7rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600, whiteSpace: 'nowrap',
  },
  subTd: { padding: '0.5rem 0.7rem', borderBottom: '1px solid #f3f4f6' },
  subTdNum: { padding: '0.5rem 0.7rem', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
};
