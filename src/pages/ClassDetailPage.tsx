// 班級學生管理頁（Task 019, updated Task 049）
//
// 顯示班級基本資訊、目前已加入學生（active）、可加入的全分校學生候選清單。
// 加入 = setDoc with merge（idempotent，可恢復已退出的學生）；
// 移除 = active=false（軟刪），不破壞歷史出席紀錄關聯。
// F4：新增「學員分析」Tab，使用 recharts 繪製性別 / 學歷 / 科系 / 年齡分佈圖。

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

import { ClassSchedule } from '../components/ClassSchedule';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { db } from '../services/firebase';
import {
  addStudentToClass,
  removeStudentFromClass,
  subscribeClassRoster,
} from '../services/classStudents';
import { subscribeInstructors } from '../services/instructors';
import { subscribeStudents } from '../services/students';
import { canAccessBranch } from '../types/user';
import { CLASSES_COLLECTION, WEEKDAY_LABELS, type ClassDoc, type ClassMeeting } from '../types/class';
import type { ClassStudentDoc } from '../types/classStudent';
import type { InstructorDoc } from '../types/instructor';
import type { StudentDoc } from '../types/student';

// ─── 學員分析工具函式 ──────────────────────────────────────────────

function calcAge(birthday: string): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function isChild(s: StudentDoc): boolean {
  const age = calcAge(s.birthday);
  return age !== null && age < 18;
}

function genderLabel(g: string): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '未填';
}

function educationGroup(s: StudentDoc): string {
  const raw = (s.educationLevel || '').trim();
  if (raw) {
    // 正規化後直接返回
    if (['高中以下', '高中', '大學', '碩士', '博士'].includes(raw)) return raw;
    return '其他';
  }
  // 嘗試從 grade 推斷
  const g = (s.grade || '').trim();
  if (/^(幼|小一|小二|小三|小四|小五|小六|國一|國二|國三|高中|高一|高二|高三)/.test(g))
    return g.includes('高') ? '高中' : '高中以下';
  if (/大學|學士/.test(g)) return '大學';
  if (/碩士|研究所/.test(g)) return '碩士';
  if (/博士/.test(g)) return '博士';
  return '其他';
}

function ageGroup(s: StudentDoc): string {
  const age = calcAge(s.birthday);
  if (age === null) return '未填';
  if (age < 18) return '18以下';
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  return '46以上';
}

const PIE_COLORS = ['#2563eb', '#ec4899', '#9ca3af'];
const BAR_COLOR = '#2563eb';

// ─── 分析 Tab 元件 ──────────────────────────────────────────────────

