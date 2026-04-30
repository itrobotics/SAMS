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

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  KioskSessionSelector,
  classKey,
  courseKey,
  defaultSelectedSessionKeys,
} from '../components/KioskSessionSelector';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { useKioskCheckin } from '../hooks/useKioskCheckin';
import {
  useBranchDayAttendanceRealtime,
  useBranchDayCourseAttendanceRealtime,
  useBranchDayCourseSessionsRealtime,
  useBranchDaySessionsRealtime,
} from '../hooks/useRealtime';
import { useWebcam } from '../hooks/useWebcam';
import { ROUTES } from '../routes/paths';
import { updateAttendance } from '../services/attendance';
import { updateCourseAttendance } from '../services/courseAttendance';
import { logFaceAttempt, deriveDeviceId } from '../services/faceCheckinAttempts';
import { subscribeCourses } from '../services/courses';
import { subscribeCourseModulesForBranch } from '../services/courseModules';
import { subscribeBranchSettings } from '../services/settings';
import type { CourseDoc } from '../types/course';
import type { CourseModuleDoc } from '../types/courseModule';
import { decideManualCheckinStatus } from '../utils/attendance';
import { makeRecordId } from '../types/attendance';
import { courseAttendanceDocId } from '../types/courseAttendance';
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

// ─── 花名冊學生資料 ───────────────────────────────────────
interface RosterStudent {
  key: string;
  studentId: string;
  studentName: string;
  status: string;
  sessionKey: string;
  sessionLabel: string;    // Tab 第 1 行（課程名 or 班名）
  sessionSubLabel: string; // Tab 第 2 行（單元名(ID) or 時間範圍）
}

