// students collection 型別定義（Task 011）
//
// Firestore 路徑：`students/{studentId}`，studentId 為人工指定的學號
// （如 "S001"）。grade 採文字（如 "小三", "國一"），不強迫枚舉以保彈性。

import type { Timestamp } from 'firebase/firestore';

export interface StudentDoc {
  studentId: string;
  branchId: string;
  name: string;
  grade: string;
  parentName: string;
  parentPhone: string;
  active: boolean;
  createdAt?: Timestamp;
}

export interface NewStudentInput {
  studentId: string;
  branchId: string;
  name: string;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
}

export interface UpdateStudentInput {
  branchId?: string;
  name?: string;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
  active?: boolean;
}

export const STUDENTS_COLLECTION = 'students';

// 學號允許英數與底線、連字號，2-30 字元；不限制大小寫以保留 "S001" 寫法
const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;

export function isValidStudentId(id: string): boolean {
  return STUDENT_ID_PATTERN.test(id);
}
