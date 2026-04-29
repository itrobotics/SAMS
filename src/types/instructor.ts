// instructors collection 型別定義（Task 046, updated Task 050）

import type { Timestamp } from 'firebase/firestore';

export const INSTRUCTORS_COLLECTION = 'instructors';

export type SchoolStatus = 'graduated' | 'dropped' | 'enrolled';
export type Gender = 'male' | 'female' | 'other';

export const SCHOOL_STATUS_LABELS: Record<SchoolStatus, string> = {
  graduated: '畢業',
  dropped: '肄業',
  enrolled: '就學中',
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男',
  female: '女',
  other: '其他',
};

export interface InstructorDoc {
  instructorId: string;
  name: string;
  gender: Gender;
  courses: string[];
  education: string;
  schoolStatus: SchoolStatus;
  schoolName: string;
  department: string;
  grade: string;
  phone1: string;
  phone2: string;
  mailingCity: string;
  mailingAddress: string;
  registeredAddressSameAsMailing: boolean;
  registeredCity: string;
  registeredAddress: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  hourlyRate: string;
  totalTeachingHours: number;
  notes: string;
  active: boolean;
  createdAt?: Timestamp;
}

export type NewInstructorInput = Omit<InstructorDoc, 'createdAt'>;

export type UpdateInstructorInput = Partial<Omit<InstructorDoc, 'instructorId' | 'createdAt'>>;
