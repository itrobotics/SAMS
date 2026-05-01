// 講師排課清單（Task 061）
// 顯示某期間某講師被安排在哪些分校、班級上課。
// 篩選：講師 / 期間 / 狀態

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useBranches } from '../hooks/useBranches';
import { useAuth } from '../hooks/useAuth';
import { subscribeClasses } from '../services/classes';
import { subscribeInstructors } from '../services/instructors';
import { WEEKDAY_LABELS, type ClassDoc } from '../types/class';
import type { InstructorDoc } from '../types/instructor';
import {
  COURSE_PERIOD_OPTIONS,
  matchesCoursePeriod,
  type CoursePeriodPreset,
} from '../utils/coursePeriodFilter';

const ALL = '__all__';

// 取得某講師在班級中負責的時段說明
function instructorMeetings(c: ClassDoc, tid: string): string {
  const result: string[] = [];
  (c.meetings ?? []).forEach((m) => {
    const effective = m.teacherId || c.teacherId;
    if (effective === tid) {
      const room = m.classroom || c.classroom || '';
      const wd = WEEKDAY_LABELS[m.weekday] ?? `週${m.weekday}`;
      result.push(`${wd} ${m.startTime}–${m.endTime}${room ? `（${room}）` : ''}`);
    }
  });
  return result.join('、') || '—';
}

export function InstructorSchedulePage() {
  const { user } = useAuth();
  const { branches } = useBranches();
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [instructors, setInstructors] = useState<InstructorDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterInstructor, setFilterInstructor] = useState<string>(ALL);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'disabled'>('active');
  const [filterPeriod, setFilterPeriod] = useState<CoursePeriodPreset>('all');

  useEffect(() => {
    return subscribeInstructors({}, setInstructors);
  }, []);

  useEffect(() => {
    if (!user) return;
    const branchIds = user.role === 'hq_admin' ? undefined : user.branchIds;
    setLoading(true);
    const unsub = subscribeClasses(
      { branchIds },
      (list) => { setClasses(list); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  const instructorMap = useMemo(
    () => new Map(instructors.map((t) => [t.instructorId, t.name])),
    [instructors],
  );

  const rows = useMemo(() => {
    const result: Array<{ classDoc: ClassDoc; instructorId: string }> = [];

    for (const c of classes) {
      if (filterActive === 'active' && !c.active) continue;
      if (filterActive === 'disabled' && c.active) continue;
      if (!matchesCoursePeriod(filterPeriod, c.courseStartDate, c.courseEndDate)) continue;

      // 收集此班所有有效講師（先 deduplicate per instructor per class）
      const seen = new Set<string>();
      const addIfMatch = (tid: string) => {
        if (!tid || seen.has(tid)) return;
        if (filterInstructor !== ALL && tid !== filterInstructor) return;
        seen.add(tid);
        result.push({ classDoc: c, instructorId: tid });
      };

      if (c.teacherId) {
        // check if any meeting uses default
        const hasDefaultUser = (c.meetings ?? []).some((m) => !m.teacherId);
        if (hasDefaultUser) addIfMatch(c.teacherId);
      }
      (c.meetings ?? []).forEach((m) => {
        if (m.teacherId) addIfMatch(m.teacherId);
        else if (c.teacherId) addIfMatch(c.teacherId);
      });
    }
    // sort by branchId then class name
    return result.sort((a, b) => {
      const bd = a.classDoc.branchId.localeCompare(b.classDoc.branchId);
      if (bd !== 0) return bd;
      return a.classDoc.name.localeCompare(b.classDoc.name);
    });
  }, [classes, filterInstructor, filterActive, filterPeriod]);

  const branchName = (id: string) => branches.find((b) => b.branchId === id)?.name ?? id;

  return (
    <section>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>講師排課清單</h1>
          <p style={styles.subtitle}>共 {rows.length} 筆</p>
        </div>
      </header>

      <div style={styles.filterBar}>
        <select value={filterInstructor}
          onChange={(e) => setFilterInstructor(e.target.value)} style={styles.input}>
          <option value={ALL}>全部講師</option>
          {instructors.map((t) => (
            <option key={t.instructorId} value={t.instructorId}>
              {t.instructorId}-{t.name}
            </option>
          ))}
        </select>
        <select value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'disabled')}
          style={styles.input}>
          <option value="active">啟用中</option>
          <option value="disabled">已停用</option>
          <option value="all">全部狀態</option>
        </select>
        <select value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value as CoursePeriodPreset)} style={styles.input}>
          {COURSE_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>講師</th>
              <th style={styles.th}>分校</th>
              <th style={styles.th}>班級</th>
              <th style={styles.th}>課程類型</th>
              <th style={styles.th}>課程期間</th>
              <th style={styles.th}>負責時段</th>
              <th style={styles.th}>狀態</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={styles.empty}>載入中…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={styles.empty}>沒有符合條件的排課資料</td></tr>
            )}
            {rows.map(({ classDoc: c, instructorId }, i) => {
              const iname = instructorMap.get(instructorId) ?? '';
              return (
                <tr key={`${c.classId}-${instructorId}-${i}`}>
                  <td style={styles.td}>
                    <span>{iname || instructorId}</span>
                    {iname && (
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: '0.35rem' }}>
                        {instructorId}
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>{branchName(c.branchId)}</td>
                  <td style={styles.td}>
                    <Link to={`/classes/${c.classId}`}>{c.name}</Link>
                    <span style={styles.meta}> {c.classId}</span>
                  </td>
                  <td style={styles.td}>{c.courseType || '—'}</td>
                  <td style={{ ...styles.td, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {c.courseStartDate || c.courseEndDate
                      ? `${c.courseStartDate || '—'} ~ ${c.courseEndDate || '—'}`
                      : '—'}
                  </td>
                  <td style={{ ...styles.td, fontSize: '0.88rem' }}>
                    {instructorMeetings(c, instructorId)}
                  </td>
                  <td style={styles.td}>
                    <span style={c.active ? styles.pillActive : styles.pillInactive}>
                      {c.active ? '啟用' : '停用'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' },
  input: {
    padding: '0.5rem 0.7rem', fontSize: '0.95rem',
    border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', outline: 'none',
  },
  tableWrap: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' },
  th: {
    textAlign: 'left', padding: '0.7rem 0.85rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', fontWeight: 600, whiteSpace: 'nowrap',
  },
  td: { padding: '0.65rem 0.85rem', borderBottom: '1px solid #f3f4f6' },
  meta: { color: '#9ca3af', fontSize: '0.82rem' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af' },
  pillActive: { padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: '#dcfce7', color: '#166534' },
  pillInactive: { padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.8rem', background: '#f3f4f6', color: '#6b7280' },
};