// ─── KioskPage ────────────────────────────────────────────
export function KioskPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const { branches, loading: branchesLoading } = useBranches();
  const { user } = useAuth();
  const branch = branches.find((b) => b.branchId === branchId);
  const branchName = branch?.name ?? branchId;
  const branchUnknown = !branchesLoading && branches.length > 0 && !branch;

  const [state, setState] = useState<KioskState>('IDLE');
  const [match, setMatch] = useState<KioskMatch | null>(null);
  const [now, setNow] = useState(new Date());
  const [manualMode, setManualMode] = useState(true);
  const [activeRosterTab, setActiveRosterTab] = useState<string | null>(null);

  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const today = todayISO();
  const todaySessionsRT = useBranchDaySessionsRealtime(branchId, today);
  const todayCourseSessionsRT = useBranchDayCourseSessionsRealtime(branchId, today);

  // 第一次載入完成後，自動勾選「進行中」場次
  useEffect(() => {
    if (todaySessionsRT.loading || todayCourseSessionsRT.loading) return;
    if (selectedSessions.size > 0) return;
    const defaults = defaultSelectedSessionKeys(
      todaySessionsRT.data,
      todayCourseSessionsRT.data,
    );
    if (defaults.size > 0) setSelectedSessions(defaults);
  }, [
    todaySessionsRT.loading, todaySessionsRT.data,
    todayCourseSessionsRT.loading, todayCourseSessionsRT.data,
    selectedSessions.size,
  ]);

  function toggleSession(sessionKey: string) {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionKey)) next.delete(sessionKey);
      else next.add(sessionKey);
      return next;
    });
  }

  function startKiosk() {
    if (selectedSessions.size === 0) return;
    setState('READY');
  }

  const cameraEnabled = state !== 'IDLE';
  const webcam = useWebcam({ enabled: cameraEnabled, width: 1280, height: 720 });

  const [settings, setSettings] = useState<BranchSettings | null>(null);
  useEffect(() => {
    if (!branchId) return;
    return subscribeBranchSettings(branchId, setSettings);
  }, [branchId]);

  // 課程 / 單元名稱對照（給 course session Tab 標籤用）
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [modules, setModules] = useState<CourseModuleDoc[]>([]);
  useEffect(() => {
    if (!branchId) return;
    return subscribeCourses({ branchIds: [branchId] }, setCourses);
  }, [branchId]);
  useEffect(() => {
    if (!branchId) return;
    return subscribeCourseModulesForBranch(branchId, setModules);
  }, [branchId]);
  const courseNameMap = useMemo(() => new Map(courses.map((c) => [c.courseId, c.name])), [courses]);
  const moduleNameMap = useMemo(() => new Map(modules.map((m) => [m.moduleId, m.name])), [modules]);

  const attendanceRT = useBranchDayAttendanceRealtime(branchId, today);
  const courseAttendanceRT = useBranchDayCourseAttendanceRealtime(branchId, today);

  // 右側花名冊：合併班級 + 課程方案，帶 sessionKey/sessionLabel，按姓名排序
  const rosterStudents: RosterStudent[] = useMemo(() => {
    if (selectedSessions.size === 0) return [];

    // 建立 sessionKey → 第 1 行標籤 / 第 2 行標籤 對照表
    const labelMap = new Map<string, string>();
    const subLabelMap = new Map<string, string>();
    for (const s of todaySessionsRT.data) {
      const k = classKey(s.sessionId);
      if (!selectedSessions.has(k)) continue;
      labelMap.set(k, s.className);
      subLabelMap.set(k, `${s.startTime}–${s.endTime}${s.classroom ? ' · ' + s.classroom : ''}`);
    }
    for (const s of todayCourseSessionsRT.data) {
      const k = courseKey(s.courseSessionId);
      if (!selectedSessions.has(k)) continue;
      labelMap.set(k, courseNameMap.get(s.courseId) ?? s.courseId);
      if (s.moduleId) {
        const mName = moduleNameMap.get(s.moduleId) ?? s.moduleId;
        subLabelMap.set(k, `${mName}(${s.moduleId})${s.classroom ? ' · ' + s.classroom : ''}`);
      } else {
        subLabelMap.set(k, s.classroom ?? '');
      }
    }

    const list: RosterStudent[] = [];
    for (const r of attendanceRT.data) {
      const sk = classKey(r.sessionId);
      if (!selectedSessions.has(sk)) continue;
      list.push({
        key: `cls:${r.sessionId}:${r.studentId}`,
        studentId: r.studentId,
        studentName: r.studentName,
        status: r.status,
        sessionKey: sk,
        sessionLabel: labelMap.get(sk) ?? r.sessionId,
        sessionSubLabel: subLabelMap.get(sk) ?? '',
      });
    }
    for (const r of courseAttendanceRT.data) {
      const sk = courseKey(r.courseSessionId);
      if (!selectedSessions.has(sk)) continue;
      list.push({
        key: `crs:${r.courseSessionId}:${r.studentId}`,
        studentId: r.studentId,
        studentName: r.studentName,
        status: r.status,
        sessionKey: sk,
        sessionLabel: labelMap.get(sk) ?? r.courseSessionId,
        sessionSubLabel: subLabelMap.get(sk) ?? '',
      });
    }
    list.sort((a, b) => a.studentName.localeCompare(b.studentName, 'zh-Hant'));
    return list;
  }, [
    attendanceRT.data, courseAttendanceRT.data, selectedSessions,
    todaySessionsRT.data, todayCourseSessionsRT.data,
    courseNameMap, moduleNameMap,
  ]);

  // 手動報到候選名單（尚未報到）
  const manualCandidates: ManualCandidate[] = (() => {
    if (selectedSessions.size === 0) return [];
    const list: ManualCandidate[] = [];
    for (const r of attendanceRT.data) {
      if (!selectedSessions.has(classKey(r.sessionId))) continue;
      if (r.status === 'CHECKED_IN' || r.status === 'LATE' || r.status === 'MAKEUP') continue;
      const session = todaySessionsRT.data.find((s) => s.sessionId === r.sessionId);
      list.push({
        type: 'class',
        studentId: r.studentId,
        studentName: r.studentName,
        targetId: r.sessionId,
        sessionLabel: session ? `${session.className} ${session.startTime}` : r.sessionId,
        status: r.status,
      });
    }
    for (const r of courseAttendanceRT.data) {
      if (!selectedSessions.has(courseKey(r.courseSessionId))) continue;
      if (r.status === 'CHECKED_IN' || r.status === 'LATE') continue;
      const session = todayCourseSessionsRT.data.find((s) => s.courseSessionId === r.courseSessionId);
      list.push({
        type: 'course',
        studentId: r.studentId,
        studentName: r.studentName,
        targetId: r.courseSessionId,
        sessionLabel: session ? `${session.courseSessionId} ${session.startTime}` : r.courseSessionId,
        status: r.status,
      });
    }
    return list;
  })();

  function switchToManual() {
    setMatch(null);
    setState('MANUAL');
  }

  function cancelManual() {
    setState('READY');
  }

  async function manualCheckin(c: ManualCandidate) {
    if (c.type === 'class') {
      const session = todaySessionsRT.data.find((s) => s.sessionId === c.targetId);
      const status = session
        ? decideManualCheckinStatus(
            new Date(),
            session.date,
            session.startTime,
            settings?.graceMinutes ?? DEFAULT_BRANCH_SETTINGS.graceMinutes,
          )
        : 'CHECKED_IN';
      await updateAttendance(makeRecordId(c.targetId, c.studentId), {
        status,
        method: 'MANUAL',
        confidence: null,
        operatorId: user?.userId ?? null,
        setCheckinNow: true,
      });
    } else {
      await updateCourseAttendance(courseAttendanceDocId(c.targetId, c.studentId), {
        status: 'CHECKED_IN',
        operatorId: user?.userId ?? null,
        setCheckinNow: true,
      });
    }
    void logFaceAttempt({
      branchId: branchId ?? '',
      sessionId: c.type === 'class' ? c.targetId : null,
      deviceId: deriveDeviceId(),
      matchedStudentId: c.studentId,
      matchedStudentName: c.studentName,
      confidence: null,
      result: 'MANUAL',
      scopeProfileCount: 0,
      operatorId: user?.userId ?? null,
    });
    setMatch({ studentId: c.studentId, studentName: c.studentName, confidence: 1, recordedAt: new Date() });
    setState('SUCCESS');
  }

  const checkin = useKioskCheckin({
    enabled: state === 'READY' || state === 'SCANNING',
    manualMode,
    webcam,
    branchId: branchId ?? '',
    selectedSessions,
    todaySessions: todaySessionsRT.data,
    attendanceForToday: attendanceRT.data,
    todayCourseSessions: todayCourseSessionsRT.data,
    courseAttendanceForToday: courseAttendanceRT.data,
    setKioskState: setState,
    setMatch,
    graceMinutes: settings?.graceMinutes ?? DEFAULT_BRANCH_SETTINGS.graceMinutes,
    autoPassThreshold: settings?.faceAutoPassThreshold ?? DEFAULT_BRANCH_SETTINGS.faceAutoPassThreshold,
    confirmThreshold: settings?.faceConfirmThreshold ?? DEFAULT_BRANCH_SETTINGS.faceConfirmThreshold,
    operatorId: user?.userId ?? null,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (state !== 'SUCCESS' && state !== 'FAILED') return;
    const t = setTimeout(() => {
      setState('READY');
      setMatch(null);
    }, state === 'SUCCESS' ? 3000 : 4000);
    return () => clearTimeout(t);
  }, [state]);

  // Tab 初始化：花名冊有資料時設第一個 sessionKey（跨場次重選時也重設）
  useEffect(() => {
    if (rosterStudents.length === 0) return;
    setActiveRosterTab((prev) => {
      const keys = [...new Set(rosterStudents.map((r) => r.sessionKey))];
      if (prev && keys.includes(prev)) return prev;
      return keys[0] ?? null;
    });
  }, [rosterStudents]);

  // 辨識命中後自動切到該學生所屬 Tab
  useEffect(() => {
    if (!match) return;
    const sessions = rosterStudents
      .filter((r) => r.studentId === match.studentId)
      .map((r) => r.sessionKey);
    if (sessions.length === 0) return;
    setActiveRosterTab((prev) => (prev && sessions.includes(prev) ? prev : sessions[0]));
  }, [match, rosterStudents]);

  if (branchUnknown) {
    return <UnknownBranch branchId={branchId ?? ''} branches={branches} />;
  }

  return (
    <div style={styles.shell}>
      <header style={styles.topbar}>
        <div>
          <span style={styles.brand}>SAMS Kiosk</span>
          <span style={styles.branchName}>
            {branchName}
            {branchId && <code style={styles.branchIdInline}>{branchId}</code>}
          </span>
        </div>
        <div style={styles.clock}>{formatTimeWithSec(now)}</div>
        <Link to={ROUTES.branches} style={styles.exitBtn}>結束</Link>
      </header>

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
            modelLoaded={checkin.modelLoaded}
            modelError={checkin.modelError}
            onConfirmMatch={checkin.confirmMatch}
            onRejectMatch={checkin.rejectMatch}
            onSwitchToManual={switchToManual}
            onManualCheckin={manualCheckin}
            onCancelManual={cancelManual}
            manualCandidates={manualCandidates}
            rosterStudents={rosterStudents}
            activeRosterTab={activeRosterTab}
            onRosterTabChange={setActiveRosterTab}
            manualMode={manualMode}
            onToggleMode={() => setManualMode((v) => !v)}
            onTriggerScan={checkin.triggerScan}
          />
        )}
      </main>

      <footer style={styles.statusBar}>
        <span style={styles.statusItem}>場次：{selectedSessions.size}</span>
        <span style={styles.statusItem}>
          {checkin.modelLoading ? '模型載入中…' : checkin.modelLoaded ? '模型 ✓' : '模型未載入'}
        </span>
        <span style={styles.statusItem}>
          上次掃描：{checkin.lastScanAt ? formatTimeWithSec(checkin.lastScanAt) : '—'}
        </span>
        <span style={styles.statusItem}>學生：{rosterStudents.length}</span>
      </footer>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────
