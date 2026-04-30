// course_enrollments collection 型別定義
//
// 「學程 ↔ 學員」關聯。一個學員可同時報名多個 course；
// 退訓 / 完成可改 status，不必直接刪除以保留歷史。
//
// Firestore 路徑：`course_enrollments/{enrollmentId}`
// enrollmentId 採複合格式 `${courseId}__${studentId}`，確保同一學員在同一 course 只會有一筆。

import type { Timestamp } from 'firebase/firestore';

export const COURSE_ENROLLMENTS_COLLECTION = 'course_enrollments';

export type CourseEnrollmentStatus = 'active' | 'withdrawn' | 'completed';

export const COURSE_ENROLLMENT_STATUS_LABELS: Record<CourseEnrollmentStatus, string> = {
  active: '在訓中',
  withdrawn: '已退訓',
  completed: '已完成',
};

export interface CourseEnrollmentDoc {
  enrollmentId: string;
  courseId: string;
  branchId: string;
  studentId: string;
  studentName: string;
  enrolledAt?: Timestamp;
  status: CourseEnrollmentStatus;
}

export function courseEnrollmentDocId(courseId: string, studentId: string): string {
  return `${courseId}__${studentId}`;
}
