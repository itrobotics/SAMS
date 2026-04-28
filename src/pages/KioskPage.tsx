// Kiosk 自助報到頁（Task 029）
//
// /kiosk/:branchId
// 全螢幕、無 AppLayout（在 AppRouter 用 <AuthGuard withLayout={false}>）。
//
// 狀態機（spec 規格 7 個狀態）：
//   IDLE          → 待機（請站到鏡頭前）
//   READY         → 攝影機就緒、辨識迴圈運作中
//   SCANNING      → 偵測到臉、計算 embedding
//   CONFIRMING    → 中信心值（spec 規格 7-4），等老師按鈕
//   SUCCESS       → 報到成功，顯示姓名 + 時間（3 秒後回 IDLE）
//   FAILED        → 信心值不足或無臉，提示請老師協助
//   MANUAL        → 老師接手手動搜尋（Task 040 實作）
//
// 本任務只實作 state machine + 各狀態的 UI；攝影機接 Task 030、辨識接 Task 036。

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  KioskSessionSelector,
  defaultSelectedSessionIds,
} from '../components/KioskSessionSelector';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { useKioskCheckin } from '../hooks/useKioskCheckin';
import {
  useBranchDayAttendanceRealtime,
  useBranchDaySessionsRealtime,
} from '../hooks/useRealtime';
import { useWebcam } from '../hooks/useWebcam';
import { ROUTES } from '../routes/paths';
import { subscribeBranchSettings } from '../services/settings';
import { DEFAULT_BRANCH_SETTINGS, type BranchSettings } from '../types/settings';
import { formatTimeWithSec, todayISO } from '../utils/date';

export type KioskState =
  | 'IDLE'
  | 'READY'
  | 'SCANNING'
  | 'CONFIRMING'
  | 'SUCCESS'
  | 'FAILED'
  | 'MANUAL';

export interface KioskMatch {
  studentId: string;
  studentName: string;
  confidence: number;
  recordedAt: Date;
}

