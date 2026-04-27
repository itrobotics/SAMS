// sessions collection 型別定義（Task 020）
//
// Firestore 路徑：`sessions/{sessionId}`，sessionId 格式 `${YYYYMMDD}_${classId}`
// 確保「同一班同一天」最多只會產生一個場次（idempotent 寫入用）。
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

// 統一的 sessionId 計算規則 — 任何寫入端都應該用這個函數產生 ID
export function makeSessionId(dateCompact: string, classId: string): string {
  return `${dateCompact}_${classId}`;
}
