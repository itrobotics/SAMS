// sessions collection 型別定義
//
// Firestore 路徑：`sessions/{sessionId}`
// sessionId 格式：`${YYYYMMDD}_${classId}_${HHmm}`
//   - 同一班同一天可以有多場（如週一 AM + PM 不同老師），用 startTime 後綴區分
//   - HHmm 是 startTime 去掉 ":" 的四位數字（"09:00" → "0900"）
//   - 字典序排起來剛好 = 時間順序，方便 dashboard / kiosk 排序
// className 是冗餘但常用的反正規化欄位，方便看板直接顯示無需 join。

import type { Timestamp } from 'firebase/firestore';

export type SessionStatus = 'waiting' | 'running' | 'finished';

export interface SessionDoc {
  sessionId: string;
  branchId: string;
  classId: string;
  className: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
  status: SessionStatus;
  classroom?: string;
  teacherId?: string;
  createdAt?: Timestamp;
}

export const SESSIONS_COLLECTION = 'sessions';

// 統一的 sessionId 計算規則 — 任何寫入端都應該用這個函數產生 ID。
// startTime: "HH:mm" → 內部去掉 ":" 後拼接，避免 sessionId 出現特殊符號。
export function makeSessionId(dateCompact: string, classId: string, startTime: string): string {
  const hhmm = startTime.replace(':', '');
  return `${dateCompact}_${classId}_${hhmm}`;
}