export function KioskPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const { branches } = useBranches();
  const { user } = useAuth();
  const branchName = branches.find((b) => b.branchId === branchId)?.name ?? branchId;

  // 暫時的 demo 狀態 — Task 036 會把 setState 接上實際事件
  const [state, setState] = useState<KioskState>('IDLE');
  const [match, setMatch] = useState<KioskMatch | null>(null);
  const [now, setNow] = useState(new Date());

  // 已勾選的場次（Task 031）
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const today = todayISO();
  const todaySessionsRT = useBranchDaySessionsRealtime(branchId, today);

  // 第一次載入完成、selected 還是空時，自動勾選「進行中」場次
  useEffect(() => {
    if (todaySessionsRT.loading) return;
    if (selectedSessions.size > 0) return;
    const defaults = defaultSelectedSessionIds(todaySessionsRT.data);
    if (defaults.size > 0) setSelectedSessions(defaults);
  }, [todaySessionsRT.loading, todaySessionsRT.data, selectedSessions.size]);

  function toggleSession(sessionId: string) {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function startKiosk() {
    if (selectedSessions.size === 0) return;
    setState('READY');
  }

  // 攝影機只有在已選定 session（IDLE 之後）才開啟，避免一打開頁面就要權限
  const cameraEnabled = state !== 'IDLE';
  const webcam = useWebcam({ enabled: cameraEnabled, width: 1280, height: 720 });

  // 訂閱分校設定（取 graceMinutes — 報到時間判定）
  const [settings, setSettings] = useState<BranchSettings | null>(null);
  useEffect(() => {
    if (!branchId) return;
    const unsub = subscribeBranchSettings(branchId, setSettings);
    return unsub;
  }, [branchId]);

  // 訂閱今日所有 attendance_records（給辨識迴圈算「比對範圍學生」用）
  const attendanceRT = useBranchDayAttendanceRealtime(branchId, today);

  // 啟動辨識 loop（READY 狀態時運作）
  const checkin = useKioskCheckin({
    enabled: state === 'READY' || state === 'SCANNING',
    webcam,
    branchId: branchId ?? '',
    selectedSessions,
    todaySessions: todaySessionsRT.data,
    attendanceForToday: attendanceRT.data,
    setKioskState: setState,
    setMatch,
    graceMinutes: settings?.graceMinutes ?? DEFAULT_BRANCH_SETTINGS.graceMinutes,
    autoPassThreshold: settings?.faceAutoPassThreshold ?? DEFAULT_BRANCH_SETTINGS.faceAutoPassThreshold,
    confirmThreshold: settings?.faceConfirmThreshold ?? DEFAULT_BRANCH_SETTINGS.faceConfirmThreshold,
    operatorId: user?.userId ?? null,
  });

  // 大時鐘
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // SUCCESS 顯示 3 秒後回 IDLE
  useEffect(() => {
    if (state !== 'SUCCESS' && state !== 'FAILED') return;
    const t = setTimeout(() => {
      setState('READY');
      setMatch(null);
    }, state === 'SUCCESS' ? 3000 : 4000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div style={styles.shell}>
      {/* 上方狀態列 */}
      <header style={styles.topbar}>
        <div>
          <span style={styles.brand}>SAMS Kiosk</span>
          <span style={styles.branchName}>{branchName}</span>
        </div>
        <div style={styles.clock}>{formatTimeWithSec(now)}</div>
        <Link to={ROUTES.branches} style={styles.exitBtn}>
          結束
        </Link>
      </header>

      {/* 主畫面：依 state 渲染 */}
      <main style={styles.main}>
        {state === 'IDLE' ? (
          <div style={styles.center}>
            {branchId && (
              <KioskSessionSelector
                branchId={branchId}
                selected={selectedSessions}
                onToggle={toggleSession}
                onConfirm={startKiosk}
              />
            )}
          </div>
        ) : (
          <Stage
            state={state}
            match={match}
            now={now}
            webcam={webcam}
            selectedCount={selectedSessions.size}
            modelLoading={checkin.modelLoading}
            modelError={checkin.modelError}
          />
        )}
      </main>

      {/* 狀態列：上次掃描時間 + 比對範圍 */}
      <footer style={styles.statusBar}>
        <span style={styles.statusItem}>
          場次：{selectedSessions.size}
        </span>
        <span style={styles.statusItem}>
          {checkin.modelLoading ? '模型載入中…' : checkin.modelLoaded ? '模型 ✓' : '模型未載入'}
        </span>
        <span style={styles.statusItem}>
          上次掃描：{checkin.lastScanAt ? formatTimeWithSec(checkin.lastScanAt) : '—'}
        </span>
      </footer>
    </div>
  );
}

function Stage({
  state, match, now, webcam, selectedCount, modelLoading, modelError,
}: {
  state: KioskState;
  match: KioskMatch | null;
  now: Date;
  webcam: ReturnType<typeof useWebcam>;
  selectedCount: number;
  modelLoading: boolean;
  modelError: string | null;
}) {
  switch (state) {
    case 'IDLE':
      // 由上層改用 KioskSessionSelector 渲染；此 case 不會被走到
      return null;

    case 'READY':
      return (
        <div style={styles.center}>
          <CameraView webcam={webcam} />
          {modelError ? (
            <h1 style={{ ...styles.bigTitle, color: '#fca5a5' }}>模型載入失敗：{modelError}</h1>
          ) : modelLoading ? (
            <>
              <h1 style={styles.bigTitle}>載入辨識模型中…</h1>
              <p style={styles.subText}>第一次大約 6 MB，瀏覽器會自動 cache</p>
            </>
          ) : (
            <>
              <h1 style={styles.bigTitle}>Ready to Check-in</h1>
              <p style={styles.subText}>看著鏡頭，保持微笑</p>
              <p style={styles.devNote}>比對範圍：{selectedCount} 個場次</p>
            </>
          )}
        </div>
      );

    case 'SCANNING':
      return (
        <div style={styles.center}>
          <CameraView webcam={webcam} scanning />
          <h1 style={styles.bigTitle}>辨識中…</h1>
          <p style={styles.subText}>請保持不動</p>
          <KioskKeyframes />
        </div>
      );

    case 'CONFIRMING':
      return (
        <div style={styles.center}>
          <div style={styles.confirmCard}>
            <div style={{ fontSize: '5rem' }}>🤔</div>
            <h2 style={styles.confirmName}>可能是：{match?.studentName ?? '—'}</h2>
            <p style={styles.confirmConf}>信心值 {(match?.confidence ?? 0).toFixed(2)}</p>
            <div style={styles.confirmBtns}>
              <button type="button" style={styles.btnPrimary} disabled>
                確認報到
              </button>
              <button type="button" style={styles.btnSecondary} disabled>
                不是此人
              </button>
            </div>
            <p style={styles.devNote}>（Task 039 啟用按鈕）</p>
          </div>
        </div>
      );

    case 'SUCCESS':
      return (
        <div style={{ ...styles.center, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.successName}>{greeting(now)}，{match?.studentName ?? '同學'}！</h1>
          <p style={styles.successMsg}>報到成功</p>
          <p style={styles.successTime}>{formatTimeWithSec(match?.recordedAt ?? now)}</p>
        </div>
      );

    case 'FAILED':
      return (
        <div style={{ ...styles.center, background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' }}>
          <div style={styles.failIcon}>✕</div>
          <h1 style={styles.failTitle}>辨識失敗</h1>
          <p style={styles.failMsg}>無法辨識，請老師協助</p>
        </div>
      );

    case 'MANUAL':
      return (
        <div style={styles.center}>
          <h1 style={styles.bigTitle}>老師協助手動報到</h1>
          <p style={styles.subText}>（Task 040 加入學生搜尋與選擇）</p>
        </div>
      );
  }
}

function CameraView({
  webcam, scanning = false,
}: {
  webcam: ReturnType<typeof useWebcam>;
  scanning?: boolean;
}) {
  return (
    <div style={styles.cameraFrame}>
      <video
        ref={webcam.videoRef}
        muted
        autoPlay
        playsInline
        style={{
          ...styles.video,
          // 鏡像（自助使用更直覺）
          transform: 'scaleX(-1)',
          ...(scanning ? { boxShadow: '0 0 0 4px #2563eb, 0 0 24px #2563eb' } : null),
        }}
      />
      {webcam.status === 'pending' && (
        <div style={styles.cameraOverlay}>正在啟動攝影機…</div>
      )}
      {webcam.status === 'denied' && (
        <div style={{ ...styles.cameraOverlay, background: '#7f1d1d' }}>
          ✕ 攝影機權限被拒絕，請於瀏覽器設定中開啟後重新整理
        </div>
      )}
      {webcam.status === 'error' && (
        <div style={{ ...styles.cameraOverlay, background: '#7f1d1d' }}>
          ✕ 攝影機錯誤：{webcam.error}
        </div>
      )}
    </div>
  );
}

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return '早安';
  if (h < 18) return '午安';
  return '晚安';
}

function KioskKeyframes() {
  // 把 keyframes 注入文件 head（避免每次重 render 重新注入）
  return (
    <style>{`@keyframes sams-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.7; }
    }`}</style>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0f172a',
    color: '#f1f5f9',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.6rem 1.25rem',
    background: '#020617',
    borderBottom: '1px solid #1e293b',
  },
  brand: { fontWeight: 700, fontSize: '1rem', letterSpacing: 1 },
  branchName: { marginLeft: '0.75rem', color: '#94a3b8', fontSize: '0.95rem' },
  clock: { fontVariantNumeric: 'tabular-nums', fontSize: '1.05rem', color: '#cbd5e1' },
  exitBtn: {
    padding: '0.4rem 0.85rem',
    background: 'transparent',
    color: '#cbd5e1',
    border: '1px solid #334155',
    borderRadius: 6,
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
  main: { flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    transition: 'background 0.4s',
  },
  cameraPlaceholder: { fontSize: '8rem', opacity: 0.7, marginBottom: '1.5rem' },
  cameraFrame: {
    position: 'relative',
    width: 'min(640px, 70vw)',
    aspectRatio: '4 / 3',
    background: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: '1.5rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', transition: 'box-shadow 0.3s' },
  cameraOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(15,23,42,0.85)', color: '#f1f5f9',
    fontSize: '1.05rem', textAlign: 'center', padding: '1rem',
  },
  bigTitle: { margin: 0, fontSize: '3rem', fontWeight: 700 },
  subText: { marginTop: '0.75rem', color: '#cbd5e1', fontSize: '1.25rem' },

  confirmCard: {
    background: '#1e293b',
    padding: '2.5rem 3rem',
    borderRadius: 16,
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
    minWidth: 360,
  },
  confirmName: { margin: '0.75rem 0 0.4rem', fontSize: '2rem' },
  confirmConf: { color: '#94a3b8', fontSize: '1rem', margin: 0 },
  confirmBtns: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'center' },
  btnPrimary: {
    padding: '0.85rem 1.5rem', background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 600,
  },
  btnSecondary: {
    padding: '0.85rem 1.5rem', background: '#475569', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: '1rem',
  },
  devNote: { color: '#64748b', fontSize: '0.8rem', marginTop: '0.75rem' },

  successIcon: {
    fontSize: '8rem',
    width: 160, height: 160, lineHeight: '160px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    marginBottom: '1.5rem',
    fontWeight: 700,
  },
  successName: { margin: 0, fontSize: '3rem', color: '#fff' },
  successMsg: { color: '#dcfce7', fontSize: '1.5rem', marginTop: '0.5rem' },
  successTime: { color: '#bbf7d0', fontSize: '2rem', fontVariantNumeric: 'tabular-nums', marginTop: '0.4rem' },

  failIcon: {
    fontSize: '6rem',
    width: 140, height: 140, lineHeight: '140px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    marginBottom: '1.5rem',
    fontWeight: 700,
  },
  failTitle: { margin: 0, fontSize: '2.5rem', color: '#fff' },
  failMsg: { color: '#fee2e2', fontSize: '1.25rem', marginTop: '0.4rem' },

  statusBar: {
    display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
    padding: '0.5rem 1.25rem', background: '#020617', borderTop: '1px solid #1e293b',
    color: '#94a3b8', fontSize: '0.8rem',
  },
  statusItem: { fontVariantNumeric: 'tabular-nums' },
};
