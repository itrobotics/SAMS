// Kiosk 人臉報到流程 hook（Task 036）
//
// 把 KioskPage 的 state machine 和「擷取畫面 → embedding → 匹配 → 寫 attendance」
// 邏輯抽出來，避免 KioskPage 變太肥。
//
// 行為：
//   - 進入 READY 狀態後，每 1 秒擷取一張畫面跑 face detect
//   - 偵測到臉 → 切 SCANNING → 跑 embedding → 匹配 profiles
//   - 找到匹配（distance < threshold）→ 寫 attendance 改為 CHECKED_IN（或 LATE）
//   - 顯示 SUCCESS 3 秒後回 READY
//   - 連續匹配同一學生 N 秒內不重複報到（cooldown）
//
// Task 037 會把 "all profiles" 改成 "selected sessions' rostered students"
// Task 038 會把 0.5 簡化門檻換成 0.85 / 0.70 / 0.70 規則
// Task 041 會在每次 attempt 寫 face_checkin_attempts log

import { useCallback, useEffect, useRef, useState } from 'react';

import type { useWebcam } from './useWebcam';
import { listActiveProfilesForStudents } from '../services/faceProfiles';
import {
  extractEmbedding,
  findBestMatch,
  loadFaceModels,
} from '../services/faceRecognition';
import { updateAttendance } from '../services/attendance';
import { decideManualCheckinStatus } from '../utils/attendance';
import { makeRecordId } from '../types/attendance';
import type { KioskState, KioskMatch } from '../pages/KioskPage';
import type { FaceProfileDoc } from '../types/faceProfile';
import type { SessionDoc } from '../types/session';
import type { AttendanceRecordDoc } from '../types/attendance';

const SIMPLE_DISTANCE_THRESHOLD = 0.5;       // Task 038 會替換為 spec 規則
const SCAN_INTERVAL_MS = 1000;                // 兩次抓臉間隔
const COOLDOWN_AFTER_SUCCESS_MS = 8000;       // 同學生 8 秒內不再次報到
const MODEL_WARMUP_DELAY_MS = 600;

interface UseKioskCheckinArgs {
  enabled: boolean;                           // 攝影機 ready + state in READY
  webcam: ReturnType<typeof useWebcam>;
  branchId: string;
  selectedSessions: Set<string>;
  todaySessions: SessionDoc[];
  attendanceForToday: AttendanceRecordDoc[];  // 從 Kiosk 端的 realtime 訂閱來
  setKioskState: (s: KioskState) => void;
  setMatch: (m: KioskMatch | null) => void;
  graceMinutes: number;
  operatorId: string | null;
}

interface KioskCheckinStatus {
  modelLoaded: boolean;
  modelLoading: boolean;
  modelError: string | null;
  lastScanAt: Date | null;
  matchProfiles: number; // 目前比對範圍的 active 照片數
}

