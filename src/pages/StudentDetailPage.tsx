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
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { db } from '../services/firebase';
import { subscribeStudentClasses } from '../services/classStudents';
import { canAccessBranch } from '../types/user';
import { STUDENTS_COLLECTION, type StudentDoc } from '../types/student';
import type { ClassStudentDoc } from '../types/classStudent';

type Tab = 'profile' | 'employment';

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();
  const [student, setStudent] = useState<StudentDoc | null | 'missing'>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [enrollments, setEnrollments] = useState<ClassStudentDoc[]>([]);
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

  return (
    <section>
      <header style={styles.header}>
        <div>
          <Link to="/students" style={styles.back}>← 回列表</Link>
          <h1 style={styles.title}>{student.name}</h1>
          <p style={styles.subtitle}>
            學號 <code>{student.studentId}</code> · {branchName} · {student.grade || '未設定年級'}
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

      {/* Tab navigation */}
      <div style={styles.tabBar}>
        {([
          { key: 'profile', label: '基本資料' },
          { key: 'employment', label: '就業追蹤' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            style={activeTab === key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: 基本資料 */}
      {activeTab === 'profile' && (
        <div style={styles.grid}>
          <article style={styles.card}>
            <h2 style={styles.h2}>基本資料</h2>
            <dl style={styles.dl}>
              <DT label="姓名">{student.name}</DT>
              <DT label="學號"><code>{student.studentId}</code></DT>
              <DT label="年級">{student.grade || '—'}</DT>
              <DT label="分校">{branchName}（<code>{student.branchId}</code>）</DT>
              <DT label="家長姓名">{student.parentName || '—'}</DT>
              <DT label="家長電話">{student.parentPhone || '—'}</DT>
              <DT label="狀態">{student.active ? '啟用' : '停用'}</DT>
            </dl>
          </article>

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

          <article style={styles.card}>
            <h2 style={styles.h2}>最近出席紀錄</h2>
            <p style={styles.placeholder}>
              出席紀錄（attendance_records）將於 Phase 5 / Task 021 後顯示。
            </p>
          </article>

          <article style={styles.card}>
            <h2 style={styles.h2}>人臉照片狀態</h2>
            <StudentFacePhotos student={student} />
          </article>
        </div>
      )}

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
  h2: { margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#374151' },
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
};
