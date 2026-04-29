// course_attendance collection 型別定義
//
// 與 attendance_records 並列：attendance_records 是班級場次的出席，
// course_attendance 則是課程方案場次（course_sessions）的出席。
//
// Firestore 路徑：`course_attendance/{attendanceId}`
// attendanceId 格式 `${courseSessionId}__${studentId}`，確保同一場次同一學員只會有一筆。

import type { Timestamp } from 'firebase/firestore';

export const COURSE_ATTENDANCE_COLLECTION = 'course_attendance';

export const COURSE_ATTENDANCE_STATUSES = [
  'SCHEDULED',
  'CHECKED_IN',
  'LATE',
  'LEAVE',
  'ABSENT',
] as const;
export type CourseAttendanceStatus = (typeof COURSE_ATTENDANCE_STATUSES)[number];

export const COURSE_ATTENDANCE_STATUS_LABELS: Record<CourseAttendanceStatus, string> = {
  SCHEDULED: '應到',
  CHECKED_IN: '已到',
  LATE: '遲到',
  LEAVE: '請假',
  ABSENT: '未到',
};

export const COURSE_ATTENDANCE_STATUS_COLORS: Record<CourseAttendanceStatus, { bg: string; fg: string }> = {
  SCHEDULED:  { bg: '#f3f4f6', fg: '#6b7280' },
  CHECKED_IN: { bg: '#dcfce7', fg: '#166534' },
  LATE:       { bg: '#fef3c7', fg: '#92400e' },
  LEAVE:      { bg: '#dbeafe', fg: '#1e40af' },
  ABSENT:     { bg: '#fee2e2', fg: '#b91c1c' },
};

export interface CourseAttendanceDoc {
  attendanceId: string;
  courseSessionId: string;
  courseId: string;
  moduleId: string;
  branchId: string;
  studentId: string;
  studentName: string;
  status: CourseAttendanceStatus;
  checkinTime: Timestamp | null;
  method: 'MANUAL';
  operatorId: string | null;
}

export function courseAttendanceDocId(courseSessionId: string, studentId: string): string {
  return `${courseSessionId}__${studentId}`;
}
