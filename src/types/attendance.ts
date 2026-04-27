// attendance_records collection 型別定義（Task 021）
//
// Firestore 路徑：`attendance_records/{recordId}`，
// recordId 格式 `${sessionId}__${studentId}`，確保「同一場次同一學生」只會有一筆。
// 場次產生時就先以 SCHEDULED 狀態建立每筆紀錄，後續報到 / 請假等動作只是 update。

import type { Timestamp } from 'firebase/firestore';

export const ATTENDANCE_STATUSES = [
  'SCHEDULED',
  'CHECKED_IN',
  'LATE',
  'LEAVE',
  'ABSENT',
  'MAKEUP',
  'CANCELLED',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_METHODS = ['FACE', 'MANUAL'] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export interface AttendanceRecordDoc {
  recordId: string;     // `${sessionId}__${studentId}`
  sessionId: string;
  branchId: string;
  classId: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  method: AttendanceMethod | null;
  confidence: number | null;
  checkinTime: Timestamp | null;
  operatorId: string | null;
}

export const ATTENDANCE_RECORDS_COLLECTION = 'attendance_records';

export function makeRecordId(sessionId: string, studentId: string): string {
  return `${sessionId}__${studentId}`;
}

// 中文標籤（看板 / 報到頁顯示用）
export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  SCHEDULED: '應到',
  CHECKED_IN: '已到',
  LATE: '遲到',
  LEAVE: '請假',
  ABSENT: '未到',
  MAKEUP: '補課',
  CANCELLED: '取消',
};

export const STATUS_COLORS: Record<AttendanceStatus, { bg: string; fg: string }> = {
  SCHEDULED: { bg: '#f3f4f6', fg: '#6b7280' },
  CHECKED_IN: { bg: '#dcfce7', fg: '#166534' },
  LATE:       { bg: '#fef3c7', fg: '#92400e' },
  LEAVE:      { bg: '#dbeafe', fg: '#1e40af' },
  ABSENT:     { bg: '#fee2e2', fg: '#b91c1c' },
  MAKEUP:     { bg: '#ede9fe', fg: '#5b21b6' },
  CANCELLED:  { bg: '#f3f4f6', fg: '#9ca3af' },
};
