// 班級學生管理頁（Task 019）
//
// 顯示班級基本資訊、目前已加入學生（active）、可加入的同分校學生清單。
// 加入 = setDoc with merge（idempotent，可恢復已退出的學生）；
// 移除 = active=false（軟刪），不破壞歷史出席紀錄關聯。

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';

import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { db } from '../services/firebase';
import {
  addStudentToClass,
  removeStudentFromClass,
  subscribeClassRoster,
} from '../services/classStudents';
import { subscribeStudents } from '../services/students';
import { canAccessBranch } from '../types/user';
import { CLASSES_COLLECTION, WEEKDAY_LABELS, type ClassDoc, type ClassMeeting } from '../types/class';
import type { ClassStudentDoc } from '../types/classStudent';
import type { StudentDoc } from '../types/student';

export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();
  const [klass, setKlass] = useState<ClassDoc | null | 'missing'>(null);
  const [roster, setRoster] = useState<ClassStudentDoc[]>([]);
  const [branchStudents, setBranchStudents] = useState<StudentDoc[]>([]);
  const [keyword, setKeyword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 訂閱班級資料
  useEffect(() => {
    if (!classId) return;
    const unsub = onSnapshot(doc(db, CLASSES_COLLECTION, classId), (snap) => {
      if (!snap.exists()) {
        setKlass('missing');
      } else {
        setKlass({ classId: snap.id, ...(snap.data() as Omit<ClassDoc, 'classId'>) });
      }
    });
    return unsub;
  }, [classId]);

  // 訂閱該班 roster
  useEffect(() => {
    if (!classId) return;
    const unsub = subscribeClassRoster(classId, setRoster);
    return unsub;
  }, [classId]);

  // 訂閱該分校學生（只在 class 載入後啟動）
  useEffect(() => {
    if (!klass || klass === 'missing') return;
    const unsub = subscribeStudents(
      { branchIds: [klass.branchId], activeOnly: true },
      setBranchStudents,
      (e) => setError(e.message),
    );
    return unsub;
  }, [klass]);

  // 即使 class 未載入也要呼叫 hooks，否則會違反 React 的 hook 順序規則
  const activeRoster = useMemo(() => roster.filter((r) => r.active), [roster]);
  const activeRosterIds = useMemo(
    () => new Set(activeRoster.map((r) => r.studentId)),
    [activeRoster],
  );
  const candidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return branchStudents
      .filter((s) => !activeRosterIds.has(s.studentId))
      .filter((s) => {
        if (!kw) return true;
        return `${s.name} ${s.studentId}`.toLowerCase().includes(kw);
      })
      .slice(0, 50);
  }, [branchStudents, activeRosterIds, keyword]);
  const studentById = useMemo(() => {
    const map = new Map<string, StudentDoc>();
    branchStudents.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [branchStudents]);

  if (klass === null) return <div style={{ color: '#6b7280' }}>載入中…</div>;
  if (klass === 'missing') {
    return (
      <section>
        <h1>找不到班級</h1>
        <p>班級代碼 <code>{classId}</code> 不存在。</p>
        <Link to="/classes">← 回班級列表</Link>
      </section>
    );
  }
  if (user && !canAccessBranch(user, klass.branchId)) {
    return (
      <section>
        <h1>無權限</h1>
        <p>此班級屬於其他分校。</p>
        <Link to="/classes">← 回班級列表</Link>
      </section>
    );
  }

  const branchName = branches.find((b) => b.branchId === klass.branchId)?.name ?? klass.branchId;

  async function handleAdd(s: StudentDoc) {
    if (!classId) return;
    setBusyId(s.studentId);
    try {
      await addStudentToClass({
        classId,
        studentId: s.studentId,
        branchId: s.branchId,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '加入失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(studentId: string) {
    if (!classId) return;
    if (!window.confirm('確定要從班級移除此學生？歷史出席紀錄會保留。')) return;
    setBusyId(studentId);
    try {
      await removeStudentFromClass(classId, studentId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '移除失敗');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <header style={styles.header}>
        <div>
          <Link to="/classes" style={styles.back}>← 回班級列表</Link>
          <h1 style={styles.title}>{klass.name}</h1>
          <p style={styles.subtitle}>
            <code>{klass.classId}</code> · {branchName}
            {klass.classroom ? ` · 預設教室 ${klass.classroom}` : ''}
            {klass.teacherId ? ` · 預設老師 ${klass.teacherId}` : ''}
            {' · '}
            <span style={klass.active ? styles.pillActive : styles.pillInactive}>
              {klass.active ? '啟用' : '停用'}
            </span>
          </p>
          <ul style={meetingsListStyle}>
            {(klass.meetings ?? []).map((m, idx) => (
              <li key={idx} style={meetingsItemStyle}>
                <strong>{WEEKDAY_LABELS[m.weekday] ?? `週${m.weekday}`} {m.startTime}–{m.endTime}</strong>
                {meetingOverrideSuffix(m, klass)}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.h2}>已加入學生（{activeRoster.length}）</h2>
          {activeRoster.length === 0 && (
            <p style={styles.placeholder}>還沒有學生加入此班級</p>
          )}
          <ul style={styles.list}>
            {activeRoster.map((r) => {
              const s = studentById.get(r.studentId);
              return (
                <li key={r.id} style={styles.row}>
                  <span>
                    <Link to={`/students/${r.studentId}`}>{s?.name ?? r.studentId}</Link>
                    <span style={styles.rowMeta}>
                      <code>{r.studentId}</code>
                      {s?.grade ? ` · ${s.grade}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    style={styles.removeBtn}
                    onClick={() => handleRemove(r.studentId)}
                    disabled={busyId === r.studentId}
                  >
                    {busyId === r.studentId ? '處理中…' : '移除'}
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        <article style={styles.card}>
          <h2 style={styles.h2}>可加入學生（{branchName}）</h2>
          <input
            type="search"
            placeholder="搜尋姓名 / 學號"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={styles.search}
          />
          {candidates.length === 0 && (
            <p style={styles.placeholder}>找不到符合條件的學生</p>
          )}
          <ul style={styles.list}>
            {candidates.map((s) => (
              <li key={s.studentId} style={styles.row}>
                <span>
                  {s.name}
                  <span style={styles.rowMeta}>
                    <code>{s.studentId}</code>{s.grade ? ` · ${s.grade}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  style={styles.addBtn}
                  onClick={() => handleAdd(s)}
                  disabled={busyId === s.studentId}
                >
                  {busyId === s.studentId ? '處理中…' : '＋ 加入'}
                </button>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function meetingOverrideSuffix(m: ClassMeeting, klass: ClassDoc): string {
  const parts: string[] = [];
  if (m.classroom && m.classroom !== klass.classroom) parts.push(`教室 ${m.classroom}`);
  if (m.teacherId && m.teacherId !== klass.teacherId) parts.push(`老師 ${m.teacherId}`);
  return parts.length === 0 ? '' : `（${parts.join('、')}）`;
}

const meetingsListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0.6rem 0 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const meetingsItemStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: '#374151',
};

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '1.5rem' },
  back: { color: '#6b7280', fontSize: '0.9rem', display: 'inline-block', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  pillActive: { padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#dcfce7', color: '#166534' },
  pillInactive: { padding: '0.1rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', background: '#f3f4f6', color: '#6b7280' },
  error: {
    padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, marginBottom: '1rem',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' },
  card: {
    background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', padding: '1.25rem',
  },
  h2: { margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#374151' },
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
  placeholder: { color: '#9ca3af', fontSize: '0.9rem', margin: '0.5rem 0', fontStyle: 'italic' },
};
