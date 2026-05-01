// 學生詳細頁（Task 014）
//
// Tab 1 - 基本資料：基本資料卡片、所屬班級、出席紀錄、人臉照片。
// Tab 2 - 就業追蹤：證照紀錄、就業狀態歷程、輔導紀錄時間軸。

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';

import { StudentEmploymentTab } from '../components/StudentEmploymentTab';
import { StudentFacePhotos } from '../components/StudentFacePhotos';
import { StudentFormDialog } from '../components/StudentFormDialog';
import { StudentLearningRecord } from '../components/StudentLearningRecord';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { db } from '../services/firebase';
import { subscribeStudentClasses } from '../services/classStudents';
import { subscribeLeaveRequestsForStudent } from '../services/leaveRequests';
import { fetchStudentSurveyHistory } from '../services/surveys';
import { canAccessBranch } from '../types/user';
import {
  PROFILE_TYPE_LABELS,
  STUDENTS_COLLECTION,
  getChildProfileView,
  getProfileType,
  type StudentDoc,
} from '../types/student';
import type { ClassStudentDoc } from '../types/classStudent';
import {
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  type LeaveRequestDoc,
} from '../types/leaveRequest';
import type { SurveyResponseDoc } from '../types/survey';

type Tab = 'profile' | 'employment';

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();
  const [student, setStudent] = useState<StudentDoc | null | 'missing'>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [enrollments, setEnrollments] = useState<ClassStudentDoc[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequestDoc[]>([]);
  const [surveyHistory, setSurveyHistory] = useState<SurveyResponseDoc[] | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, STUDENTS_COLLECTION, studentId), (snap) => {
      if (!snap.exists()) {
        setStudent('missing');
      } else {
        setStudent({ studentId: snap.id, ...(snap.data() as Omit<StudentDoc, 'studentId'>) });
      }
      setLoading(false);
    });
    return unsub;
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    const unsub = subscribeStudentClasses(studentId, setEnrollments);
    return unsub;
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    const unsub = subscribeLeaveRequestsForStudent(studentId, setLeaves);
    return unsub;
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    fetchStudentSurveyHistory(studentId).then(setSurveyHistory);
  }, [studentId]);

  if (loading) return <div style={{ color: '#6b7280' }}>載入中…</div>;
  if (student === 'missing' || !student) {
    return (
      <section>
        <h1>找不到學生</h1>
        <p>學號 <code>{studentId}</code> 不存在。</p>
        <Link to="/students">← 回學生列表</Link>
      </section>
    );
  }

  if (user && !canAccessBranch(user, student.branchId)) {
    return (
      <section>
        <h1>無權限</h1>
        <p>此學生屬於其他分校。</p>
        <Link to="/students">← 回學生列表</Link>
      </section>
    );
  }

  const branchName = branches.find((b) => b.branchId === student.branchId)?.name ?? student.branchId;
  const profileType = getProfileType(student);
  const isChild = profileType === 'child';
  const childView = isChild ? getChildProfileView(student) : null;
  const adult = student.adultProfile;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <Link to="/students" style={styles.back}>← 回列表</Link>
          <h1 style={styles.title}>{student.name}</h1>
          <p style={styles.subtitle}>
            <span style={isChild ? styles.pillChild : styles.pillAdult}>
              {PROFILE_TYPE_LABELS[profileType]}
            </span>
            {' · '}
            學號 <code>{student.studentId}</code> · {branchName}
            {isChild && ` · ${childView?.grade || '未設定年級'}`}
            {' · '}
            <span style={student.active ? styles.pillActive : styles.pillInactive}>
              {student.active ? '啟用' : '停用'}
            </span>
          </p>
        </div>
        <button type="button" style={styles.primaryBtn} onClick={() => setEditing(true)}>
          編輯
        </button>
      </header>

      {/* Tab 導覽 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
        <button
          type="button"
          style={activeTab === 'profile' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('profile')}
        >
          基本資料
        </button>
        <button
          type="button"
          style={activeTab === 'employment' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('employment')}
        >
          就業追蹤
        </button>
      </div>

      {activeTab === 'profile' && <div style={styles.grid}>
        {/* 卡片 1：基本資料（共用） */}
        <article style={styles.card}>
          <h2 style={styles.h2}>
            基本資料
            <span style={isChild ? styles.pillChild : styles.pillAdult}>
              {PROFILE_TYPE_LABELS[profileType]}
            </span>
          </h2>
          <dl style={styles.dl}>
            <DT label="姓名">{student.name}</DT>
            <DT label="學號"><code>{student.studentId}</code></DT>
            <DT label="分校">{branchName}（<code>{student.branchId}</code>）</DT>
            <DT label="性別">{student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '其他'}</DT>
            <DT label="生日">{(isChild ? student.birthday : adult?.birthDate || student.birthday) || '—'}</DT>
            <DT label="狀態">{student.active ? '啟用' : '停用'}</DT>
          </dl>
        </article>

        {/* 卡片 2：聯絡資訊（child → 家長, adult → 公司聯絡） */}
        {isChild && childView ? (
          <article style={styles.card}>
            <h2 style={styles.h2}>家長聯絡</h2>
            <dl style={styles.dl}>
              <DT label="年級">{childView.grade || '—'}</DT>
              <DT label="就讀學校">{childView.school || '—'}</DT>
              <DT label="家長 1 姓名">{childView.parent1Name || '—'}</DT>
              <DT label="家長 1 電話">{childView.parent1Phone || '—'}</DT>
              <DT label="家長 1 Email">{childView.parent1Email || '—'}</DT>
              {(childView.parent2Name || childView.parent2Phone) && (
                <>
                  <DT label="家長 2 姓名">{childView.parent2Name || '—'}</DT>
                  <DT label="家長 2 電話">{childView.parent2Phone || '—'}</DT>
                </>
              )}
            </dl>
          </article>
        ) : (
          <article style={styles.card}>
            <h2 style={styles.h2}>聯絡資訊</h2>
            <dl style={styles.dl}>
              <DT label="任職公司">{adult?.company || '—'}</DT>
              <DT label="職稱">{adult?.jobTitle || '—'}</DT>
              <DT label="手機">{adult?.mobilePhone || '—'}</DT>
              <DT label="家裡電話">{adult?.homePhone || '—'}</DT>
              <DT label="E-mail">{adult?.email || '—'}</DT>
            </dl>
          </article>
        )}

        {/* 卡片 3：學歷（adult only） */}
        {!isChild && (
          <article style={styles.card}>
            <h2 style={styles.h2}>學歷</h2>
            <dl style={styles.dl}>
              <DT label="最高學歷">{adult?.education || '—'}</DT>
              <DT label="畢業學校">{adult?.graduateSchool || '—'}</DT>
              <DT label="科系">{adult?.major || '—'}</DT>
              {adult?.idNumber && <DT label="身分證字號">{adult.idNumber}</DT>}
            </dl>
          </article>
        )}

        <article style={styles.card}>
          <h2 style={styles.h2}>所屬班級</h2>
          {enrollments.length === 0 ? (
            <p style={styles.placeholder}>尚未加入任何班級</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {enrollments.map((e) => (
                <li key={e.id} style={{ marginBottom: '0.25rem' }}>
                  <code>{e.classId}</code>
                  {!e.active && (
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                      （已退出）
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>

        <StudentLearningRecord studentId={student.studentId} />

        <article style={styles.card}>
          <h2 style={styles.h2}>請假紀錄</h2>
          {leaves.length === 0 ? (
            <p style={styles.placeholder}>尚無請假紀錄</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leaves.map((l) => {
                const c = LEAVE_STATUS_COLORS[l.status];
                return (
                  <div
                    key={l.leaveId}
                    style={{
                      padding: '0.6rem 0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      fontSize: '0.9rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong>{l.sessionDate}</strong>
                      <span style={{ padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.75rem', background: c.bg, color: c.fg }}>
                        {LEAVE_STATUS_LABELS[l.status]}
                      </span>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      {l.className} · <code>{l.sessionId}</code>
                    </div>
                    <div style={{ color: '#374151' }}>{l.reason || '（未填原因）'}</div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article style={styles.card}>
          <h2 style={styles.h2}>問卷填寫記錄</h2>
          {surveyHistory === null && (
            <p style={styles.placeholder}>載入中…</p>
          )}
          {surveyHistory !== null && surveyHistory.length === 0 && (
            <p style={styles.placeholder}>尚無問卷填寫記錄</p>
          )}
          {surveyHistory !== null && surveyHistory.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {surveyHistory.map((r) => (
                <li
                  key={r.responseId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: '0.9rem',
                  }}
                >
                  <div>
                    <code style={{ fontSize: '0.8rem', color: '#6b7280' }}>{r.sessionId}</code>
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 10,
                        fontSize: '0.75rem',
                        background: r.status === 'submitted' ? '#dcfce7' : '#f3f4f6',
                        color: r.status === 'submitted' ? '#166534' : '#6b7280',
                      }}
                    >
                      {r.status === 'submitted' ? '已填' : '待填'}
                    </span>
                  </div>
                  {r.status === 'pending' && (
                    <a
                      href={`/survey/${r.responseId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'none' }}
                    >
                      填寫 ↗
                    </a>
                  )}
                  {r.submittedAt && (
                    <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
                      {r.submittedAt.toDate().toLocaleDateString('zh-TW')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article style={styles.card}>
          <h2 style={styles.h2}>人臉照片狀態</h2>
          <StudentFacePhotos student={student} />
        </article>
      </div>}

      {/* Tab: 就業追蹤 */}
      {activeTab === 'employment' && (
        <StudentEmploymentTab studentId={student.studentId} enrollments={enrollments} />
      )}

      <StudentFormDialog
        open={editing}
        initial={student}
        onClose={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    </section>
  );
}

function DT({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={styles.dt}>{label}</dt>
      <dd style={styles.dd}>{children}</dd>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  back: { color: '#6b7280', fontSize: '0.9rem', display: 'inline-block', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  primaryBtn: {
    padding: '0.55rem 1rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  tabBar: {
    display: 'flex',
    gap: '0.25rem',
    borderBottom: '2px solid #e5e7eb',
    marginBottom: '1.25rem',
  },
  tab: {
    padding: '0.5rem 1.1rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    fontSize: '0.95rem',
    color: '#6b7280',
    cursor: 'pointer',
  },
  tabActive: {
    padding: '0.5rem 1.1rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #2563eb',
    marginBottom: -2,
    fontSize: '0.95rem',
    color: '#2563eb',
    fontWeight: 600,
    cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' },
  card: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '1.25rem',
  },
  h2: {
    margin: '0 0 0.75rem',
    fontSize: '1.05rem',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  dl: { margin: 0, display: 'grid', gridTemplateColumns: '6rem 1fr', columnGap: '0.75rem', rowGap: '0.5rem' },
  dt: { color: '#6b7280', fontSize: '0.85rem' },
  dd: { margin: 0, fontSize: '0.95rem' },
  placeholder: { color: '#9ca3af', fontSize: '0.9rem', margin: 0, fontStyle: 'italic' },
  pillActive: {
    padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#dcfce7', color: '#166534',
  },
  pillInactive: {
    padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#f3f4f6', color: '#6b7280',
  },
  pillChild: {
    padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#dbeafe', color: '#1e40af',
  },
  pillAdult: {
    padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#fef3c7', color: '#92400e',
  },
};
