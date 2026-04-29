// 系統設定頁（Task 023 + 後續 Task 054/055）
//
// 目前 MVP 用途：手動觸發「產生今日場次」。
// Phase 14 會改為各分校可調整的 settings collection（graceMinutes 等）。

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import {
  generateSessionsForDate,
  type GenerationSummary,
} from '../services/sessionGenerator';
import { fetchBranchSettings, saveBranchSettings } from '../services/settings';
import { DEFAULT_BRANCH_SETTINGS } from '../types/settings';
import { todayISO } from '../utils/date';

const ALL = '__all__';

export function SettingsPage() {
  const { user } = useAuth();
  const { branches } = useBranches(true);
  const isHQ = user?.role === 'hq_admin';
  const [date, setDate] = useState(todayISO());
  const [branchId, setBranchId] = useState<string>(ALL);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branchOptions = useMemo(
    () => (isHQ ? branches : branches.filter((b) => user?.branchIds.includes(b.branchId))),
    [branches, user, isHQ],
  );

  // 遲到寬限設定
  const [graceBranchId, setGraceBranchId] = useState<string>('');
  const [graceMinutes, setGraceMinutes] = useState<number>(DEFAULT_BRANCH_SETTINGS.graceMinutes);
  const [graceSaving, setGraceSaving] = useState(false);
  const [graceSaved, setGraceSaved] = useState(false);
  const [graceError, setGraceError] = useState<string | null>(null);

  useEffect(() => {
    if (branchOptions.length > 0 && !graceBranchId) {
      setGraceBranchId(branchOptions[0].branchId);
    }
  }, [branchOptions, graceBranchId]);

  useEffect(() => {
    if (!graceBranchId) return;
    fetchBranchSettings(graceBranchId).then((s) => setGraceMinutes(s.graceMinutes));
    setGraceSaved(false);
    setGraceError(null);
  }, [graceBranchId]);

  async function handleSaveGrace() {
    if (!graceBranchId) return;
    setGraceSaving(true);
    setGraceError(null);
    setGraceSaved(false);
    try {
      await saveBranchSettings(graceBranchId, { graceMinutes });
      setGraceSaved(true);
    } catch (e) {
      setGraceError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setGraceSaving(false);
    }
  }

  async function handleGenerate() {
    setRunning(true);
    setError(null);
    setSummary(null);
    try {
      const target = new Date(`${date}T12:00:00`);
      if (Number.isNaN(target.getTime())) {
        setError('日期格式錯誤');
        return;
      }
      const result = await generateSessionsForDate({
        date: target,
        branchId: branchId === ALL ? undefined : branchId,
      });
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '產生失敗');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section>
      <header style={styles.header}>
        <h1 style={styles.title}>系統設定</h1>
      </header>

      <article style={styles.card}>
        <h2 style={styles.h2}>每日場次產生</h2>
        <p style={styles.help}>
          依「上課日 weekday」與「啟用中班級」的設定，建立指定日期的場次與應到名單。
          重複執行不會覆蓋已報到狀態。
        </p>

        <div style={styles.formRow}>
          <label style={styles.field}>
            <span style={styles.label}>日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={running}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>分校範圍</span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={running}
              style={styles.input}
            >
              <option value={ALL}>{isHQ ? '全部分校' : '我的所有分校'}</option>
              {branchOptions.map((b) => (
                <option key={b.branchId} value={b.branchId}>{b.name}</option>
              ))}
            </select>
          </label>
          <button type="button" style={styles.btn} onClick={handleGenerate} disabled={running}>
            {running ? '產生中…' : '產生場次'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {summary && (
          <div style={styles.summary}>
            <h3 style={{ margin: '0 0 0.4rem' }}>結果（{summary.date} 週{summary.weekday}）</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              <li>處理班級數：{summary.classesProcessed}</li>
              <li>新建場次：{summary.sessionsCreated}（已存在 {summary.sessionsExisting}）</li>
              <li>新建應到名單：{summary.recordsCreated} 筆（已存在 {summary.recordsExisting}）</li>
              {summary.errors.length > 0 && (
                <li style={{ color: '#b91c1c' }}>
                  錯誤：
                  <ul>
                    {summary.errors.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </li>
              )}
            </ul>
          </div>
        )}
      </article>

      <article style={{ ...styles.card, marginTop: '1.5rem' }}>
        <h2 style={styles.h2}>遲到寬限設定</h2>
        <p style={styles.help}>
          上課開始後幾分鐘內報到仍視為「準時」；超過則自動標記為「遲到」。
        </p>
        <div style={styles.formRow}>
          {branchOptions.length > 1 && (
            <label style={styles.field}>
              <span style={styles.label}>分校</span>
              <select
                value={graceBranchId}
                onChange={(e) => setGraceBranchId(e.target.value)}
                disabled={graceSaving}
                style={styles.input}
              >
                {branchOptions.map((b) => (
                  <option key={b.branchId} value={b.branchId}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          <label style={styles.field}>
            <span style={styles.label}>寬限分鐘數</span>
            <input
              type="number"
              min={0}
              max={60}
              value={graceMinutes}
              onChange={(e) => { setGraceMinutes(Number(e.target.value)); setGraceSaved(false); }}
              disabled={graceSaving}
              style={{ ...styles.input, width: 80 }}
            />
          </label>
          <button type="button" style={styles.btn} onClick={handleSaveGrace} disabled={graceSaving}>
            {graceSaving ? '儲存中…' : '儲存'}
          </button>
          {graceSaved && <span style={{ color: '#166534', fontSize: '0.9rem', alignSelf: 'center' }}>已儲存</span>}
        </div>
        {graceError && <div style={styles.error}>{graceError}</div>}
      </article>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '1.5rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem', maxWidth: 720 },
  card: {
    background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '1.5rem', maxWidth: 720,
  },
  h2: { margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#374151' },
  help: { color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1rem' },
  formRow: { display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  label: { fontSize: '0.85rem', color: '#374151' },
  input: {
    padding: '0.5rem 0.7rem', fontSize: '0.95rem',
    border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', outline: 'none',
  },
  btn: {
    padding: '0.55rem 1.1rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600,
  },
  error: {
    marginTop: '1rem',
    padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.9rem',
  },
  summary: {
    marginTop: '1rem',
    padding: '0.75rem 1rem', background: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.9rem',
  },
};
