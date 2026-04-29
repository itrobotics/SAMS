// Kiosk session selector（Task 031 + 課程方案延伸）
//
// Kiosk 啟動前要先選定「比對哪些場次的學生」。同一時段可能有多班同時上課，
// 因此採多選；預設勾選「目前進行中或即將開始」的 sessions：
//   - 進行中：start - openBefore <= now <= end + closeAfter
//   - 即將開始：start - openBefore <= now < start
//
// 課程方案場次也納入清單，與班級場次並列。selection set 用前綴區分：
//   - `class:${sessionId}` 班級場次
//   - `course:${courseSessionId}` 課程方案場次

import { useMemo } from 'react';

import {
  useBranchDayCourseSessionsRealtime,
  useBranchDaySessionsRealtime,
} from '../hooks/useRealtime';
import { todayISO, timeToMinutes } from '../utils/date';
import type { SessionDoc } from '../types/session';
import type { CourseSessionDoc } from '../types/courseSession';

interface KioskSessionSelectorProps {
  branchId: string;
  selected: Set<string>; // 'class:xxx' | 'course:xxx'
  onToggle: (sessionKey: string) => void;
  onConfirm: () => void;
}

const DEFAULT_OPEN_BEFORE = 30;
const DEFAULT_CLOSE_AFTER = 60;

export function classKey(sessionId: string): string {
  return `class:${sessionId}`;
}
export function courseKey(courseSessionId: string): string {
  return `course:${courseSessionId}`;
}
export function parseKey(k: string): { type: 'class' | 'course'; id: string } | null {
  if (k.startsWith('class:')) return { type: 'class', id: k.slice(6) };
  if (k.startsWith('course:')) return { type: 'course', id: k.slice(7) };
  return null;
}

export function KioskSessionSelector({
  branchId, selected, onToggle, onConfirm,
}: KioskSessionSelectorProps) {
  const today = todayISO();
  const { data: sessions, loading } = useBranchDaySessionsRealtime(branchId, today);
  const { data: courseSessions, loading: courseLoading } =
    useBranchDayCourseSessionsRealtime(branchId, today);

  const inWindow = useMemo(() => {
    const nowMin = nowMinutes();
    return (s: { startTime: string; endTime: string }) => {
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);
      return nowMin >= start - DEFAULT_OPEN_BEFORE && nowMin <= end + DEFAULT_CLOSE_AFTER;
    };
  }, []);

  const canStart = selected.size > 0;
  const isLoading = loading || courseLoading;
  const noSessions = !isLoading && sessions.length === 0 && courseSessions.length === 0;

  return (
    <div style={styles.panel}>
      <h2 style={styles.title}>選擇比對場次</h2>
      <p style={styles.subtitle}>
        Kiosk 只會比對「已勾選場次的應到學生」— 預設已勾選目前進行中或即將開始的場次。
      </p>

      {isLoading && <div style={styles.empty}>載入今日場次…</div>}
      {noSessions && (
        <div style={styles.empty}>
          <p style={{ marginBottom: '0.4rem' }}>查無場次</p>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 0.85rem' }}>
            <code style={styles.queryCode}>branchId={branchId}</code>
            {' · '}
            <code style={styles.queryCode}>date={today}</code>
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            班級：請至「設定 → 每日場次產生」建立。<br />
            課程方案：請至「課程方案 → 單元」對某個 slot 點「開啟報到」。
          </p>
          <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.85rem' }}>
            若場次的日期 / 分校與上方條件不一致，將不會出現於此清單。
          </p>
        </div>
      )}

      {!noSessions && !isLoading && (
        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sessions.length > 0 && (
            <SessionGroup label="班級今日場次">
              {sessions.map((s) => (
                <ClassRow
                  key={s.sessionId}
                  session={s}
                  active={inWindow(s)}
                  isChecked={selected.has(classKey(s.sessionId))}
                  onToggle={() => onToggle(classKey(s.sessionId))}
                />
              ))}
            </SessionGroup>
          )}

          {courseSessions.length > 0 && (
            <SessionGroup label="課程方案今日場次">
              {courseSessions.map((s) => (
                <CourseRow
                  key={s.courseSessionId}
                  session={s}
                  active={inWindow(s)}
                  isChecked={selected.has(courseKey(s.courseSessionId))}
                  onToggle={() => onToggle(courseKey(s.courseSessionId))}
                />
              ))}
            </SessionGroup>
          )}
        </div>
      )}

      <button
        type="button"
        style={{
          ...styles.startBtn,
          ...(canStart ? null : styles.startBtnDisabled),
        }}
        disabled={!canStart}
        onClick={onConfirm}
      >
        {canStart ? `開始報到（${selected.size} 個場次）` : '請至少勾選一個場次'}
      </button>
    </div>
  );
}

function SessionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={styles.groupTitle}>{label}</h3>
      <ul style={styles.list}>{children}</ul>
    </div>
  );
}

function ClassRow({
  session, active, isChecked, onToggle,
}: {
  session: SessionDoc;
  active: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      style={{ ...styles.row, ...(isChecked ? styles.rowSelected : null) }}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        style={styles.checkbox}
      />
      <div style={styles.rowMain}>
        <div style={styles.rowTitle}>{session.className}</div>
        <div style={styles.rowMeta}>
          {session.startTime}–{session.endTime}
          {session.classroom ? ` · 教室 ${session.classroom}` : ''}
          {session.teacherId ? ` · 講師 ${session.teacherId}` : ''}
        </div>
      </div>
      {active && <span style={styles.activeBadge}>進行中</span>}
    </li>
  );
}

function CourseRow({
  session, active, isChecked, onToggle,
}: {
  session: CourseSessionDoc;
  active: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      style={{ ...styles.row, ...(isChecked ? styles.rowSelected : null) }}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        style={styles.checkbox}
      />
      <div style={styles.rowMain}>
        <div style={styles.rowTitle}>
          <code style={{ fontSize: '0.95rem' }}>{session.courseSessionId}</code>
          <span style={{ marginLeft: '0.5rem', color: '#cbd5e1' }}>
            {session.courseId}{session.moduleId ? ` · ${session.moduleId}` : ''}
          </span>
        </div>
        <div style={styles.rowMeta}>
          {session.startTime}–{session.endTime}
          {session.classroom ? ` · 教室 ${session.classroom}` : ''}
          {session.instructorId ? ` · 講師 ${session.instructorId}` : ''}
        </div>
      </div>
      {active && <span style={styles.activeBadge}>進行中</span>}
    </li>
  );
}

// 提供給上層計算「進行中」清單，用來預設勾選
export function defaultSelectedSessionKeys(
  sessions: SessionDoc[],
  courseSessions: CourseSessionDoc[],
  openBefore = DEFAULT_OPEN_BEFORE,
  closeAfter = DEFAULT_CLOSE_AFTER,
): Set<string> {
  const nowMin = nowMinutes();
  const result = new Set<string>();
  for (const s of sessions) {
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);
    if (nowMin >= start - openBefore && nowMin <= end + closeAfter) {
      result.add(classKey(s.sessionId));
    }
  }
  for (const s of courseSessions) {
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);
    if (nowMin >= start - openBefore && nowMin <= end + closeAfter) {
      result.add(courseKey(s.courseSessionId));
    }
  }
  return result;
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#1e293b',
    color: '#f1f5f9',
    padding: '2rem 2.5rem',
    borderRadius: 16,
    width: 'min(560px, 92vw)',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
  },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: '1.25rem' },
  empty: { padding: '2rem', textAlign: 'center', color: '#cbd5e1' },
  queryCode: {
    background: '#0f172a', padding: '0.1rem 0.4rem', borderRadius: 4,
    fontSize: '0.78rem', color: '#cbd5e1',
  },
  groupTitle: {
    margin: '0 0 0.4rem', fontSize: '0.85rem', color: '#94a3b8',
    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  list: {
    listStyle: 'none', padding: 0, margin: 0,
    border: '1px solid #334155', borderRadius: 8,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.75rem 1rem', borderBottom: '1px solid #334155',
    cursor: 'pointer', transition: 'background 0.15s',
  },
  rowSelected: { background: '#1d4ed8' },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: '1rem', fontWeight: 500 },
  rowMeta: { color: '#cbd5e1', fontSize: '0.85rem', marginTop: '0.2rem' },
  activeBadge: {
    padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.75rem',
    background: '#16a34a', color: '#fff',
  },
  checkbox: { width: 18, height: 18, accentColor: '#2563eb' },
  startBtn: {
    marginTop: '1.25rem',
    padding: '0.85rem 1.5rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: '1.05rem', fontWeight: 600,
  },
  startBtnDisabled: { background: '#334155', color: '#94a3b8', cursor: 'not-allowed' },
};
