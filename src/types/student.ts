// students collection 型別定義

import type { Timestamp } from 'firebase/firestore';

export type Gender = 'male' | 'female' | 'other';
export const GENDER_LABELS: Record<Gender, string> = { male: '男', female: '女', other: '其他' };

export interface StudentDoc {
  studentId: string;
  branchId: string;
  name: string;
  gender: Gender;
  birthday: string;        // "YYYY-MM-DD" or ""
  grade: string;
  parentName: string;
  parentPhone: string;
  // 通訊地址
  mailingCity: string;
  mailingDistrict: string;
  mailingAddress: string;
  // 戶籍地址
  registeredAddressSameAsMailing: boolean;
  registeredCity: string;
  registeredDistrict: string;
  registeredAddress: string;
  // 緊急聯絡人
  emergencyContactName: string;
  emergencyContactRelation: string;
  notes: string;
  active: boolean;
  createdAt?: Timestamp;
}

export interface NewStudentInput {
  studentId: string;
  branchId: string;
  name: string;
  gender?: Gender;
  birthday?: string;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
  mailingCity?: string;
  mailingDistrict?: string;
  mailingAddress?: string;
  registeredAddressSameAsMailing?: boolean;
  registeredCity?: string;
  registeredDistrict?: string;
  registeredAddress?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  notes?: string;
}

export interface UpdateStudentInput {
  branchId?: string;
  name?: string;
  gender?: Gender;
  birthday?: string;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
  mailingCity?: string;
  mailingDistrict?: string;
  mailingAddress?: string;
  registeredAddressSameAsMailing?: boolean;
  registeredCity?: string;
  registeredDistrict?: string;
  registeredAddress?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  notes?: string;
  active?: boolean;
}

export const STUDENTS_COLLECTION = 'students';

const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;

export function isValidStudentId(id: string): boolean {
  return STUDENT_ID_PATTERN.test(id);
}