function AnalysisTab({ roster, allStudents }: {
  roster: ClassStudentDoc[];
  allStudents: StudentDoc[];
}) {
  const studentById = useMemo(() => {
    const m = new Map<string, StudentDoc>();
    allStudents.forEach((s) => m.set(s.studentId, s));
    return m;
  }, [allStudents]);

  const activeStudents = useMemo(() =>
    roster
      .filter((r) => r.active)
      .map((r) => studentById.get(r.studentId))
      .filter((s): s is StudentDoc => s !== undefined),
    [roster, studentById],
  );

  const children = activeStudents.filter(isChild);
  const adults = activeStudents.filter((s) => !isChild(s));

  // 性別資料
  const genderData = useMemo(() => {
    const counts: Record<string, number> = { 男: 0, 女: 0, 未填: 0 };
    adults.forEach((s) => { counts[genderLabel(s.gender)] = (counts[genderLabel(s.gender)] ?? 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [adults]);

  // 學歷資料
  const eduOrder = ['高中以下', '高中', '大學', '碩士', '博士', '其他'];
  const educationData = useMemo(() => {
    const counts: Record<string, number> = {};
    adults.forEach((s) => {
      const g = educationGroup(s);
      counts[g] = (counts[g] ?? 0) + 1;
    });
    return eduOrder.filter((k) => counts[k]).map((k) => ({ name: k, 人數: counts[k] }));
  }, [adults]);

  // 科系資料
  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    adults.forEach((s) => {
      const d = (s.department || '').trim() || '未填';
      counts[d] = (counts[d] ?? 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5);
    const otherCount = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0);
    const result = top5.map(([name, v]) => ({ name, 人數: v }));
    if (otherCount > 0) result.push({ name: '其他', 人數: otherCount });
    return result;
  }, [adults]);

  // 年齡資料
  const ageOrder = ['18以下', '18-25', '26-35', '36-45', '46以上', '未填'];
  const ageData = useMemo(() => {
    const counts: Record<string, number> = {};
    adults.forEach((s) => {
      const g = ageGroup(s);
      counts[g] = (counts[g] ?? 0) + 1;
    });
    return ageOrder.filter((k) => counts[k]).map((k) => ({ name: k, 人數: counts[k] }));
  }, [adults]);

  if (activeStudents.length === 0) {
    return <p style={styles.placeholder}>此班尚無已加入學生。</p>;
  }

  return (
    <div>
      {children.length > 0 && (
        <div style={analysisStyles.childNote}>
          本班包含 {children.length} 位兒童學員（年齡 &lt; 18 歲，不含於成人統計）
        </div>
      )}

      <div style={analysisStyles.grid}>
        {/* 性別分佈 */}
        <div style={analysisStyles.chartCard}>
          <h3 style={analysisStyles.chartTitle}>性別分佈</h3>
          {genderData.length === 0 ? (
            <p style={styles.placeholder}>無資料</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}`}
                  labelLine={false}
                >
                  {genderData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 學歷分佈 */}
        <div style={analysisStyles.chartCard}>
          <h3 style={analysisStyles.chartTitle}>學歷分佈</h3>
          {educationData.length === 0 ? (
            <p style={styles.placeholder}>無資料（可在學生資料填入「學歷」欄位）</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={educationData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="人數" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 科系分佈 */}
        <div style={analysisStyles.chartCard}>
          <h3 style={analysisStyles.chartTitle}>科系分佈（Top 5）</h3>
          {departmentData.length === 0 || (departmentData.length === 1 && departmentData[0].name === '未填') ? (
            <p style={styles.placeholder}>無資料（可在學生資料填入「科系」欄位）</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={departmentData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                <Tooltip />
                <Bar dataKey="人數" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 年齡分佈 */}
        <div style={analysisStyles.chartCard}>
          <h3 style={analysisStyles.chartTitle}>年齡分佈</h3>
          {ageData.length === 0 ? (
            <p style={styles.placeholder}>無資料（可在學生資料填入「生日」欄位）</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="人數" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p style={{ ...styles.placeholder, marginTop: '0.5rem' }}>
        成人學員共 {adults.length} 人（出席統計不含兒童）
      </p>
    </div>
  );
}

// ─── 主頁元件 ──────────────────────────────────────────────────────

export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const { branches } = useBranches();
  const [klass, setKlass] = useState<ClassDoc | null | 'missing'>(null);
  const [roster, setRoster] = useState<ClassStudentDoc[]>([]);
  const [allStudents, setAllStudents] = useState<StudentDoc[]>([]);
  const [instructorMap, setInstructorMap] = useState<Map<string, string>>(new Map());
  const [keyword, setKeyword] = useState('');
  const [candidateBranch, setCandidateBranch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'analysis'>('roster');

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

  // 訂閱全部分校的啟用中學生（Task 049：跨分校加入）
  useEffect(() => {
    if (!klass || klass === 'missing') return;
    const unsub = subscribeStudents(
      { activeOnly: true },
      setAllStudents,
      (e) => setError(e.message),
    );
    return unsub;
  }, [klass]);

  // 訂閱講師清單以顯示姓名
  useEffect(() => {
    return subscribeInstructors({}, (list: InstructorDoc[]) => {
      setInstructorMap(new Map(list.map((t) => [t.instructorId, t.name])));
    });
  }, []);

  // 即使 class 未載入也要呼叫 hooks，否則會違反 React 的 hook 順序規則
  const activeRoster = useMemo(() => roster.filter((r) => r.active), [roster]);
  const activeRosterIds = useMemo(
    () => new Set(activeRoster.map((r) => r.studentId)),
    [activeRoster],
  );
  const candidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allStudents
      .filter((s) => !activeRosterIds.has(s.studentId))
      .filter((s) => !candidateBranch || s.branchId === candidateBranch)
      .filter((s) => {
        if (!kw) return true;
        return `${s.name} ${s.studentId}`.toLowerCase().includes(kw);
      })
      .slice(0, 50);
  }, [allStudents, activeRosterIds, keyword, candidateBranch]);
  const studentById = useMemo(() => {
    const map = new Map<string, StudentDoc>();
    allStudents.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [allStudents]);

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
            {klass.courseType ? ` · ${klass.courseType}` : ''}
            {klass.courseStartDate ? ` · ${klass.courseStartDate}` : ''}
            {klass.courseEndDate ? ` ~ ${klass.courseEndDate}` : ''}
            {klass.courseHours ? ` · ${klass.courseHours} 時數` : ''}
            {' · '}
            <span style={klass.active ? styles.pillActive : styles.pillInactive}>
              {klass.active ? '啟用' : '停用'}
            </span>
          </p>
          <ul style={meetingsListStyle}>
            {(klass.meetings ?? []).map((m, idx) => (
              <li key={idx} style={meetingsItemStyle}>
                {formatMeetingLabel(m, klass, instructorMap)}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {/* Tab 導覽 */}
      <div style={styles.tabBar}>
        <button
          type="button"
          style={activeTab === 'roster' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('roster')}
        >
          學生管理（{activeRoster.length}）
        </button>
        <button
          type="button"
          style={activeTab === 'analysis' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('analysis')}
        >
          學員分析
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <ClassSchedule classId={klass.classId} instructorMap={instructorMap} />
      </div>
    </section>
  );
}

function formatMeetingLabel(
  m: ClassMeeting,
  klass: ClassDoc,
  instructorMap: Map<string, string>,
): string {
  const weekLabel = WEEKDAY_LABELS[m.weekday] ?? `週${m.weekday}`;
  const time = `${m.startTime}–${m.endTime}`;
  const teacherId = m.teacherId || klass.teacherId;
  const classroom = m.classroom || klass.classroom;
  const parts: string[] = [];
  if (teacherId) {
    const name = instructorMap.get(teacherId);
    parts.push(`講師 ${teacherId}${name ? ` ${name}` : ''}`);
  }
  if (classroom) parts.push(`教室 ${classroom}`);
  const suffix = parts.length > 0 ? `（${parts.join(' | ')}）` : '';
  return `${weekLabel} ${time}${suffix}`;
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

const analysisStyles: Record<string, React.CSSProperties> = {
  childNote: {
    padding: '0.55rem 0.85rem',
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a',
    borderRadius: 6,
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.25rem',
    marginBottom: '1rem',
  },
  chartCard: {
    background: '#f9fafb',
    borderRadius: 8,
    padding: '1rem',
    border: '1px solid #e5e7eb',
  },
  chartTitle: {
    margin: '0 0 0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#374151',
  },
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
  tabBar: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '0',
  },
  tab: {
    padding: '0.55rem 1.1rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    fontSize: '0.95rem',
    color: '#6b7280',
    cursor: 'pointer',
    fontWeight: 500,
  },
  tabActive: {
    padding: '0.55rem 1.1rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid #2563eb',
    marginBottom: '-2px',
    fontSize: '0.95rem',
    color: '#2563eb',
    cursor: 'pointer',
    fontWeight: 600,
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
