// class_students collection 型別定義（Task 016）
//
// Firestore 路徑：`class_students/{classId}__{studentId}`
// 使用複合 doc ID 確保「同一學生不會在同班重複加入」並可直接 idempotent 寫入。
//
// 為什麼把 branchId 帶上：方便日後用 branchId 做 Firestore where 過濾，
// 或在無法 join 的環境（純 client SDK）做權限隔離。

import type { Timestamp } from 'firebase/firestore';

export interface ClassStudentDoc {
  id: string;            // `${classId}__${studentId}`
  classId: string;
  studentId: string;
  branchId: string;
  active: boolean;
  joinedAt?: Timestamp;
}

export const CLASS_STUDENTS_COLLECTION = 'class_students';

export function classStudentDocId(classId: string, studentId: string): string {
  return `${classId}__${studentId}`;
}
