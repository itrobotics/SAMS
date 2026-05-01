// 就業追蹤總覽頁（/employment-tracking）
//
// 列出所有課程方案的就業追蹤摘要，可篩選課程。
// 顯示尚未追蹤的學員（最後追蹤日期超過 30 天）。

import { useEffect, useMemo, useState } from 'react';

import { subscribeClassRoster } from '../services/classStudents';
import { subscribeClasses } from '../services/classes';
import {
  subscribeAllEmploymentStatuses,
  subscribeEmploymentStatusesByCourse,
} from '../services/employmentTracking';
import { subscribeStudents } from '../services/students';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { EMPLOYMENT_STATUS_LABELS, type EmploymentStatus } from '../types/employmentTracking';
import type { ClassDoc } from '../types/class';
import type { ClassStudentDoc } from '../types/classStudent';
import type { StudentDoc } from '../types/student';

const STALE_DAYS = 30;

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function EmploymentTrackingPage() {
  const { user } = useAuth();
  const { branches } = useBranches();

  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [allStatuses, setAllStatuses] = useState<EmploymentStatus[]>([]);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [filterCourse, setFilterCourse] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseRoster, setCourseRoster] = useState<ClassStudentDoc[]>([]);
  const [courseStatuses, setCourseStatuses] = useState<EmploymentStatus[]>([]);

  // Subscribe to all classes
  useEffect(() => {
    const branchIds = user?.role === 'hq_admin' ? undefined : user?.branchIds;
    return subscribeClasses(
      { branchIds: branchIds && branchIds.length > 0 ? branchIds : undefined, activeOnly: true },
      setClasses,
    );
  }, [user]);

  // Subscribe to all employment statuses
  useEffect(() => {
    return subscribeAllEmploymentStatuses(setAllStatuses);
  }, []);

  // Subscribe to students for name lookup
  useEffect(() => {
    return subscribeStudents({ activeOnly: false }, setStudents);
  }, []);

  // When selected course changes, subscribe to its roster and statuses
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseRoster([]);
      setCourseStatuses([]);
      return;
    }
    const unsubRoster = subscribeClassRoster(selectedCourseId, setCourseRoster);
    const unsubStatuses = subscribeEmploymentStatusesByCourse(selectedCourseId, setCourseStatuses);
    return () => {
      unsubRoster();
      unsubStatuses();
    };
  }, [selectedCourseId]);

  const studentById = useMemo(() => {
    const map = new Map<string, StudentDoc>();
    students.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [students]);

  // Compute per-course summary from allStatuses
  const courseSummaryMap = useMemo(() => {
    const latestByStudentByCourse = new Map<string, Map<string, EmploymentStatus>>();
    for (const s of allStatuses) {
      if (!latestByStudentByCourse.has(s.courseId)) {
        latestByStudentByCourse.set(s.courseId, new Map());
      }
      const map = latestByStudentByCourse.get(s.courseId)!;
      if (!map.has(s.studentId)) {
        map.set(s.studentId, s);
      }
    }
    const result = new Map<string, { tracked: number; employed: number; latestDate: string }>();
    for (const [courseId, studentMap] of latestByStudentByCourse.entries()) {
      const statuses = Array.from(studentMap.values());
      const employed = statuses.filter(
        (s) => s.status === 'employed' || s.status === 'self_employed',
      ).length;
      const latestDate = statuses.reduce(
        (best, s) => (s.trackedAt > best ? s.trackedAt : best),
        '',
      );
      result.set(courseId, { tracked: statuses.length, employed, latestDate });
    }
    return result;
  }, [allStatuses]);

  // Compute untracked students for selected course
  const untrackedStudents = useMemo(() => {
    if (!selectedCourseId) return [];
    const now = new Date();
    const activeRosterIds = courseRoster.filter((r) => r.active).map((r) => r.studentId);

    // Latest tracked date per student in this course
    const latestByStudent = new Map<string, string>();
    for (const s of courseStatuses) {
      const current = latestByStudent.get(s.studentId);
      if (!current || s.trackedAt > current) {
        latestByStudent.set(s.studentId, s.trackedAt);
      }
    }

    return activeRosterIds.filter((sid) => {
      const lastTracked = latestByStudent.get(sid);
      if (!lastTracked) return true; // never tracked
      return daysBetween(lastTracked, now) > STALE_DAYS;
    });
  }, [selectedCourseId, courseRoster, courseStatuses]);

  // Filtered classes for the table
  const filteredClasses = useMemo(() => {
    if (!filterCourse) return classes;
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(filterCourse.toLowerCase()) ||
        c.classId.toLowerCase().includes(filterCourse.toLowerCase()),
    );
  }, [classes, filterCourse]);

  const selectedClass = classes.find((c) => c.classId === selectedCourseId);

  return (
    <section>
      <header style={headerStyle}>
        <h1 style={titleStyle}>就業追蹤總覽</h1>
        <input
          type="search"
          placeholder="篩選課程名稱 / 代碼"
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
          style={searchStyle}
        />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: selectedCourseId ? '1fr 1fr' : '1fr', gap: '1rem' }}>
        {/* Left: course list table */}
        <article style={cardStyle}>
          <h2 style={h2Style}>課程列表（{filteredClasses.length}）</h2>
          {filteredClasses.length === 0 ? (
            <p style={placeholderStyle}>找不到符合的課程</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['課程', '分校', '已追蹤', '就業率', '最後更新', ''].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((c) => {
                  const summary = courseSummaryMap.get(c.classId);
                  const rate = summary && summary.tracked > 0
                    ? Math.round((summary.employed / summary.tracked) * 100)
                    : null;
                  const branchName = branches.find((b) => b.branchId === c.branchId)?.name ?? c.branchId;
                  return (
                    <tr
                      key={c.classId}
                      style={selectedCourseId === c.classId ? selectedRowStyle : rowStyle}
                      onClick={() =>
                        setSelectedCourseId(selectedCourseId === c.classId ? null : c.classId)
                      }
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
                          <code>{c.classId}</code>
                        </div>
                      </td>
                      <td style={tdStyle}>{branchName}</td>
                      <td style={tdStyle}>
                        {summary ? `${summary.tracked} 人` : '—'}
                      </td>
                      <td style={tdStyle}>
                        {rate !== null ? (
                          <span style={rate >= 70 ? goodRateStyle : lowRateStyle}>
                            {rate}%
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.82rem' }}>
                        {summary?.latestDate || '—'}
                      </td>
                      <td style={tdStyle}>
                        <button
                          style={detailBtnStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourseId(selectedCourseId === c.classId ? null : c.classId);
                          }}
                        >
                          {selectedCourseId === c.classId ? '收起' : '展開'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </article>

        {/* Right: untracked students for selected course */}
        {selectedCourseId && (
          <article style={cardStyle}>
            <h2 style={h2Style}>
              {selectedClass?.name ?? selectedCourseId}
              {' '}— 未追蹤學員
            </h2>
            <p style={{ ...placeholderStyle, marginBottom: '0.75rem' }}>
              未追蹤 = 從未填寫，或最後追蹤日期超過 {STALE_DAYS} 天
            </p>
            {untrackedStudents.length === 0 ? (
              <p style={{ color: '#166534', fontSize: '0.9rem' }}>
                全班學員均已追蹤（{STALE_DAYS} 天內）
              </p>
            ) : (
              <>
                <p style={{ margin: '0 0 0.5rem', color: '#b91c1c', fontSize: '0.9rem' }}>
                  共 {untrackedStudents.length} 位學員需要追蹤
                </p>
                <ul style={untrackedListStyle}>
                  {untrackedStudents.map((sid) => {
                    const s = studentById.get(sid);
                    // Last tracked date for this student in this course
                    const lastTracked = courseStatuses
                      .filter((st) => st.studentId === sid)
                      .sort((a, b) => b.trackedAt.localeCompare(a.trackedAt))[0]?.trackedAt;
                    const days = lastTracked ? daysBetween(lastTracked, new Date()) : null;
                    return (
                      <li key={sid} style={untrackedItemStyle}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{s?.name ?? sid}</span>
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                            <code>{sid}</code>
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#b91c1c' }}>
                          {days === null ? '從未追蹤' : `${days} 天前`}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Last known status for each untracked student */}
                {courseStatuses.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ ...placeholderStyle, marginBottom: '0.5rem' }}>最後狀態</p>
                    {untrackedStudents.map((sid) => {
                      const lastStatus = courseStatuses
                        .filter((st) => st.studentId === sid)
                        .sort((a, b) => b.trackedAt.localeCompare(a.trackedAt))[0];
                      if (!lastStatus) return null;
                      const s = studentById.get(sid);
                      return (
                        <div key={sid} style={lastStatusRowStyle}>
                          <span style={{ fontWeight: 500 }}>{s?.name ?? sid}</span>
                          <span style={statusPillStyle(lastStatus.status)}>
                            {EMPLOYMENT_STATUS_LABELS[lastStatus.status]}
                          </span>
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                            {lastStatus.trackedAt}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </article>
        )}
      </div>
    </section>
  );
}

function statusPillStyle(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    employed: { background: '#dcfce7', color: '#166534' },
    self_employed: { background: '#d1fae5', color: '#065f46' },
    unemployed: { background: '#fee2e2', color: '#991b1b' },
    studying: { background: '#dbeafe', color: '#1d4ed8' },
    other: { background: '#f3f4f6', color: '#6b7280' },
  };
  return {
    padding: '0.1rem 0.5rem',
    borderRadius: 10,
    fontSize: '0.8rem',
    ...(map[status] ?? map.other),
  };
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.25rem',
  flexWrap: 'wrap',
  gap: '0.75rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.5rem',
};

const searchStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.9rem',
  width: 220,
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  padding: '1.25rem',
};

const h2Style: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1.05rem',
  color: '#374151',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.5rem',
  color: '#6b7280',
  fontSize: '0.8rem',
  fontWeight: 600,
  borderBottom: '1px solid #e5e7eb',
};

const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.5rem',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
};

const rowStyle: React.CSSProperties = {
  cursor: 'pointer',
};

const selectedRowStyle: React.CSSProperties = {
  cursor: 'pointer',
  background: '#eff6ff',
};

const goodRateStyle: React.CSSProperties = {
  padding: '0.1rem 0.5rem',
  background: '#dcfce7',
  color: '#166534',
  borderRadius: 10,
  fontSize: '0.85rem',
};

const lowRateStyle: React.CSSProperties = {
  padding: '0.1rem 0.5rem',
  background: '#fef9c3',
  color: '#854d0e',
  borderRadius: 10,
  fontSize: '0.85rem',
};

const detailBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const placeholderStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '0.85rem',
  margin: 0,
  fontStyle: 'italic',
};

const untrackedListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const untrackedItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.4rem 0.6rem',
  background: '#fff7ed',
  borderRadius: 5,
  border: '1px solid #fed7aa',
};

const lastStatusRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  padding: '0.3rem 0',
  borderBottom: '1px solid #f3f4f6',
  fontSize: '0.88rem',
};