export function useKioskCheckin(args: UseKioskCheckinArgs): KioskCheckinStatus {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);

  // Cooldown：學生 -> 上次成功時間
  const cooldownRef = useRef<Map<string, number>>(new Map());
  // 排程下次掃描
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 模型載入完成才開始迴圈
  const busyRef = useRef(false);

  // 1) 預先載入模型
  useEffect(() => {
    if (modelLoaded || modelLoading) return;
    setModelLoading(true);
    loadFaceModels()
      .then(() => { setModelLoaded(true); setModelLoading(false); })
      .catch((e) => {
        setModelError(e instanceof Error ? e.message : '模型載入失敗');
        setModelLoading(false);
      });
  }, [modelLoaded, modelLoading]);

  // 2) 計算「比對範圍」— Task 037
  //
  // 規格 7-3：只比對「本分校 + 今日應到學生」。
  // 我們再加一層：
  //   - 只看「已勾選的 sessions」內的應到名單（operator 在 Task 031 選的）
  //   - 跳過 status === LEAVE / CANCELLED（請假 / 取消的學生不該比對）
  //   - 跳過 status === CHECKED_IN / LATE（已到，避免重複觸發 / 提升效能）
  //
  // 學生若「同時跨多個已勾選 sessions」(例如安親 + 才藝接續)，只要任一場仍為
  // SCHEDULED / ABSENT 就會被納入比對；命中後同學生在所有相關 sessions 一次寫入。
  //
  // listActiveProfilesForStudents() 已硬性過濾 branchId + active=true，
  // 所以「同分校」與「active 照片」也成立。
  const computeTargetStudentIds = useCallback((): string[] => {
    if (args.selectedSessions.size === 0) return [];
    const needsCheckin = new Set<string>();   // 仍需報到
    const alreadyDone = new Set<string>();    // 已到（不重複觸發）
    for (const r of args.attendanceForToday) {
      if (!args.selectedSessions.has(r.sessionId)) continue;
      if (r.status === 'LEAVE' || r.status === 'CANCELLED') continue;
      if (r.status === 'CHECKED_IN' || r.status === 'LATE' || r.status === 'MAKEUP') {
        alreadyDone.add(r.studentId);
      } else {
        needsCheckin.add(r.studentId);
      }
    }
    // 一個學生若在 A 班已到、B 班還沒到，仍需要被比對 → 留在 needsCheckin
    return Array.from(needsCheckin);
  }, [args.selectedSessions, args.attendanceForToday]);

  // 3) 主流程：擷取一幀 → 偵測 → 匹配 → 寫 attendance
  const runOneScan = useCallback(async () => {
    if (busyRef.current) return;
    if (!args.enabled || !modelLoaded) return;
    if (args.webcam.status !== 'ready') return;
    busyRef.current = true;
    try {
      const video = args.webcam.videoRef.current;
      if (!video || video.readyState < 2) return;
      const result = await extractEmbedding(video);
      setLastScanAt(new Date());
      if (!result) return; // 沒臉，直接下一輪

      // 切 SCANNING
      args.setKioskState('SCANNING');

      const targetIds = computeTargetStudentIds();
      if (targetIds.length === 0) {
        args.setKioskState('READY');
        return;
      }

      const profiles: FaceProfileDoc[] = await listActiveProfilesForStudents(args.branchId, targetIds);
      const best = findBestMatch(result.embedding, profiles);

      if (!best || best.distance > SIMPLE_DISTANCE_THRESHOLD) {
        // Task 038 之後會把 FAILED 細分；MVP 先靜靜回 READY
        args.setKioskState('READY');
        return;
      }

      // 命中。檢查 cooldown
      const cool = cooldownRef.current.get(best.profile.studentId);
      if (cool && Date.now() - cool < COOLDOWN_AFTER_SUCCESS_MS) {
        args.setKioskState('READY');
        return;
      }

      // 找該學生在 selectedSessions 裡的 attendance record；可能多個（多堂課同時）
      // → 全部一起寫成 CHECKED_IN
      const ownRecords = args.attendanceForToday.filter(
        (r) => r.studentId === best.profile.studentId && args.selectedSessions.has(r.sessionId),
      );
      if (ownRecords.length === 0) {
        args.setKioskState('READY');
        return;
      }

      let primaryName = '';
      for (const rec of ownRecords) {
        const session = args.todaySessions.find((s) => s.sessionId === rec.sessionId);
        const status = session
          ? decideManualCheckinStatus(new Date(), session.date, session.startTime, args.graceMinutes)
          : 'CHECKED_IN';
        const recordId = makeRecordId(rec.sessionId, rec.studentId);
        await updateAttendance(recordId, {
          status,
          method: 'FACE',
          confidence: Number(best.confidence.toFixed(4)),
          operatorId: args.operatorId,
          setCheckinNow: true,
        });
        primaryName = rec.studentName;
      }

      cooldownRef.current.set(best.profile.studentId, Date.now());
      args.setMatch({
        studentId: best.profile.studentId,
        studentName: primaryName || best.profile.studentId,
        confidence: best.confidence,
        recordedAt: new Date(),
      });
      args.setKioskState('SUCCESS');
    } catch (e) {
      // 單次錯誤不要連帶停掉整個迴圈
      console.error('[kiosk] scan error:', e);
    } finally {
      busyRef.current = false;
    }
  }, [args, modelLoaded, computeTargetStudentIds]);

  // 4) 排程：READY 時每 SCAN_INTERVAL_MS 跑一次；其他狀態暫停
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!args.enabled) return;

    function loop() {
      runOneScan().finally(() => {
        timerRef.current = setTimeout(loop, SCAN_INTERVAL_MS);
      });
    }
    timerRef.current = setTimeout(loop, MODEL_WARMUP_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [args.enabled, runOneScan]);

  return {
    modelLoaded,
    modelLoading,
    modelError,
    lastScanAt,
    matchProfiles: 0, // Task 041 會把整個 stats 補齊
  };
}
