// classes collection 型別定義（Task 015）
//
// Firestore 路徑：`classes/{classId}`，classId 為使用者指定的英數短代碼
// （如 "C001"）。weekday 採 ISO 1=Mon...7=Sun。
// startTime / endTime 為 24 小時 "HH:mm" 字串，避免時區麻煩；session 產生時
// 直接複製過去當顯示用。

import type { Timestamp } from 'firebase/firestore';

export interface ClassDoc {
  classId: string;
  branchId: string;
  name: string;
  teacherId: string;
  classroom: string;
  weekday: number; // 1-7（ISO；1=Mon）
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  active: boolean;
  createdAt?: Timestamp;
}

export interface NewClassInput {
  classId: string;
  branchId: string;
  name: string;
  teacherId?: string;
  classroom?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface UpdateClassInput {
  branchId?: string;
  name?: string;
  teacherId?: string;
  classroom?: string;
  weekday?: number;
  startTime?: string;
  endTime?: string;
  active?: boolean;
}

export const CLASSES_COLLECTION = 'classes';

const CLASS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidClassId(id: string): boolean {
  return CLASS_ID_PATTERN.test(id);
}

export function isValidTime(t: string): boolean {
  return TIME_PATTERN.test(t);
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日',
};

// 把 JS Date.getDay()（0=Sun..6=Sat）轉為 ISO weekday（1=Mon..7=Sun）。
export function isoWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

// 比較兩個 "HH:mm" 字串：a < b ⇒ 負值
export function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}
