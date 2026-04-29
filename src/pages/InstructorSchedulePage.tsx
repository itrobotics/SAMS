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

const ALL = '__all__';

type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'lastMonth' | 'nextMonth' | 'custom';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getPresetRange(preset: PeriodPreset): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (preset === 'today') {
    const s = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { from: s, to: s };
  }
  if (preset === 'week') {
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now); mon.setDate(d - dow);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
  }
  if (preset === 'month') {
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    return { from, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
  }
  if (preset === 'lastMonth') {
    const lm = m === 0 ? 11 : m - 1;
    const ly = m === 0 ? y - 1 : y;
    const last = new Date(ly, lm + 1, 0).getDate();
    return { from: `${ly}-${String(lm + 1).padStart(2, '0')}-01`, to: `${ly}-${String(lm + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
  }
  if (preset === 'nextMonth') {
    const nm = m === 11 ? 0 : m + 1;
    const ny = m === 11 ? y + 1 : y;
    const last = new Date(ny, nm + 1, 0).getDate();
    return { from: `${ny}-${String(nm + 1).padStart(2, '0')}-01`, to: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
  }
  return null;
}

function overlapsPeriod(c: ClassDoc, from: string, to: string): boolean {
  const s = c.courseStartDate;
  const e = c.courseEndDate;
  if (!s && !e) return true;
  if (s && e) return s <= to && e >= from;
  if (s && !e) return s <= to;
  if (!s && e) return e >= from;
  return true;
}

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
  const [filterPeriod, setFilterPeriod] = useState<PeriodPreset>('all');
  const [filterFrom, setFilterFrom] = useState(todayStr());
  const [filterTo, setFilterTo] = useState(todayStr());

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
    const presetRange = filterPeriod !== 'custom' && filterPeriod !== 'all'
      ? getPresetRange(filterPeriod) : null;
    const rangeFrom = filterPeriod === 'custom' ? filterFrom : presetRange?.from ?? '';
    const rangeTo = filterPeriod === 'custom' ? filterTo : presetRange?.to ?? '';

    const result: Array<{ classDoc: ClassDoc; instructorId: string }> = [];

    for (const c of classes) {
      if (filterActive === 'active' && !c.active) continue;
      if (filterActive === 'disabled' && c.active) continue;
      if (filterPeriod !== 'all' && rangeFrom && rangeTo) {
        if (!overlapsPeriod(c, rangeFrom, rangeTo)) continue;
      }

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
  }, [classes, filterInstructor, filterActive, filterPeriod, filterFrom, filterTo]);

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
          onChange={(e) => setFilterPeriod(e.target.value as PeriodPreset)} style={styles.input}>
          <option value="all">全部期間</option>
          <option value="today">今日</option>
          <option value="week">本週</option>
          <option value="month">本月</option>
          <option value="lastMonth">上月</option>
          <option value="nextMonth">下月</option>
          <option value="custom">自訂期間</option>
        </select>
        {filterPeriod === 'custom' && (
          <>
            <input type="date" value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)} style={styles.input} />
            <span style={{ alignSelf: 'center', color: '#6b7280' }}>~</span>
            <input type="date" value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)} style={styles.input} />
          </>
        )}
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
                    <strong>{instructorId}</strong>
                    {iname ? <span style={styles.meta}> {iname}</span> : null}
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