interface ManualCandidate {
  type: 'class' | 'course';
  studentId: string;
  studentName: string;
  targetId: string;
  sessionLabel: string;
  status: string;
}

// ─── UnknownBranch ────────────────────────────────────────
function UnknownBranch({
  branchId, branches,
}: {
  branchId: string;
  branches: Array<{ branchId: string; name: string }>;
}) {
  return (
    <div style={styles.shell}>
      <header style={styles.topbar}>
        <span style={styles.brand}>SAMS Kiosk</span>
        <Link to={ROUTES.branches} style={styles.exitBtn}>結束</Link>
      </header>
      <main style={styles.main}>
        <div style={styles.center}>
          <div style={{
            background: '#1e293b', color: '#f1f5f9',
            padding: '2.5rem 3rem', borderRadius: 16,
            width: 'min(560px, 92vw)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: '4rem', textAlign: 'center', marginBottom: '0.75rem' }}>⚠️</div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', textAlign: 'center' }}>
              找不到分校 <code style={{ background: '#0f172a', padding: '0.1rem 0.45rem', borderRadius: 4 }}>{branchId}</code>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '0.85rem', textAlign: 'center' }}>
              請確認 URL 上的分校代碼是否正確（大小寫、拼法）。
            </p>
            {branches.length > 0 ? (
              <>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                  可用分校：
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {branches.map((b) => (
                    <li key={b.branchId} style={{
                      padding: '0.55rem 0.75rem', borderTop: '1px solid #334155',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span>
                        <span style={{ fontSize: '1rem' }}>{b.name}</span>
                        <code style={{ marginLeft: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>{b.branchId}</code>
                      </span>
                      <Link
                        to={ROUTES.kiosk(b.branchId)}
                        style={{
                          padding: '0.35rem 0.7rem', background: '#2563eb', color: '#fff',
                          borderRadius: 6, fontSize: '0.85rem', textDecoration: 'none',
                        }}
                      >
                        進入 →
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginTop: '1rem', textAlign: 'center' }}>
                目前帳號沒有任何分校權限。
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Stage ────────────────────────────────────────────────
// READY / SCANNING / CONFIRMING：左側 camera、右側花名冊
// SUCCESS / FAILED：全螢幕 overlay（3–4 秒後自動回 READY）
// MANUAL：全螢幕手動報到
function Stage({
  state, match, now, webcam, selectedCount,
  modelLoading, modelLoaded, modelError,
  onConfirmMatch, onRejectMatch,
  onSwitchToManual, onManualCheckin, onCancelManual, manualCandidates,
  rosterStudents, activeRosterTab, onRosterTabChange,
  manualMode, onToggleMode, onTriggerScan,
}: {
  state: KioskState;
  match: KioskMatch | null;
  now: Date;
  webcam: ReturnType<typeof useWebcam>;
  selectedCount: number;
  modelLoading: boolean;
  modelLoaded: boolean;
  modelError: string | null;
  onConfirmMatch: (m: KioskMatch) => Promise<void>;
  onRejectMatch: () => void;
  onSwitchToManual: () => void;
  onManualCheckin: (c: ManualCandidate) => Promise<void>;
  onCancelManual: () => void;
  manualCandidates: ManualCandidate[];
  rosterStudents: RosterStudent[];
  activeRosterTab: string | null;
  onRosterTabChange: (key: string) => void;
  manualMode: boolean;
  onToggleMode: () => void;
  onTriggerScan: () => void;
}) {
  switch (state) {
    case 'IDLE':
      return null;

    case 'READY':
      return (
        <div style={styles.splitLayout}>
          <div style={styles.leftPanel}>
            <ModeToggle manualMode={manualMode} onToggle={onToggleMode} />
            <CameraView webcam={webcam} />
            {modelError ? (
              <p style={{ ...styles.stateLabel, color: '#fca5a5' }}>模型載入失敗：{modelError}</p>
            ) : modelLoading ? (
              <p style={styles.stateLabel}>載入辨識模型中…</p>
            ) : manualMode ? (
              <button
                type="button"
                style={styles.scanBtn}
                onClick={onTriggerScan}
                disabled={!modelLoaded}
              >
                ▶ 辨識
              </button>
            ) : (
              <>
                <p style={styles.stateLabel}>請看鏡頭，保持微笑</p>
                <p style={styles.devNote}>比對範圍：{selectedCount} 個場次</p>
              </>
            )}
          </div>
          <div style={styles.rightPanel}>
            <StudentRoster students={rosterStudents} activeTab={activeRosterTab} onTabChange={onRosterTabChange} />
          </div>
        </div>
      );

    case 'SCANNING':
      return (
        <div style={styles.splitLayout}>
          <div style={styles.leftPanel}>
            <ModeToggle manualMode={manualMode} onToggle={onToggleMode} />
            <CameraView webcam={webcam} scanning />
            {manualMode ? (
              <button type="button" style={{ ...styles.scanBtn, background: '#1d4ed8', cursor: 'not-allowed' }} disabled>
                辨識中…
              </button>
            ) : (
              <p style={{ ...styles.stateLabel, color: '#60a5fa' }}>辨識中…請保持不動</p>
            )}
            <KioskKeyframes />
          </div>
          <div style={styles.rightPanel}>
            <StudentRoster students={rosterStudents} activeTab={activeRosterTab} onTabChange={onRosterTabChange} />
          </div>
        </div>
      );

    case 'CONFIRMING':
      return (
        <div style={styles.splitLayout}>
          <div style={styles.leftPanel}>
            <div style={styles.confirmCard}>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🤔</div>
              <h2 style={styles.confirmName}>可能是：{match?.studentName ?? '—'}</h2>
              <p style={styles.confirmConf}>信心值 {(match?.confidence ?? 0).toFixed(2)}</p>
              <div style={styles.confirmBtns}>
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => match && onConfirmMatch(match)}
                  disabled={!match}
                >
                  確認報到
                </button>
                <button type="button" style={styles.btnSecondary} onClick={onRejectMatch}>
                  不是此人
                </button>
              </div>
            </div>
          </div>
          <div style={styles.rightPanel}>
            <StudentRoster students={rosterStudents} activeTab={activeRosterTab} onTabChange={onRosterTabChange} />
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
          <p style={styles.failMsg}>無法辨識，請講師協助</p>
          <button
            type="button"
            onClick={onSwitchToManual}
            style={{
              marginTop: '1.5rem', padding: '0.85rem 1.75rem',
              background: '#fff', color: '#991b1b', border: 'none',
              borderRadius: 8, fontSize: '1.05rem', fontWeight: 600,
            }}
          >
            講師手動報到
          </button>
        </div>
      );

    case 'MANUAL':
      return (
        <ManualFallback
          onCheckin={onManualCheckin}
          onCancel={onCancelManual}
          candidates={manualCandidates}
        />
      );
  }
}

// ─── ModeToggle ──────────────────────────────────────────
function ModeToggle({ manualMode, onToggle }: { manualMode: boolean; onToggle: () => void }) {
  return (
    <div style={styles.modeToggleWrap}>
      <button
        type="button"
        style={{ ...styles.modeBtn, ...(manualMode ? styles.modeBtnActive : null) }}
        onClick={() => { if (!manualMode) onToggle(); }}
      >
        手動辨識
      </button>
      <button
        type="button"
        style={{ ...styles.modeBtn, ...(!manualMode ? styles.modeBtnActive : null) }}
        onClick={() => { if (manualMode) onToggle(); }}
      >
        自動辨識
      </button>
    </div>
  );
}

// ─── StudentRoster ────────────────────────────────────────
// 多 session 時顯示 Tab 列；單 session 時直接顯示格子
const ROWS_PER_COL = 10;

function StudentRoster({
  students,
  activeTab,
  onTabChange,
}: {
  students: RosterStudent[];
  activeTab: string | null;
  onTabChange: (key: string) => void;
}) {
  // 收集唯一 session（保留插入順序）
  const sessions = useMemo(() => {
    const seen = new Map<string, { label: string; subLabel: string }>();
    for (const s of students) {
      if (!seen.has(s.sessionKey))
        seen.set(s.sessionKey, { label: s.sessionLabel, subLabel: s.sessionSubLabel });
    }
    return [...seen.entries()].map(([key, { label, subLabel }]) => ({ key, label, subLabel }));
  }, [students]);

  // 每個 Tab 的已到/應到統計
  const tabStats = useMemo(() => {
    const map = new Map<string, { total: number; checkedIn: number }>();
    for (const s of students) {
      const cur = map.get(s.sessionKey) ?? { total: 0, checkedIn: 0 };
      cur.total++;
      if (s.status === 'CHECKED_IN' || s.status === 'LATE') cur.checkedIn++;
      map.set(s.sessionKey, cur);
    }
    return map;
  }, [students]);

  const currentTab = (activeTab && sessions.some(s => s.key === activeTab))
    ? activeTab
    : sessions[0]?.key ?? null;
  const visible = currentTab ? students.filter(s => s.sessionKey === currentTab) : students;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {sessions.length > 0 && (
        <div style={styles.tabBar}>
          {sessions.map(({ key, label, subLabel }) => {
            const stats = tabStats.get(key);
            const isActive = key === currentTab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : null),
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{label}</div>
                {subLabel && (
                  <div style={{ fontSize: '0.78rem', color: isActive ? '#bfdbfe' : '#64748b', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subLabel}</div>
                )}
                {stats && (
                  <div style={styles.tabStats}>
                    {stats.checkedIn}/{stats.total} 已到
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      <RosterGrid students={visible} />
    </div>
  );
}

// ─── RosterGrid ───────────────────────────────────────────
// 純格子渲染：每欄 10 人，字體隨欄數縮小，無捲軸
function RosterGrid({ students }: { students: RosterStudent[] }) {
  if (students.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '1rem' }}>
        尚無學生資料
      </div>
    );
  }

  const cols: RosterStudent[][] = [];
  for (let i = 0; i < students.length; i += ROWS_PER_COL) {
    cols.push(students.slice(i, i + ROWS_PER_COL));
  }

  const n = cols.length;
  const nameFz = n <= 2 ? '1rem' : n <= 3 ? '0.9rem' : n <= 5 ? '0.8rem' : n <= 7 ? '0.7rem' : '0.62rem';
  const idFz = n <= 2 ? '0.78rem' : n <= 4 ? '0.7rem' : '0.6rem';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      gap: '0.3rem',
      padding: '0.5rem 0.6rem',
      overflow: 'hidden',
      alignItems: 'stretch',
    }}>
      {cols.map((col, ci) => (
        <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
          {col.map((s) => (
            <div
              key={s.key}
              style={{
                flex: 1,
                background: statusBg(s.status),
                borderRadius: 5,
                padding: '0.25rem 0.45rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                transition: 'background 0.4s',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{
                fontSize: nameFz, fontWeight: 600, color: '#f1f5f9',
                lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.studentName}
              </div>
              <div style={{
                fontSize: idFz, color: '#94a3b8', marginTop: '0.06rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.studentId}
              </div>
            </div>
          ))}
          {col.length < ROWS_PER_COL &&
            Array.from({ length: ROWS_PER_COL - col.length }).map((_, i) => (
              <div key={`pad-${i}`} style={{ flex: 1 }} />
            ))}
        </div>
      ))}
    </div>
  );
}

function statusBg(status: string): string {
  switch (status) {
    case 'CHECKED_IN': return '#14532d';  // 深綠
    case 'LATE':       return '#78350f';  // 深琥珀
    case 'LEAVE':      return '#1e3a8a';  // 深藍
    case 'ABSENT':     return '#450a0a';  // 深紅
    case 'MAKEUP':     return '#312e81';  // 深紫
    default:           return '#1e293b';  // 深藍灰（SCHEDULED）
  }
}

// ─── ManualFallback ───────────────────────────────────────
function ManualFallback({
  candidates, onCheckin, onCancel,
}: {
  candidates: ManualCandidate[];
  onCheckin: (c: ManualCandidate) => Promise<void>;
  onCancel: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const filtered = candidates.filter((c) => {
    if (!keyword.trim()) return true;
    const k = keyword.trim().toLowerCase();
    return c.studentName.toLowerCase().includes(k) || c.studentId.toLowerCase().includes(k);
  });

  async function handleCheckin(c: ManualCandidate) {
    const key = `${c.type}:${c.targetId}__${c.studentId}`;
    setBusyKey(key);
    try { await onCheckin(c); } finally { setBusyKey(null); }
  }

  return (
    <div style={styles.center}>
      <div style={{ ...styles.confirmCard, width: 'min(640px, 90vw)', textAlign: 'left' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>講師手動報到</h2>
        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '0.4rem' }}>
          搜尋目前比對範圍內、尚未報到的學生
        </p>
        <input
          type="search"
          placeholder="搜尋姓名 / 學號"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '0.7rem 0.9rem', fontSize: '1rem',
            border: '1px solid #475569', borderRadius: 6, background: '#0f172a',
            color: '#f1f5f9', marginTop: '0.75rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', maxHeight: 320, overflow: 'auto' }}>
          {filtered.length === 0 && (
            <li style={{ padding: '1rem', color: '#94a3b8', textAlign: 'center' }}>
              {candidates.length === 0 ? '比對範圍內所有學生都已報到 / 請假' : '沒有符合的學生'}
            </li>
          )}
          {filtered.map((c) => {
            const key = `${c.type}:${c.targetId}__${c.studentId}`;
            return (
              <li key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.8rem', borderBottom: '1px solid #334155',
              }}>
                <div>
                  <div style={{ fontSize: '1rem' }}>{c.studentName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                    <code>{c.studentId}</code> · {c.sessionLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckin(c)}
                  disabled={busyKey === key}
                  style={{
                    padding: '0.45rem 0.85rem', background: '#16a34a', color: '#fff',
                    border: 'none', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600,
                  }}
                >
                  {busyKey === key ? '處理中…' : '報到'}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onCancel}
          style={{
            marginTop: '1rem', padding: '0.6rem 1rem',
            background: 'transparent', color: '#cbd5e1',
            border: '1px solid #475569', borderRadius: 6, fontSize: '0.9rem', width: '100%',
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── CameraView ───────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────
function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return '早安';
  if (h < 18) return '午安';
  return '晚安';
}

function KioskKeyframes() {
  return (
    <style>{`@keyframes sams-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.7; }
    }`}</style>
  );
}

// ─── Styles ───────────────────────────────────────────────
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
    flexShrink: 0,
  },
  brand: { fontWeight: 700, fontSize: '1rem', letterSpacing: 1 },
  branchName: { marginLeft: '0.75rem', color: '#94a3b8', fontSize: '0.95rem' },
  branchIdInline: {
    marginLeft: '0.45rem', padding: '0.05rem 0.4rem',
    background: '#0f172a', borderRadius: 4,
    color: '#64748b', fontSize: '0.78rem',
  },
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
  main: { flex: 1, display: 'flex', overflow: 'hidden' },

  // IDLE centred wrapper
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    transition: 'background 0.4s',
  },

  // ── split layout (READY / SCANNING / CONFIRMING) ──────
  splitLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  leftPanel: {
    width: '38%',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.85rem',
    padding: '1.25rem',
    borderRight: '1px solid #1e293b',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#080f1c',
    overflow: 'hidden',
  },
  stateLabel: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#cbd5e1',
    textAlign: 'center',
  },

  // Session Tabs
  tabBar: {
    display: 'flex',
    flexShrink: 0,
    borderBottom: '2px solid #1e293b',
  },
  tab: {
    flex: 1,
    padding: '0.5rem 0.5rem',
    background: '#0f172a',
    color: '#94a3b8',
    border: 'none',
    borderRight: '1px solid #1e293b',
    fontSize: '0.82rem',
    cursor: 'pointer',
    textAlign: 'center' as const,
    lineHeight: 1.3,
    minWidth: 0,
    minHeight: 68,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    background: '#1d4ed8',
    color: '#fff',
    fontWeight: 700,
  },
  tabStats: {
    fontSize: '0.7rem',
    marginTop: '0.15rem',
    opacity: 0.85,
    fontWeight: 400,
  },

  // 辨識模式切換
  modeToggleWrap: {
    display: 'flex',
    width: '100%',
    border: '1px solid #334155',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modeBtn: {
    flex: 1,
    padding: '0.45rem 0',
    background: '#1e293b',
    color: '#94a3b8',
    border: 'none',
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  modeBtnActive: {
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
  },

  // 手動辨識觸發按鈕
  scanBtn: {
    width: '100%',
    padding: '0.9rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '1.2rem',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px',
  },

  // Camera
  cameraFrame: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    background: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', transition: 'box-shadow 0.3s' },
  cameraOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(15,23,42,0.85)', color: '#f1f5f9',
    fontSize: '1.05rem', textAlign: 'center', padding: '1rem',
  },

  // Confirm card (in left panel)
  confirmCard: {
    background: '#1e293b',
    padding: '2rem',
    borderRadius: 16,
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
    width: '100%',
  },
  confirmName: { margin: '0.5rem 0 0.3rem', fontSize: '1.8rem' },
  confirmConf: { color: '#94a3b8', fontSize: '0.95rem', margin: 0 },
  confirmBtns: { display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'center' },
  btnPrimary: {
    padding: '0.75rem 1.25rem', background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 600,
  },
  btnSecondary: {
    padding: '0.75rem 1.25rem', background: '#475569', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: '1rem',
  },
  devNote: { color: '#64748b', fontSize: '0.8rem', margin: 0 },

  // Success / Fail (full-screen overlays)
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

  // Footer
  statusBar: {
    display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
    padding: '0.5rem 1.25rem', background: '#020617', borderTop: '1px solid #1e293b',
    color: '#94a3b8', fontSize: '0.8rem', flexShrink: 0,
  },
  statusItem: { fontVariantNumeric: 'tabular-nums' },
};
