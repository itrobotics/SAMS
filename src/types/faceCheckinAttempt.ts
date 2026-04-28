// face_checkin_attempts collection 型別定義（Task 041）
//
// 每次 Kiosk 跑完一次匹配（不論成功失敗）就寫一筆 log，用來：
//   1. 追蹤模型在現場的真實表現（哪些學生常失敗）
//   2. 排查 false positive（誤辨）爭議
//   3. Phase 13 報表算辨識成功率 / 人工確認率 / 失敗率
//
// 為了不讓集合無限膨脹，UI / 報表只看「最近 N 天」；正式環境可加 Cloud
// Function 排程清舊資料。

import type { Timestamp } from 'firebase/firestore';

export type FaceAttemptResult =
  | 'SUCCESS'      // AUTO_PASS 已寫入 attendance
  | 'NEED_CONFIRM' // 中信心，待操作員按鈕
  | 'CONFIRMED'    // 老師按了「確認報到」
  | 'REJECTED'     // 老師按了「不是此人」
  | 'FAILED'       // 信心值不足或無候選
  | 'MANUAL';      // 走 fallback 手動報到

export interface FaceCheckinAttemptDoc {
  attemptId: string;
  branchId: string;
  sessionId: string | null;        // null = 多場次同時比對
  deviceId: string;                 // 目前用 navigator.userAgent 摘要
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  confidence: number | null;
  result: FaceAttemptResult;
  scopeProfileCount: number;        // 比對範圍照片數
  operatorId: string | null;
  createdAt?: Timestamp;
}

export const FACE_CHECKIN_ATTEMPTS_COLLECTION = 'face_checkin_attempts';
