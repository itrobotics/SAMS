// Kiosk session selector（Task 031）
//
// Kiosk 啟動前要先選定「比對哪些場次的學生」。同一時段可能有多班同時上課，
// 因此採多選；預設勾選「目前進行中或即將開始」的 sessions：
//   - 進行中：start - openBefore <= now <= end + closeAfter
//   - 即將開始：start - openBefore <= now < start
//
// openBefore / closeAfter 預設 30/60 分（spec / settings 預設值）。
// 沒有 sessions 時提示去設定頁產生。

import { useMemo } from 'react';

import { useBranchDaySessionsRealtime } from '../hooks/useRealtime';
import { todayISO, timeToMinutes } from '../utils/date';
import type { SessionDoc } from '../types/session';

interface KioskSessionSelectorProps {
  branchId: string;
  selected: Set<string>; // sessionId set
  onToggle: (sessionId: string) => void;
  onConfirm: () => void;
}

const DEFAULT_OPEN_BEFORE = 30;
const DEFAULT_CLOSE_AFTER = 60;

export function KioskSessionSelector({
  branchId, selected, onToggle, onConfirm,
}: KioskSessionSelectorProps) {
  const today = todayISO();
  const { data: sessions, loading } = useBranchDaySessionsRealtime(branchId, today);

  const inWindow = useMemo(() => {
    const nowMin = nowMinutes();
    return (s: SessionDoc) => {
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);
      return nowMin >= start - DEFAULT_OPEN_BEFORE && nowMin <= end + DEFAULT_CLOSE_AFTER;
    };
  }, []);

  // 預設勾選：第一次渲染時，把符合 inWindow 的 sessionId 自動勾起來
  // （不在這裡寫 setState；交給上層管理 selected。為了避免無限 re-render，
  //  上層會在 sessions 第一次載入後同步 inWindow 結果到 selected）

  const canStart = selected.size > 0;

  return (
    <div style={styles.panel}>
      <h2 style={styles.title}>選擇比對場次</h2>
      <p style={styles.subtitle}>
        Kiosk 只會比對「已勾選場次的應到學生」— 預設已勾選目前進行中或即將開始的班級。
      </p>

      {loading && <div style={styles.empty}>載入今日場次…</div>}
      {!loading && sessions.length === 0 && (
        <div style={styles.empty}>
          <p>今日 {today} 尚無場次。</p>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            請至「設定 → 每日場次產生」建立後再回來。
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        <ul style={styles.list}>
          {sessions.map((s) => {
            const active = inWindow(s);
            const isChecked = selected.has(s.sessionId);
            return (
              <li
                key={s.sessionId}
                style={{ ...styles.row, ...(isChecked ? styles.rowSelected : null) }}
                onClick={() => onToggle(s.sessionId)}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(s.sessionId)}
                  onClick={(e) => e.stopPropagation()}
                  style={styles.checkbox}
                />
                <div style={styles.rowMain}>
                  <div style={styles.rowTitle}>{s.className}</div>
                  <div style={styles.rowMeta}>
                    {s.startTime}–{s.endTime}
                    {s.classroom ? ` · 教室 ${s.classroom}` : ''}
                    {s.teacherId ? ` · 老師 ${s.teacherId}` : ''}
                  </div>
                </div>
                {active && <span style={styles.activeBadge}>進行中</span>}
              </li>
            );
          })}
        </ul>
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

// 提供給上層計算「進行中」清單，用來預設勾選
export function defaultSelectedSessionIds(
  sessions: SessionDoc[],
  openBefore = DEFAULT_OPEN_BEFORE,
  closeAfter = DEFAULT_CLOSE_AFTER,
): Set<string> {
  const nowMin = nowMinutes();
  return new Set(
    sessions
      .filter((s) => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        return nowMin >= start - openBefore && nowMin <= end + closeAfter;
      })
      .map((s) => s.sessionId),
  );
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
  list: {
    listStyle: 'none', padding: 0, margin: 0, overflow: 'auto', flex: 1,
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
